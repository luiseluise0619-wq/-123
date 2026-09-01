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
IDXOUT = os.path.join(FE, "zone_index.json")   # 첫 화면용 경량 인덱스

# 수요 합성점수 가중치 — 실측이 아니라 '가정'. 근거: 상권 수요는 (1) 거주 배후 (2) 유입 인구가
# 대부분을 설명하고, 집객시설은 유입의 대리지표, 아파트 시가는 구매력의 대리지표라고 봤다.
WEIGHTS = {"hshld": 0.35, "livepop": 0.35, "fac": 0.20, "price": 0.10}

# 이 미만이면 '상권'으로 비교하지 않는다(공원·학교·병원·단지 구역).
# 점포가 적으면 공급 백분위가 0에 붙어 gap 이 무조건 커지는 착시가 생긴다.
#
# 기준을 어떻게 정했나 (감이 아니라 실제 분포에서):
#   전 상권 점포수 분위 — 25%:24  50%:71  75%:166
#   전 상권 분기매출 분위 — 25%:10억  50%:31억  75%:106억
#   30개 컷으로 돌렸더니 상위 25곳이 초등학교·공원·우편취급국으로 채워졌다.
#   50개 + 10억 컷으로 올리자 을지로2가·선정릉역·시청역·아현역 같은 실제 상권이 남았다.
# 즉 "상업 실체가 있는 상권"의 하한선이며, 남는 상권은 1,564곳 중 927곳이다.
MIN_STORES = 50
MIN_SALES  = 10e8   # 분기 10억원


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
    zmap = {z["cd"]: z for z in zones}
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
        weak = (z.get("stores") or 0) < MIN_STORES or (z.get("sales") or 0) < MIN_SALES
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

    # 6) 유사 상권 — 성격이 비슷한 곳 top5
    #
    # 규모(점포수·매출)만 비교하면 실패한다. 실제로 그렇게 만들었더니
    # 을지로2가(도심 오피스 상권)의 '비슷한 상권'으로 오동나무공원·수유1동주민센터가 나왔다.
    # 숫자 크기만 닮았을 뿐 성격은 정반대다.
    # → '무슨 업종이 모여 있는가'(업종 매출 구성)를 주 신호로 쓰고, 규모는 보조로 쓴다.
    #   업종 구성 = 코사인 유사도(비중 벡터라 규모 영향 없음)
    #   규모/수요/생존 = z-score 유클리드 → 1/(1+d) 로 유사도화
    print("4) 유사 상권 계산 (업종 구성 60% + 규모·수요 40%)")
    keys, feats, mixes = [], [], []
    for cd, o in out.items():
        z = zmap.get(cd)
        if not z or o.get("weak"):
            continue      # 비교 불가 구역은 '비슷한 상권' 후보에서도 뺀다
        rows = (zi.get(cd) or {}).get("rows") or []
        tot = sum(r[2] for r in rows if r[2]) or 0
        if not tot:
            continue      # 업종 구성을 모르면 성격을 비교할 수 없다
        # 업종 매출 비중 벡터(희소). 미리 L2 정규화해 두면 코사인이 내적 한 번이다.
        m = {r[0]: r[2] / tot for r in rows if r[2]}
        nrm = math.sqrt(sum(v * v for v in m.values())) or 1.0
        mixes.append({k: v / nrm for k, v in m.items()})
        keys.append(cd)
        feats.append([
            math.log1p(z.get("stores") or 0),
            math.log1p((z.get("sales") or 0) / 1e8),
            o["dem"] / 100.0,
            (o["opr"] or 0) / 100.0,
        ])
    dim = len(feats[0]) if feats else 0
    n = len(keys)
    mu = [sum(f[i] for f in feats) / n for i in range(dim)] if n else []
    sd = [(sum((f[i] - mu[i]) ** 2 for f in feats) / n) ** 0.5 or 1.0 for i in range(dim)] if n else []
    norm = [[(f[i] - mu[i]) / sd[i] for i in range(dim)] for f in feats]
    for a in range(n):
        va, ma = norm[a], mixes[a]
        best = []
        for b in range(n):
            if b == a:
                continue
            mb = mixes[b]
            # 희소 내적: 짧은 쪽만 순회
            s, l = (ma, mb) if len(ma) <= len(mb) else (mb, ma)
            cos = 0.0
            for k, v in s.items():
                w = l.get(k)
                if w: cos += v * w
            if cos < 0.25:        # 업종 구성이 아예 다르면 규모를 볼 것도 없다
                continue
            d = 0.0
            for i in range(dim):
                d += (va[i] - norm[b][i]) ** 2
            best.append((0.6 * cos + 0.4 / (1.0 + math.sqrt(d)), keys[b]))
        best.sort(reverse=True)
        out[keys[a]]["sim"] = [c for _, c in best[:5]]

    res = {
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "quarter": tz.get("quarter"),
        "n_zones": len(out),
        "weights": WEIGHTS,
        "min_stores": MIN_STORES, "min_sales": MIN_SALES,
        "note": ("상권 인텔리전스. dem/sup/gap 은 서울 전체 상권 중 백분위(0~100). "
                 "gap=dem-sup 이 크면 '수요 대비 점포가 적은 곳'(기회), 작으면 과포화. "
                 "가중치(weights)는 실측이 아니라 가정이며 cov 는 결측 반영률(1.0=지표 4개 모두 사용). "
                 "opr/cls 는 서울시 상권변화지표의 평균 운영·폐업 개월수(실측). "
                 "weak=1 은 점포 50개 미만 또는 분기매출 10억 미만이라 상권 간 비교에서 제외한 구역(공원·학교·병원 등)."),
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

    # 검색·목록·랭킹만 하는 화면이 462KB 를 통째로 받을 이유가 없다.
    # 첫 화면용 경량 인덱스를 따로 뽑는다(상세는 상권을 열 때 지연 로딩).
    # 배열로 저장(키 이름 반복 제거) — 같은 내용이 dict 보다 훨씬 작다.
    idx_rows = []
    for cd, o in out.items():
        z = zmap.get(cd) or {}
        idx_rows.append([cd, z.get("nm"), o.get("gu"), o.get("dong"),
                         z.get("stores") or 0, round(z.get("sales") or 0),
                         o["dem"], o["sup"], o["gap"], o.get("grade"),
                         o.get("opr"), 1 if o.get("weak") else 0,
                         round(z.get("lon") or 0, 5), round(z.get("lat") or 0, 5)])
    idx_rows.sort(key=lambda r: -r[8])
    with open(IDXOUT, "w", encoding="utf-8") as f:
        json.dump({"updated": res["updated"], "quarter": res["quarter"],
                   "cols": ["cd", "nm", "gu", "dong", "stores", "sales",
                            "dem", "sup", "gap", "grade", "opr", "weak", "lon", "lat"],
                   "note": "첫 화면(검색·랭킹)용 경량 인덱스. 상세는 zone_intel.json 지연 로딩.",
                   "rows": idx_rows}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"저장: {IDXOUT} · {os.path.getsize(IDXOUT)/1024:.0f}KB (경량 인덱스)")

    size = os.path.getsize(OUT) / 1024
    nweak = sum(1 for o in out.values() if o.get("weak"))
    print(f"저장: {OUT} · 상권 {len(out)} (비교불가 {nweak}) · {size:.0f}KB")


    # ── 7) 업종별 기회 (Retail Gap / 시장 공백) ─────────────────────────
    #
    # 지금까지의 gap 은 '상권 전체' 기준이라 "여기 괜찮아?"에만 답한다.
    # 사용자가 진짜 묻는 건 "어디서 '카페'를 하면 기회가 있나?" 이다.
    # 같은 상권도 업종에 따라 답이 완전히 달라진다.
    #
    # 기회의 정의 — 세 가지가 동시에 맞아야 한다:
    #   ① 수요가 있다            → 상권 수요 백분위(dem)
    #   ② 그 업종 점포가 적다    → 같은 업종 점포수 백분위의 반대
    #   ③ 있는 점포는 잘 번다    → 점포당 매출이 서울 중위 대비 높음
    #
    # ③이 중요한 이유: 점포가 없는 게 '기회'가 아니라 '그 업종이 여기서 안 되는 것'일 수 있다.
    # 그래서 점포가 거의 없어 ③을 확인할 수 없는 곳은 점수를 매기지 않고
    # 'unproven'(미개척·확인 필요)으로 따로 표시한다. 지어내지 않는다.
    print("5) 업종별 기회(시장 공백) 계산")
    OPP_W = {"dem": 0.45, "scarce": 0.35, "perf": 0.20}   # 가정 — 결과 파일에 그대로 기록
    SHRINK_K = 5              # 축소추정 강도(점포 수가 이만큼일 때 절반 반영)
    MIN_VERIFY = 3            # 이 미만이면 '그 업종이 되는 동네인지' 검증 불가

    # 업종별로 (상권 점포수) / (점포당 매출) 백분위를 따로 낸다.
    ind_store, ind_perf = {}, {}
    for cd, o in out.items():
        if o.get("weak"):
            continue
        for row in (zi.get(cd) or {}).get("rows", []):
            ii, st, sl = row[0], row[1], row[2]
            ind_store.setdefault(ii, {})[cd] = float(st or 0)
            if st and st > 0 and sl:
                ind_perf.setdefault(ii, {})[cd] = sl / st

    store_rank = {ii: pct_ranks(v) for ii, v in ind_store.items() if len(v) >= 8}
    perf_rank  = {ii: pct_ranks(v) for ii, v in ind_perf.items() if len(v) >= 8}

    opp = {}
    ranked_full = {}          # 자르기 전 전체 랭킹 — 아래 맞춤 탐색용 파일에서 쓴다
    for ii, sr in store_rank.items():
        name = inds[ii] if ii < len(inds) else str(ii)
        pr = perf_rank.get(ii, {})
        ranked, unproven = [], []
        for cd, s_pct in sr.items():
            o = out.get(cd)
            if not o:
                continue
            n_st = ind_store[ii].get(cd, 0)
            row = {"cd": cd, "nm": (zmap.get(cd) or {}).get("nm"),
                   "gu": o.get("gu"), "dem": round(o["dem"]), "stores": int(n_st)}
            if n_st < MIN_VERIFY:
                # 수요는 있는데 그 업종이 거의 없다 → 공백일 수도, 안 되는 동네일 수도.
                if o["dem"] >= 70:
                    row["why"] = f"수요 상위인데 이 업종 점포가 {int(n_st)}개뿐"
                    unproven.append(row)
                continue
            p_pct = pr.get(cd)
            if p_pct is None:
                continue
            # 점포 3곳의 '점포당 매출'과 30곳의 그것을 같은 무게로 믿으면 안 된다.
            # 표본이 적을수록 서울 중간(50) 쪽으로 끌어당긴다(축소추정).
            #   n=3  → 3/(3+5)=0.38 만큼만 반영   n=30 → 0.86 만큼 반영
            # 이렇게 하면 "점포 3곳인데 매출 99등" 같은 우연이 1위를 먹지 못한다.
            shrink = n_st / (n_st + SHRINK_K)
            p_adj = 50.0 + (p_pct - 50.0) * shrink
            score = (OPP_W["dem"] * o["dem"]
                     + OPP_W["scarce"] * (100.0 - s_pct)
                     + OPP_W["perf"] * p_adj)
            # 점포 3~4개로 낸 '점포당 매출'은 한두 곳에 크게 흔들린다.
            # 점수를 감추지는 않되 신뢰도를 함께 내보내 화면에서 구분해 쓴다.
            conf = "높음" if n_st >= 10 else ("보통" if n_st >= 5 else "낮음")
            row.update({"score": round(score, 1), "scarce": round(100.0 - s_pct),
                        "perf": round(p_adj), "perf_raw": round(p_pct), "psales": round(ind_perf[ii][cd]),
                        "conf": conf})
            ranked.append(row)
        ranked.sort(key=lambda r: -r["score"])
        unproven.sort(key=lambda r: -r["dem"])
        if ranked:
            # What-if 용 분포 — "경쟁 점포가 N개 늘면 희소성이 얼마가 되나"를
            # 화면에서 정확히 다시 계산하려면 이 업종의 점포수 분포가 필요하다.
            # 전 상권 값을 다 보내면 무거우니 백분위 구간점 101개만 보낸다(0~100%).
            arr = sorted(ind_store[ii].values())
            m = len(arr)
            brk = [round(arr[min(m - 1, int(round(t / 100.0 * (m - 1))))]) for t in range(101)]
            ranked_full[name] = ranked
            opp[name] = {"top": ranked[:20], "unproven": unproven[:8],
                         "n_zones": len(ranked),
                         "store_brk": brk,
                         "seoul_med": seoul_med.get(name)}
    print(f"   업종 {len(opp)}개 · 상권 랭킹 생성")

    OPPOUT = os.path.join(FE, "zone_opportunity.json")
    with open(OPPOUT, "w", encoding="utf-8") as f:
        json.dump({"updated": res["updated"], "quarter": res["quarter"],
                   "weights": OPP_W, "min_verify": MIN_VERIFY, "shrink_k": SHRINK_K,
                   "note": ("업종별 시장 공백(Retail Gap). score = 수요 45% + 희소성 35% + 점포당매출 20%. "
                            "가중치는 가정이며 백분위는 상업 규모가 있는 상권(weak=0) 안에서만 계산했다. "
                            f"unproven 은 수요 상위(70+)인데 그 업종 점포가 {MIN_VERIFY}개 미만이라 "
                            "'되는 동네인지' 검증할 수 없는 곳 — 점수를 매기지 않는다."),
                   "ind": opp}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"저장: {OPPOUT} · {os.path.getsize(OPPOUT)/1024:.0f}KB")

    # ── 7-b) 맞춤 탐색용 전체 랭킹 ──────────────────────────────────────
    #
    # 위 파일의 top 은 20곳이다. 첫 화면에는 그걸로 충분하지만,
    # "낮은 임대료가 제일 중요하다" 처럼 사용자가 가중치를 바꾸면 순위가 통째로 뒤집힌다.
    # 기본 가중치로 300등이던 곳이 1등이 될 수 있는데, 20곳만 들고 다시 정렬하면
    # 그 20곳 안에서만 순위가 바뀐다 — 맞춤이라 부를 수 없는 가짜 결과가 나온다.
    # 그래서 점수를 매긴 상권 전부를 따로 내보낸다.
    #
    # 대신 무겁다(업종×상권 쌍이 1만 개가 넘는다). 두 가지로 줄인다:
    #   ① 첫 화면과 분리된 별도 파일 — 맞춤 탐색을 열 때만 받는다.
    #   ② 키 이름 없는 배열(컬럼 정의는 cols 에 한 번만). 상권명·자치구·수요는
    #      zone_index.json 에 이미 있으므로 cd 로 이어 붙인다(중복 저장 안 함).
    ALLOUT = os.path.join(FE, "zone_opportunity_all.json")
    all_ind = {}
    for name, rows in ranked_full.items():
        all_ind[name] = [[r["cd"], r["stores"], r["scarce"], r["perf"],
                          r["perf_raw"], round(r["psales"] / 10000)] for r in rows]
    with open(ALLOUT, "w", encoding="utf-8") as f:
        json.dump({"updated": res["updated"], "quarter": res["quarter"],
                   "weights": OPP_W, "shrink_k": SHRINK_K,
                   "cols": ["cd", "stores", "scarce", "perf", "perf_raw", "psales_man"],
                   "note": ("맞춤 탐색(가중치 변경)용 전체 랭킹. 점수를 매긴 상권 전부. "
                            "psales_man 은 점포당 분기매출(만원). 상권명·자치구·수요(dem)는 "
                            "zone_index.json 에서 cd 로 이어 붙인다."),
                   "ind": all_ind}, f, ensure_ascii=False, separators=(",", ":"))
    npair = sum(len(v) for v in all_ind.values())
    print(f"저장: {ALLOUT} · 업종×상권 {npair:,}쌍 · {os.path.getsize(ALLOUT)/1024:.0f}KB")

    for probe in ("커피-음료", "한식음식점", "치킨전문점"):
        d = opp.get(probe)
        if not d:
            continue
        print(f"   [{probe}] 기회 상권 TOP3:")
        for r in d["top"][:3]:
            nm = (zmap.get(r["cd"]) or {}).get("nm", r["cd"])
            print(f"      {r['gu'] or '?'} {nm} · {r['score']}점 "
                  f"(수요 {r['dem']} / 희소 {r['scarce']} / 매출 {r['perf']}) · 점포 {r['stores']}")

    real = {cd: o for cd, o in out.items() if not o.get("weak")}
    print(f"기회(수요>공급) 상위 5 — 점포 {MIN_STORES}개 이상 상권만:")
    for cd, o in sorted(real.items(), key=lambda kv: -kv[1]["gap"])[:5]:
        z = zmap.get(cd, {})
        print(f"   {o.get('gu') or '?'} {z.get('nm', cd)} · 점포 {z.get('stores')} · "
              f"gap +{o['gap']} (수요 {o['dem']} / 공급 {o['sup']})")
    print("과포화(공급>수요) 상위 5:")
    for cd, o in sorted(real.items(), key=lambda kv: kv[1]["gap"])[:5]:
        z = zmap.get(cd, {})
        print(f"   {o.get('gu') or '?'} {z.get('nm', cd)} · 점포 {z.get('stores')} · gap {o['gap']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
