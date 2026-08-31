#!/usr/bin/env python3
"""
상권 인텔리전스 빌더 — 이미 수집해 둔 실측 파일들을 "결합"해서 판단 지표를 만든다.

왜 필요한가
-----------
지금 우리 데이터는 수요 지표(배후 아파트·집객시설·생활인구)와 공급 지표(점포수)가
서로 다른 파일에 따로 있다. 따로 보면 그냥 숫자지만, 합치면 질문에 답할 수 있다.
  - "여기는 손님(수요)에 비해 가게(공급)가 너무 많은가?"  → 과포화
  - "손님은 많은데 이 업종 가게가 없는 곳은?"             → 미개척(whitespace)
  - "강남역이랑 성격이 비슷한 상권은 어디?"                → 유사 상권

외부 API 호출 없음. 이미 저장된 JSON 만 읽어서 계산한다(키 불필요, 오프라인 실행 가능).

정직성 원칙(CLAUDE.md)
----------------------
  - 없는 값은 지어내지 않는다. 결측이면 그 지표를 **빼고** 계산하고,
    무엇을 몇 개 썼는지 cov(coverage) 로 같이 저장한다.
  - 가중치는 실측이 아니라 **가정**이다. WEIGHTS 에 명시하고 결과 파일에도 그대로 넣는다.
  - 점수는 블랙박스가 아니다. "가산 점수"라서 각 요인의 기여도를 정확히 분해할 수 있다.
    (머신러닝 SHAP 근사치가 아니라 산수로 딱 떨어지는 값)

입력  frontend/{trade_zones,zone_change,zone_apt,zone_facility,zone_industry,
              livepop_dong,seoul_dong.geojson}.json
출력  frontend/zone_intel.json

    python build_zone_intel.py
"""
import os, sys, json, math, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FE   = os.path.join(ROOT, "frontend")
OUT  = os.path.join(FE, "zone_intel.json")

# 수요 합성점수 가중치 — 실측이 아니라 '가정'. 근거: 상권 수요는 (1) 거주 배후 (2) 유입 인구가
# 대부분을 설명하고, 집객시설은 유입의 대리지표, 아파트 시가는 구매력의 대리지표라고 봤다.
WEIGHTS = {"hshld": 0.35, "livepop": 0.35, "fac": 0.20, "price": 0.10}

# 이 미만이면 '상권'으로 비교하지 않는다(공원·학교·병원·단지 구역).
# 점포가 없으면 공급 백분위가 0에 붙어 gap 이 무조건 커지는 착시가 생긴다.
MIN_STORES = 30


def load(name):
    p = os.path.join(FE, name)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception as ex:
        print(f"  ! {name} 로드 실패 — 해당 지표 제외: {ex}")
        return None


# ── 점(상권 중심좌표) 이 어느 행정동 폴리곤 안인지 (ray casting) ──
def in_ring(x, y, ring):
    """ray casting: 점에서 오른쪽으로 반직선을 쏴 변과 몇 번 교차하는지 센다. 홀수면 안쪽."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


def in_polygon(x, y, poly):
    """poly = [외곽링, 구멍링...]. 외곽 안이면서 구멍 밖이어야 진짜 안쪽."""
    if not poly or not in_ring(x, y, poly[0]):
        return False
    return not any(in_ring(x, y, h) for h in poly[1:])


def build_dong_index(geo):
    """전 폴리곤을 다 검사하면 1564x425 번이라 느리다.
    폴리곤마다 bbox 를 미리 만들어 두고 bbox 를 벗어나면 즉시 건너뛴다."""
    idx = []
    for ft in geo.get("features", []):
        p = ft.get("properties", {})
        g = ft.get("geometry") or {}
        polys = g.get("coordinates") or []
        if g.get("type") == "Polygon":
            polys = [polys]
        for poly in polys:
            if not poly or not poly[0]:
                continue
            xs = [c[0] for c in poly[0]]
            ys = [c[1] for c in poly[0]]
            idx.append((min(xs), min(ys), max(xs), max(ys), poly, p))
    return idx


def locate(lon, lat, idx):
    for x0, y0, x1, y1, poly, p in idx:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and in_polygon(lon, lat, poly):
            return p
    return None


def pct_ranks(vals):
    """값 dict{key:number} → 백분위 dict{key:0~100}.
    '서울에서 몇 등쯤인가'로 바꿔야 단위(세대/명/개)가 달라도 더할 수 있다.
    동점은 같은 백분위(평균순위)를 준다."""
    items = sorted(vals.items(), key=lambda kv: kv[1])
    n = len(items)
    out = {}
    i = 0
    while i < n:
        j = i
        while j + 1 < n and items[j + 1][1] == items[i][1]:
            j += 1
        rank = (i + j) / 2.0                       # 동점 구간의 평균 순위
        p = 100.0 * rank / (n - 1) if n > 1 else 50.0
        for k in range(i, j + 1):
            out[items[k][0]] = p
        i = j + 1
    return out


def median(a):
    a = sorted(a)
    n = len(a)
    if not n:
        return None
    return a[n // 2] if n % 2 else (a[n // 2 - 1] + a[n // 2]) / 2.0


def main():
    tz = load("trade_zones.json")
    if not tz or not tz.get("zones"):
        print("trade_zones.json 없음 — 중단(정직)."); return 1
    zones = tz["zones"]
    zc = (load("zone_change.json") or {}).get("zones") or {}
    za = (load("zone_apt.json") or {}).get("zones") or {}
    zf = (load("zone_facility.json") or {}).get("zones") or {}
    ziw = load("zone_industry.json") or {}
    zi, inds = ziw.get("zones") or {}, ziw.get("inds") or []
    lpw = load("livepop_dong.json") or {}
    lp = lpw.get("dong") or {}
    geo = load("seoul_dong.geojson")

    # 1) 상권 → 행정동/자치구 매핑 (좌표 → 폴리곤)
    print("1) 상권 위치 → 자치구/행정동 매핑")
    gu_of, dong_of, adm_of = {}, {}, {}
    if geo:
        idx = build_dong_index(geo)
        for z in zones:
            p = locate(z.get("lon"), z.get("lat"), idx)
            if p:
                gu_of[z["cd"]] = p.get("gu"); dong_of[z["cd"]] = p.get("dong"); adm_of[z["cd"]] = p.get("adm")
    print(f"   매핑 성공 {len(gu_of)}/{len(zones)}")

    # 2) 수요 원자료 모으기 (없으면 그냥 빠진다 — 0으로 채우지 않는다)
    raw = {"hshld": {}, "livepop": {}, "fac": {}, "price": {}}
    for z in zones:
        cd = z["cd"]
        a = za.get(cd)
        if a and a.get("hshld"):
            raw["hshld"][cd] = float(a["hshld"])
        if a and a.get("price_eok"):
            raw["price"][cd] = float(a["price_eok"])
        f = zf.get(cd)
        if f and f.get("total"):
            raw["fac"][cd] = float(f["total"])
        adm = adm_of.get(cd)
        d = lp.get(adm) if adm else None
        if d and d.get("tot"):
            raw["livepop"][cd] = float(d["tot"])

    ranks = {k: pct_ranks(v) for k, v in raw.items() if v}
    for k in raw:
        print(f"   {k}: {len(raw[k])}개 상권 ({100*len(raw[k])//max(1,len(zones))}%)")

    # 3) 공급 백분위 (상권 총 점포수)
    supply_rank = pct_ranks({z["cd"]: float(z.get("stores") or 0) for z in zones})

    # 4) 서울 업종별 '점포당 매출' 중위값 — 개별 상권 성과의 비교 기준선
    per_store = {}
    for cd, rec in zi.items():
        for row in rec.get("rows", []):
            ii, st, sl = row[0], row[1], row[2]
            if st and st > 0 and sl:
                per_store.setdefault(ii, []).append(sl / st)
    seoul_med = {}
    for ii, arr in per_store.items():
        m = median(arr)
        if m:
            seoul_med[inds[ii] if ii < len(inds) else str(ii)] = round(m)
    print(f"2) 서울 업종별 점포당매출 기준선 {len(seoul_med)}개 업종")

    # 5) 상권별 지표 조립
    print("3) 수요·공급·기회 점수 계산")
    out = {}
    demand_vals = {}
    for z in zones:
        cd = z["cd"]
        parts, wsum = {}, 0.0
        for k, w in WEIGHTS.items():
            r = ranks.get(k, {}).get(cd)
            if r is None:
                continue
            parts[k] = r
            wsum += w
        if not parts:
            continue
        # 결측 지표가 있으면 남은 가중치로 재정규화(있는 것만으로 공정하게 비교)
        dem = sum(WEIGHTS[k] * v for k, v in parts.items()) / wsum
        demand_vals[cd] = dem
        sup = supply_rank.get(cd, 50.0)
        ch = zc.get(cd) or {}
        # 점포가 거의 없는 구역(공원·병원·학교·아파트 단지 등)은 '기회'가 아니라 '비교 불가'다.
        # 공급 백분위가 0에 가까워 gap 이 자동으로 커지므로, 여기서 걸러내지 않으면
        # 근린공원이 창업 기회 1위로 올라온다(실제로 그렇게 나왔다).
        weak = (z.get("stores") or 0) < MIN_STORES
        out[cd] = {
            "gu": gu_of.get(cd), "dong": dong_of.get(cd),
            **({"weak": 1} if weak else {}),
            "dem": round(dem, 1),                     # 수요 백분위(0~100)
            "sup": round(sup, 1),                     # 공급(점포수) 백분위
            "gap": round(dem - sup, 1),               # +면 수요우위(기회), -면 공급과잉(포화)
            "cov": round(wsum / sum(WEIGHTS.values()), 2),   # 수요지표 반영률(1.0=전부 있음)
            # 기여도 분해 — 가산식이라 정확히 떨어진다. 50(서울 중간)을 기준으로 얼마나 밀어올렸나.
            "why": {k: round(WEIGHTS[k] / wsum * (v - 50), 1) for k, v in parts.items()},
            "raw": {k: round(raw[k][cd]) for k in parts if cd in raw[k]},
            "grade": ch.get("ix"), "grade_nm": ch.get("ix_nm"),
            "opr": ch.get("opr"), "cls": ch.get("cls"),   # 평균 운영개월 / 폐업개월(실측)
        }

    # 6) 유사 상권 — 성격이 비슷한 곳 top5 (z-score 유클리드 거리)
    print("4) 유사 상권 계산")
    zmap = {z["cd"]: z for z in zones}
    feats, keys = [], []
    for cd, o in out.items():
        z = zmap.get(cd)
        if not z or o.get("weak"):
            continue      # 비교 불가 구역은 '비슷한 상권' 후보에서도 뺀다
        keys.append(cd)
        feats.append([
            math.log1p(z.get("stores") or 0),
            math.log1p((z.get("sales") or 0) / 1e8),
            o["dem"] / 100.0,
            (o["opr"] or 0) / 100.0,
        ])
    dim = len(feats[0]) if feats else 0
    mu = [sum(f[i] for f in feats) / len(feats) for i in range(dim)] if feats else []
    sd = [(sum((f[i] - mu[i]) ** 2 for f in feats) / len(feats)) ** 0.5 or 1.0 for i in range(dim)] if feats else []
    norm = [[(f[i] - mu[i]) / sd[i] for i in range(dim)] for f in feats]
    for a in range(len(keys)):
        va = norm[a]
        best = []
        for b in range(len(keys)):
            if b == a:
                continue
            d = 0.0
            for i in range(dim):
                d += (va[i] - norm[b][i]) ** 2
                if d > 9:      # 이미 멀면 나머지 차원 계산 생략(속도)
                    break
            best.append((d, keys[b]))
        best.sort()
        out[keys[a]]["sim"] = [c for _, c in best[:5]]

    res = {
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "quarter": tz.get("quarter"),
        "n_zones": len(out),
        "weights": WEIGHTS,
        "note": ("상권 인텔리전스. dem/sup/gap 은 서울 전체 상권 중 백분위(0~100). "
                 "gap=dem-sup 이 크면 '수요 대비 점포가 적은 곳'(기회), 작으면 과포화. "
                 "가중치(weights)는 실측이 아니라 가정이며 cov 는 결측 반영률(1.0=지표 4개 모두 사용). "
                 "opr/cls 는 서울시 상권변화지표의 평균 운영·폐업 개월수(실측)."),
        "seoul_med_per_store": seoul_med,
        "inds": inds,
        "zones": out,
    }
    # 값이 None 인 키는 저장하지 않는다(파일 크기 절감 + "없음"을 0으로 오해하지 않게)
    for o in out.values():
        for k in [k for k, v in o.items() if v is None]:
            del o[k]

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT) / 1024
    nweak = sum(1 for o in out.values() if o.get("weak"))
    print(f"저장: {OUT} · 상권 {len(out)} (비교불가 {nweak}) · {size:.0f}KB")

    real = {cd: o for cd, o in out.items() if not o.get("weak")}
    print(f"기회(수요>공급) 상위 5 — 점포 {MIN_STORES}개 이상 상권만:")
    for cd, o in sorted(real.items(), key=lambda kv: -kv[1]["gap"])[:5]:
        z = zmap.get(cd, {})
        print(f"   {o.get('gu') or '?'} {z.get('nm', cd)} · 점포 {z.get('stores')} · "
              f"gap +{o['gap']} (수요 {o['dem']} / 공급 {o['sup']})")
    print(f"과포화(공급>수요) 상위 5:")
    for cd, o in sorted(real.items(), key=lambda kv: kv[1]["gap"])[:5]:
        z = zmap.get(cd, {})
        print(f"   {o.get('gu') or '?'} {z.get('nm', cd)} · 점포 {z.get('stores')} · gap {o['gap']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
