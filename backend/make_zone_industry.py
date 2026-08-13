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
  rows 는 매출 상위 TOP_N 업종만(파일 크기 상한). unit=객단가(원, sales/건수), 건수 없으면 0.

CSV 가 없거나 컬럼을 못 찾으면 available:false 로 남기고 정상 종료(화면은 요약으로 동작).
시간대/요일/성별/연령 세분은 이 파일에 넣지 않는다(상권×업종×세분 = 수 MB 폭증).
그 세분은 sales_by_industry.json(서울 전체 업종 평균)에 이미 있고, 화면에서 그 범위를 명시한다.
"""
import os, sys, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV  = os.path.join(HERE, "app", "data", "real_data", "seoul_trdar_dataset.csv")
OUT  = os.path.join(ROOT, "frontend", "zone_industry.json")

TOP_N = 15   # 상권당 매출 상위 업종 수(파일 크기 상한 ~ 1MB 내)

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
            z = zones[cd] = {"nm": (str(row[c_nm]).strip() if c_nm else cd), "ind": {}}
        a = z["ind"].get(ind)
        if a is None:
            a = z["ind"][ind] = {"stores": 0.0, "sales": 0.0, "cnt": 0.0}
        a["sales"] += sales
        a["stores"] += fnum(row[c_stores]) if c_stores else 0.0
        a["cnt"] += fnum(row[c_cnt]) if c_cnt else 0.0

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
        rows = rows[:TOP_N]
        out_zones[cd] = {
            "nm": z["nm"],
            "rows": [[idx_of(name), st, sa, un] for (name, st, sa, un) in rows],
        }

    inds = [None] * len(ind_index)
    for name, i in ind_index.items():
        inds[i] = name

    json.dump({"available": True, "quarter": quarter,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
               "n_zones": len(out_zones), "n_inds": len(inds),
               "note": "상권×업종 추정매출·점포·객단가(원천 상권분석서비스). 상권당 매출 상위 %d개 업종." % TOP_N,
               "inds": inds, "zones": out_zones},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(out_zones)}개 · 업종 {len(inds)}종 · 분기 {quarter}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
