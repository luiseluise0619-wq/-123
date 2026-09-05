#!/usr/bin/env python3
"""
상권 좌표 마커 레이어 생산기.

build_seoul_dataset.py 가 만든 seoul_trdar_dataset.csv 에서
상권(TRDAR_CD) 단위 좌표·점포·매출을 뽑아 프론트용 JSON 으로 저장한다.
좌표는 EPSG:5181(서울 상권분석 영역) → WGS84 로 재투영(analyze_distance_decay.py 와 동일 가정).

출력: frontend/trade_zones.json
  { available, quarter, n_zones, updated,
    zones:[ {cd, nm, lon, lat, stores, sales, top:[{ind,stores}]} ... ] }
CSV 가 없거나 컬럼을 못 찾으면 available:false 로 남기고 정상 종료(지도는 계속 동작).
"""
import os, sys, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV  = os.path.join(HERE, "app", "data", "real_data", "seoul_trdar_dataset.csv")
OUT  = os.path.join(ROOT, "frontend", "trade_zones.json")
SRC_CRS = "EPSG:5181"

# analyze_distance_decay.py 와 동일한 컬럼 후보(서비스 버전마다 이름이 다름).
CAND = {
    "zone":    ["TRDAR_CD"],
    "zone_nm": ["TRDAR_CD_NM"],
    "x":       ["XCNTS_VALUE", "XCNTS_VAL"],
    "y":       ["YDNTS_VALUE", "YDNTS_VAL"],
    "ind":     ["SVC_INDUTY_CD_NM", "SVC_INDUTY_NM"],
    "sales":   ["THSMON_SELNG_AMT", "SELNG_AMT"],
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
    if required:
        return None
    return None


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

    c_zone = pick(df, "zone");  c_x = pick(df, "x");  c_y = pick(df, "y")
    if not (c_zone and c_x and c_y):
        write_unavailable(f"필수 컬럼 없음(zone/x/y). 컬럼: {list(df.columns)[:25]}")
        return 0
    c_nm = pick(df, "zone_nm", False); c_ind = pick(df, "ind", False)
    c_sales = pick(df, "sales", False); c_stores = pick(df, "stores", False)
    c_q = pick(df, "quarter", False)

    # 최신 분기만.
    quarter = None
    if c_q:
        qs = df[c_q].dropna()
        if len(qs):
            quarter = str(sorted(qs.unique())[-1])
            df = df[df[c_q] == quarter]

    def fnum(s):
        try: return float(str(s).replace(",", ""))
        except (TypeError, ValueError): return 0.0

    # 좌표 재투영(5181 → 4326). 상권 하나당 좌표는 동일하므로 유니크 좌표만 변환.
    try:
        from pyproj import Transformer
    except ImportError:
        write_unavailable("pyproj 필요: pip install pyproj")
        return 0
    tf = Transformer.from_crs(SRC_CRS, "EPSG:4326", always_xy=True)

    zones = {}
    for _, row in df.iterrows():
        cd = str(row[c_zone]).strip()
        if not cd or cd == "nan":
            continue
        x = fnum(row[c_x]); y = fnum(row[c_y])
        if x <= 0 or y <= 0:
            continue
        z = zones.get(cd)
        if z is None:
            z = zones[cd] = {"cd": cd, "nm": (str(row[c_nm]).strip() if c_nm else cd),
                             "x": x, "y": y, "stores": 0.0, "sales": 0.0, "ind": {}}
        st = fnum(row[c_stores]) if c_stores else 0.0
        z["stores"] += st
        if c_sales:
            z["sales"] += fnum(row[c_sales])
        if c_ind:
            ind = str(row[c_ind]).strip()
            if ind and ind != "nan":
                z["ind"][ind] = z["ind"].get(ind, 0.0) + st

    if not zones:
        write_unavailable("유효한 상권 좌표 행이 없음")
        return 0

    out_zones = []
    for z in zones.values():
        lon, lat = tf.transform(z["x"], z["y"])
        if not (124 < lon < 132 and 33 < lat < 39):   # 대한민국 밖이면 좌표계 오인 → 스킵
            continue
        top = sorted(z["ind"].items(), key=lambda kv: kv[1], reverse=True)[:5]
        out_zones.append({
            "cd": z["cd"], "nm": z["nm"],
            "lon": round(lon, 6), "lat": round(lat, 6),
            "stores": round(z["stores"]),
            "sales": round(z["sales"]),
            "top": [{"ind": k, "stores": round(v)} for k, v in top if v > 0],
        })
    out_zones.sort(key=lambda r: r["stores"], reverse=True)

    if not out_zones:
        write_unavailable("재투영 후 국내 좌표 상권이 없음(좌표계 확인 필요)")
        return 0

    json.dump({"available": True, "quarter": quarter,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
               "n_zones": len(out_zones),
               "note": "서울 상권분석 영역 중심좌표(EPSG:5181→WGS84). 점포·매출은 상권×업종 합산.",
               "zones": out_zones},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(out_zones)}개 · 분기 {quarter}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
