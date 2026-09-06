#!/usr/bin/env python3
"""
상권 × 업종 세부 레이어 생산기.

make_trade_zones.py 는 상권 '합계'만 남기고 업종 축을 버린다(대표 업종 top5 만).
collect_sales.py 는 업종별 서울 '전체' 패턴만 남기고 상권 축을 버린다.
→ 이 스크립트는 둘이 버린 축을 살려, 같은 CSV(seoul_trdar_dataset.csv)에서
   상권 × 업종 그레인으로 점포·추정매출·객단가를 뽑아 프론트용 JSON 으로 저장한다.

출력: frontend/zone_industry.json
  { available, quarter, updated, n_zones, n_inds,
    inds:[업종명, ...],                         # 업종명 인터닝(중복 문자열 제거)
    zones:{ "<cd>":{ nm, rows:[[indIdx, stores, sales, unit], ...] } } }
  rows 는 그 상권에서 매출이 잡히는 업종 전부(매출 상위순). unit=객단가(원, sales/건수), 건수 없으면 0.

CSV 가 없거나 컬럼을 못 찾으면 available:false 로 남기고 정상 종료(화면은 요약으로 동작).

시간대·요일은 '상권 합계'로만 넣는다 — 업종별로는 넣지 않는다
------------------------------------------------------------
원천 CSV 는 상권×업종마다 시간대 6구간·요일 7일 매출을 준다. 이걸 업종 축까지
살려서 넣으면 (상권 1,564 × 업종 15 × 13칸) 이라 파일이 수 MB 로 폭증한다.
그런데 사장님이 실제로 묻는 것은 대개 **"이 자리가 저녁 장사가 되는 동네인가"**이지
"이 자리의 이 업종이 저녁 장사인가"가 아니다. 그래서 업종 축은 접고
**상권마다 13칸(시간대 6 + 요일 7) 구성비만** 더한다 — 1,564 × 13 이라 증가분이 작다.
업종별 시간대 패턴은 sales_by_industry.json(서울 전체 평균)에 이미 있으므로,
"이 상권은 저녁형" × "이 업종은 저녁형" 을 화면에서 겹쳐 보면 된다.

원천에 해당 컬럼이 없으면 tmz/dow 를 그냥 넣지 않는다(있던 동작 그대로).
"""
import os, sys, json, gzip, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV  = os.path.join(HERE, "app", "data", "real_data", "seoul_trdar_dataset.csv")
OUT  = os.path.join(ROOT, "frontend", "zone_industry.json")

# 상권당 담을 업종 수 상한. 0 이면 상한 없음(그 상권에서 매출이 잡히는 업종 전부).
#
# 왜 상한을 없앴나 (2026-09-06)
# ------------------------------
# 예전 값은 15였다. 그런데 이 상한은 "데이터가 없다"와 구분되지 않는 형태로 화면에 나온다.
# 치킨전문점은 1,564곳 중 226곳(14%)에만 데이터가 있는 것처럼 보였는데, 한국에서
# 치킨집 없는 동네가 14%일 리가 없다. 원인은 수집이 아니라 이 상한이었다 —
# 치킨집이 그 상권 매출 15위 안에 못 들면 화면에서는 '데이터 없음'이 된다.
# 실측: 1,564곳 중 584곳(37%)이 정확히 15종에서 잘려 있었다.
#
# 크기는 재보고 결정했다(서버가 .json 을 gzip 으로 보낸다 — server/static.js):
#   현재(15종)            원본  415KB → gzip 180KB
#   상한 없음(최악 62종)   원본 1,011KB → gzip 451KB
# 최악의 경우가 원래 두었던 1MB 예산 안에 들어오고, 실제로는 대부분의 상권이
# 62종을 다 갖고 있지 않으므로 이보다 작다. 첫 화면(히어로)은 이 파일을 기다리지 않고,
# 재방문은 ETag 로 304 라 다시 받지 않는다.
#
# 실제 크기는 아래에서 출력한다 — CI 로그에서 확인하고, 너무 크면 이 값만 되돌리면 된다.
TOP_N = 0

# make_trade_zones / collect_sales 와 동일한 컬럼 후보(서비스 버전마다 이름 다름).
CAND = {
    "zone":    ["TRDAR_CD"],
    "zone_nm": ["TRDAR_CD_NM"],
    "ind":     ["SVC_INDUTY_CD_NM", "SVC_INDUTY_NM"],
    "sales":   ["THSMON_SELNG_AMT", "SELNG_AMT"],
    "cnt":     ["THSMON_SELNG_CO", "SELNG_CO"],
    "stores":  ["STOR_CO", "SIMILR_INDUTY_STOR_CO", "TOT_STOR_CO"],
    "quarter": ["STDR_YYQU_CD"],
}

# 시간대·요일 매출 컬럼(원천에 있을 때만 쓴다).
# 이름은 app/data/collectors/seoul_trdar_client.py 의 TMZON_COLS·DOW_COLS 와 같아야 한다.
TMZ_COLS = ["TMZON_00_06_SELNG_AMT", "TMZON_06_11_SELNG_AMT", "TMZON_11_14_SELNG_AMT",
            "TMZON_14_17_SELNG_AMT", "TMZON_17_21_SELNG_AMT", "TMZON_21_24_SELNG_AMT"]
DOW_COLS = ["MON_SELNG_AMT", "TUES_SELNG_AMT", "WED_SELNG_AMT", "THUR_SELNG_AMT",
            "FRI_SELNG_AMT", "SAT_SELNG_AMT", "SUN_SELNG_AMT"]
TMZ_LABELS = ["00-06", "06-11", "11-14", "14-17", "17-21", "21-24"]
DOW_LABELS = ["월", "화", "수", "목", "금", "토", "일"]


def pct_of(vals):
    """[금액,...] → [구성비 %,...]. 합이 0이면 None(0% 라고 지어내지 않는다)."""
    tot = sum(vals)
    if tot <= 0:
        return None
    return [round(v / tot * 100, 1) for v in vals]


def write_unavailable(reason):
    json.dump({"available": False, "reason": reason,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)


def pick(df, key, required=True):
    for c in CAND[key]:
        if c in df.columns:
            return c
    return None


def fnum(s):
    try:
        return float(str(s).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def main():
    if not os.path.exists(CSV):
        write_unavailable(f"CSV 없음: {CSV} (build_seoul_dataset.py --build 먼저 실행)")
        return 0
    try:
        import pandas as pd
    except ImportError:
        write_unavailable("pandas 필요")
        return 0

    df = pd.read_csv(CSV, dtype=str, encoding="utf-8-sig", low_memory=False)
    if df.empty:
        write_unavailable("CSV 비어있음")
        return 0

    c_zone = pick(df, "zone"); c_ind = pick(df, "ind"); c_sales = pick(df, "sales")
    if not (c_zone and c_ind and c_sales):
        write_unavailable(f"필수 컬럼 없음(zone/ind/sales). 컬럼: {list(df.columns)[:25]}")
        return 0
    c_nm = pick(df, "zone_nm", False); c_cnt = pick(df, "cnt", False)
    c_stores = pick(df, "stores", False); c_q = pick(df, "quarter", False)
    # 시간대·요일은 원천에 전부 있을 때만 쓴다. 일부만 있으면 구성비가 왜곡되므로 통째로 접는다.
    tmz_cols = TMZ_COLS if all(c in df.columns for c in TMZ_COLS) else None
    dow_cols = DOW_COLS if all(c in df.columns for c in DOW_COLS) else None
    print(f"  시간대 컬럼 {'있음' if tmz_cols else '없음 — 생략'} · "
          f"요일 컬럼 {'있음' if dow_cols else '없음 — 생략'}")

    # 최신 분기만.
    quarter = None
    if c_q:
        qs = df[c_q].dropna()
        if len(qs):
            quarter = str(sorted(qs.unique())[-1])
            df = df[df[c_q] == quarter]

    # 상권 × 업종 누적(같은 grain 이 여러 행이면 합산).
    zones = {}   # cd -> {nm, ind: {name: {stores, sales, cnt}}}
    for _, row in df.iterrows():
        cd = str(row[c_zone]).strip()
        ind = str(row[c_ind]).strip()
        if not cd or cd == "nan" or not ind or ind == "nan":
            continue
        sales = fnum(row[c_sales])
        if sales <= 0:
            continue
        z = zones.get(cd)
        if z is None:
            z = zones[cd] = {"nm": (str(row[c_nm]).strip() if c_nm else cd), "ind": {},
                             "tmz": [0.0] * len(TMZ_COLS), "dow": [0.0] * len(DOW_COLS)}
        a = z["ind"].get(ind)
        if a is None:
            a = z["ind"][ind] = {"stores": 0.0, "sales": 0.0, "cnt": 0.0}
        a["sales"] += sales
        a["stores"] += fnum(row[c_stores]) if c_stores else 0.0
        a["cnt"] += fnum(row[c_cnt]) if c_cnt else 0.0
        # 시간대·요일은 업종을 가리지 않고 상권 전체로 합산한다(위 머리말의 설계 결정).
        if tmz_cols:
            for i, c in enumerate(tmz_cols): z["tmz"][i] += fnum(row[c])
        if dow_cols:
            for i, c in enumerate(dow_cols): z["dow"][i] += fnum(row[c])

    if not zones:
        write_unavailable("유효한 상권×업종 행이 없음")
        return 0

    # 업종명 인터닝(중복 문자열 제거 → 파일 크기 축소).
    ind_index = {}
    def idx_of(name):
        if name not in ind_index:
            ind_index[name] = len(ind_index)
        return ind_index[name]

    out_zones = {}
    for cd, z in zones.items():
        rows = []
        for name, a in z["ind"].items():
            unit = round(a["sales"] / a["cnt"]) if a["cnt"] > 0 else 0
            rows.append((name, round(a["stores"]), round(a["sales"]), unit))
        rows.sort(key=lambda r: r[2], reverse=True)   # 매출 상위
        if TOP_N:
            rows = rows[:TOP_N]
        rec = {
            "nm": z["nm"],
            "rows": [[idx_of(name), st, sa, un] for (name, st, sa, un) in rows],
        }
        # 구성비가 안 나오면(매출 0) 키를 넣지 않는다 — 화면이 '없음'과 '0%'를 구분할 수 있게.
        if tmz_cols:
            p = pct_of(z["tmz"])
            if p: rec["tmz"] = p
        if dow_cols:
            p = pct_of(z["dow"])
            if p: rec["dow"] = p
        out_zones[cd] = rec

    inds = [None] * len(ind_index)
    for name, i in ind_index.items():
        inds[i] = name

    json.dump({"available": True, "quarter": quarter,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
               "n_zones": len(out_zones), "n_inds": len(inds),
               "note": ("상권×업종 추정매출·점포·객단가(원천 상권분석서비스). %s "
                        "tmz/dow 는 그 상권 '전 업종 합계'의 시간대·요일 매출 구성비(%%)이며 "
                        "업종별 구분이 아니다 — 업종별 패턴은 sales_by_industry.json(서울 평균)에 있다."
                        % ("상권당 매출 상위 %d개 업종." % TOP_N if TOP_N
                           else "상권마다 매출이 잡히는 업종 전부(상한 없음).")),
               **({"tmz_labels": TMZ_LABELS} if tmz_cols else {}),
               **({"dow_labels": DOW_LABELS} if dow_cols else {}),
               "inds": inds, "zones": out_zones},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)

    # 크기를 로그에 남긴다 — 상한을 없앴으므로 실제로 얼마가 되는지 사람이 봐야 한다.
    # 서버가 .json 을 gzip 으로 보내므로(server/static.js) 전송 크기까지 함께 적는다.
    n_rows = sum(len(z["rows"]) for z in out_zones.values())
    raw = os.path.getsize(OUT)
    with open(OUT, "rb") as f:
        gz = len(gzip.compress(f.read(), 9))
    mx = max((len(z["rows"]) for z in out_zones.values()), default=0)
    print(f"저장: {OUT} · 상권 {len(out_zones)}개 · 업종 {len(inds)}종 · 분기 {quarter}")
    print(f"  행 {n_rows:,}개 · 상권당 최다 {mx}종 · "
          f"원본 {raw/1024:.0f}KB → 전송(gzip) {gz/1024:.0f}KB")
    if gz > 700 * 1024:
        print(f"  ⚠ 전송 크기가 700KB 를 넘었다. make_zone_industry.py 의 TOP_N 에 "
              f"상한을 다시 넣는 것을 검토할 것(예: TOP_N = 40).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
