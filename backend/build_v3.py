#!/usr/bin/env python3
"""
v3 데이터 조립기 — 수집기 산출물 → frontend/data/v3/ (화면이 실제로 읽는 10개 파일).

왜 이 단계가 따로 필요한가
--------------------------
수집기들은 `frontend/` 에 원천·중간 파일 35개를 만든다(trade_zones, zone_intel,
seoul_dong.geojson 처럼 화면이 직접 쓰지 않는 것도 많다).
반면 통합 배포본의 화면은 `frontend/data/v3/` 의 **10개만** 읽는다.
그 사이를 잇는 게 이 파일이다. 무엇이 배포에 나가는지 한 곳에서 정한다.

설계 원칙 — 지리는 지키고, 분기마다 바뀌는 것만 갱신한다
--------------------------------------------------------
처음에는 자치구 경계(seoul_gu.geojson)로 상권→자치구를 다시 계산했다. **틀렸다.**
그 결과가 기존 v3 와 121곳(7.7%)이나 어긋났다. 대조해 보니:

    기존 v3 zone_gu  vs  zone_intel(행정동 경계)  →  99.8% 일치
    다시 계산한 것    vs  zone_intel               →  92.3% 일치

즉 기존 v3 가 맞고 내 재계산이 틀렸다. seoul_gu.geojson 이 더 거친 경계라
구 경계에 붙은 상권을 옆 구로 보내고 있었다.

그래서 규칙을 이렇게 정한다:
  · 상권→자치구는 **zone_intel.json 의 것을 그대로 쓴다.** 이미 행정동 경계로
    판정했고 check_data.py 의 무결성 검사도 통과한 값이다. 파이프라인 전체가
    같은 매핑을 쓰게 되어 기회 점수와 화면이 어긋날 일도 없다.
  · 자치구 SVG 경로(seoul_map.gus)와 경계 상권(zone_border)은 **고정 지리**다.
    분기가 바뀐다고 구 경계가 움직이지 않는다. 기존 파일을 그대로 지킨다.
    다시 그리면 지도가 미세하게 밀려 화면이 바뀐다.
  · 상권 점(seoul_map.pts)만 갱신한다. 상권 목록은 분기마다 바뀔 수 있다.
    이때 투영은 **기존 점들에서 되찾는다** — 기존 (위경도 ↔ 화면좌표) 짝에
    직선을 맞추면 원래 투영이 그대로 복원된다(실측 오차 0.005/100눈금).
    새 좌표계를 지어내면 지도 위 점이 전부 밀린다.

    python build_v3.py
    python build_v3.py --check    # 무엇이 있고 무엇이 없는지만 본다
"""
import os, sys, json, math, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FE = os.path.join(ROOT, "frontend")
V3 = os.path.join(FE, "data", "v3")

# 화면이 그대로 읽는 것 — 수집기 산출물을 복사만 한다(형식이 이미 같음을 대조로 확인).
PASSTHROUGH = ["income.json", "rent.json", "sales_by_industry.json",
               "sales_history.json", "stores_by_industry.json", "zone_industry.json"]

# 분기가 바뀌어도 움직이지 않는 것 — 있으면 손대지 않는다.
FIXED_GEO = ["zone_border.json"]


def r0(v):
    """0.5 를 올림하는 반올림(JS Math.round 와 같음).

    파이썬 기본 round() 는 0.5 를 짝수로 보낸다(round(822.5)=822, round(823.5)=824).
    기존 배포본은 JS 로 만들어져 0.5 를 항상 올렸다. 그대로 두면 값이 ±1 씩
    어긋나 '데이터가 바뀐 것처럼' 보인다 — 실제로는 같은 수인데.
    """
    return math.floor((v or 0) + 0.5)


def r2(v):
    """소수 둘째 자리까지, 역시 0.5 올림."""
    return math.floor((v or 0) * 100 + 0.5) / 100.0


def load(path, quiet=False):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as ex:
        if not quiet:
            print(f"  ! 읽기 실패: {os.path.basename(path)} ({ex})")
        return None


def fit_line(xs, ys):
    """최소제곱 직선 y = a*x + b. 점이 2개 미만이면 None."""
    n = len(xs)
    if n < 2:
        return None
    sx, sy = sum(xs), sum(ys)
    sxx = sum(x * x for x in xs)
    sxy = sum(x * y for x, y in zip(xs, ys))
    den = n * sxx - sx * sx
    if den == 0:
        return None
    a = (n * sxy - sx * sy) / den
    return a, (sy - a * sx) / n


def recover_projection(old_pts, zmap):
    """기존 seoul_map.pts 와 상권 좌표로 원래 투영을 되찾는다.

    투영은 위경도에 대해 아핀(px=a·lon+b, py=c·lat+d)이라 직선 맞춤으로 정확히 복원된다.
    되찾지 못하면 None 을 돌려주고, 부르는 쪽은 점을 건드리지 않는다 —
    좌표계를 새로 지어내느니 옛 점을 그대로 두는 편이 낫다.
    """
    lon, lat, px, py = [], [], [], []
    for cd, xy in (old_pts or {}).items():
        z = zmap.get(cd)
        if z and z.get("lon") is not None and z.get("lat") is not None and len(xy) == 2:
            lon.append(z["lon"]); px.append(xy[0])
            lat.append(z["lat"]); py.append(xy[1])
    if len(lon) < 50:
        return None
    fx, fy = fit_line(lon, px), fit_line(lat, py)
    if not fx or not fy:
        return None
    # 되찾은 식이 기존 점들을 실제로 재현하는지 확인한다. 안 되면 쓰지 않는다.
    err = max(max(abs(fx[0] * l + fx[1] - p) for l, p in zip(lon, px)),
              max(abs(fy[0] * l + fy[1] - p) for l, p in zip(lat, py)))
    if err > 0.05:
        print(f"  ! 투영 복원 오차 {err:.3f} — 너무 큽니다. 기존 점을 그대로 둡니다.")
        return None
    return (lambda lo, la: [r2(fx[0] * lo + fx[1]), r2(fy[0] * la + fy[1])]), err


def main():
    check = "--check" in sys.argv
    tz = load(os.path.join(FE, "trade_zones.json"))
    intel = load(os.path.join(FE, "zone_intel.json"))
    lp = load(os.path.join(FE, "livepop_dong.json"), quiet=True)
    old_map = load(os.path.join(V3, "seoul_map.json"), quiet=True)

    if check:
        for n in PASSTHROUGH:
            print(f"  {'있음' if os.path.exists(os.path.join(FE, n)) else '없음'}  {n}")
        print(f"  trade_zones {'있음' if tz else '없음'} · zone_intel {'있음' if intel else '없음'}"
              f" · livepop {'있음' if lp else '없음'} · 기존 seoul_map {'있음' if old_map else '없음'}")
        return 0

    os.makedirs(V3, exist_ok=True)
    made, kept = [], []

    # ── ① 그대로 나가는 6개 ──
    for n in PASSTHROUGH:
        src = os.path.join(FE, n)
        if os.path.exists(src):
            shutil.copyfile(src, os.path.join(V3, n)); made.append(n)
        else:
            # 수집이 실패한 분기에 멀쩡한 v3 파일을 지우지 않는다(collect_util 과 같은 원칙).
            kept.append(n)

    # ── ② 상권 → 자치구 : zone_intel 의 판정을 그대로 쓴다 ──
    if intel and intel.get("zones"):
        zone_gu = {cd: v["gu"] for cd, v in intel["zones"].items() if v.get("gu")}
        json.dump({"source": "zone_intel.json (행정동 경계 점-다각형 판정) 의 자치구 매핑",
                   "n": len(zone_gu), "gu": zone_gu},
                  open(os.path.join(V3, "zone_gu.json"), "w", encoding="utf-8"), ensure_ascii=False)
        made.append(f"zone_gu.json({len(zone_gu)})")
    else:
        zone_gu = (load(os.path.join(V3, "zone_gu.json"), quiet=True) or {}).get("gu", {})
        kept.append("zone_gu.json")

    # ── ③ 상권 → 생활인구 ──
    #
    # 여기서도 지리와 수치를 가른다. 상권이 어느 동네에 속하는지는 **고정 지리**라
    # 분기마다 바뀌지 않는다. 바뀌는 건 그 동네의 생활인구 **수치**다.
    #
    # 왜 다시 판정하지 않나: zone_intel 의 동 매핑으로 새로 만들어 봤더니 기존 v3 와
    # 62%가 달라졌다(상권 958곳의 동네 이름과 인구가 바뀐다 = 화면이 바뀐다).
    # 둘 다 경계 판정이고 어느 쪽이 틀렸다고 할 근거가 없다 — 구 경계에 걸친 상권을
    # 어느 쪽으로 보내느냐의 차이다. 그렇다면 **이미 나가 있는 배정을 지키는 것**이 맞다.
    # 기존에 없던 상권만 zone_intel 로 채운다.
    old_lp = (load(os.path.join(V3, "zone_livepop.json"), quiet=True) or {}).get("zone", {})
    if lp and lp.get("dong"):
        by_name = {}
        for rec in lp["dong"].values():
            if rec.get("gu") and rec.get("dong"):
                by_name[(rec["gu"], rec["dong"])] = rec

        def shape(rec, gu, dong):
            return {"dong": dong, "tot": r0(rec.get("tot")), "gu": gu,
                    "age": [r0(rec.get(k)) for k in ("a10", "a20", "a30", "a40", "a50", "a60")],
                    "m": r0(rec.get("m")), "f": r0(rec.get("f"))}

        zone_lp, refreshed, added, stale = {}, 0, 0, 0
        for cd, old in old_lp.items():                       # ① 기존 배정 유지 + 수치 갱신
            rec = by_name.get((old.get("gu"), old.get("dong")))
            if rec:
                zone_lp[cd] = shape(rec, old["gu"], old["dong"]); refreshed += 1
            else:
                zone_lp[cd] = old; stale += 1                # 그 동의 새 수치가 없으면 옛 값 유지
        if intel and intel.get("zones"):                     # ② 새로 생긴 상권만 채운다
            for cd, v in intel["zones"].items():
                if cd in zone_lp:
                    continue
                rec = by_name.get((v.get("gu"), v.get("dong")))
                if rec:
                    zone_lp[cd] = shape(rec, v["gu"], v["dong"]); added += 1
        print(f"  생활인구: 수치 갱신 {refreshed} · 새 상권 {added} · 새 수치 없어 유지 {stale}")
        if zone_lp:
            json.dump({"source": "서울 열린데이터광장 생활인구 · 상권→행정동 배정은 기존 배포본을 유지",
                       "n": len(zone_lp), "zone": zone_lp},
                      open(os.path.join(V3, "zone_livepop.json"), "w", encoding="utf-8"), ensure_ascii=False)
            made.append(f"zone_livepop.json({len(zone_lp)})")
        else:
            kept.append("zone_livepop.json")
    else:
        kept.append("zone_livepop.json")

    # ── ④ 지도 : 자치구 경로는 그대로, 상권 점만 갱신 ──
    if old_map and old_map.get("gus"):
        zmap = {str(z["cd"]): z for z in (tz or {}).get("zones", [])}
        got = recover_projection(old_map.get("pts"), zmap) if zmap else None
        if got:
            P, err = got
            pts = {cd: P(z["lon"], z["lat"]) for cd, z in zmap.items()
                   if z.get("lon") is not None and z.get("lat") is not None}
            new_map = dict(old_map, pts=pts)          # gus(자치구 경로)는 손대지 않는다
            json.dump(new_map, open(os.path.join(V3, "seoul_map.json"), "w", encoding="utf-8"),
                      ensure_ascii=False)
            made.append(f"seoul_map.json(점 {len(pts)} 갱신·투영 오차 {err:.3f})")
        else:
            kept.append("seoul_map.json")
    else:
        kept.append("seoul_map.json")

    # ── ⑤ 고정 지리 ──
    for n in FIXED_GEO:
        kept.append(n)

    print("갱신:", " · ".join(made) or "없음")
    print("유지:", " · ".join(kept) or "없음", "  (분기마다 안 바뀌거나 입력이 없어 그대로 둠)")
    print("저장 위치:", V3)
    return 0


if __name__ == "__main__":
    sys.exit(main())
