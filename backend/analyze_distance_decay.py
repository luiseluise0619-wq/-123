#!/usr/bin/env python3
"""
역과의 거리에 따라 업종별 점포당 매출이 어떻게 변하는지 실측한다.
(반경 300m/500m/1km 같은 관행적 기준을 쓰지 않고, 데이터로 꺾이는 지점을 찾기 위한 분석)

입력
  1) seoul_trdar_dataset.csv   — build_seoul_dataset.py 산출물.
     필요한 컬럼: TRDAR_CD, 상권 좌표(XCNTS_VALUE, YDNTS_VALUE, EPSG:5181),
                  업종명, 당월 추정매출, 점포 수
  2) 역 좌표                    — collect_subway.py 의 station_master() 와 같은 소스
                                 (subwayStationMaster: BLDN_NM, LAT, LOT).
                                 SEOUL_API_KEY 필요. --stations 로 캐시 파일 지정 가능.

출력
  frontend/distance_decay.json
  { available, quarter, n_zones, n_stations, bin_m,
    ind: { '커피-음료': { bins:[{d_from,d_to,n,median_per_store,index}], breakpoint_m, note }, ... } }

정직 원칙
  · 컬럼을 추측하지 않는다. 없으면 available:false 와 함께 이유를 남기고 종료한다.
  · 표본이 적은 구간(기본 12개 미만)은 계산에서 제외하고 제외 사실을 기록한다.
  · 이 분석은 상관이지 인과가 아니다. 역 근처는 임대료·유동인구도 함께 높다.
    출력에 통제하지 못한 교란요인을 그대로 적어 UI가 인용할 수 있게 한다.

    SEOUL_API_KEY=... python analyze_distance_decay.py --csv seoul_trdar_dataset.csv
    python analyze_distance_decay.py --csv seoul_trdar_dataset.csv --stations stations.json
"""
import os, sys, json, math, time, argparse, datetime
import urllib.request, urllib.parse
import xml.etree.ElementTree as ET

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "frontend", "distance_decay.json")
KEY = os.environ.get("SEOUL_API_KEY", "").strip()
BASE = "http://openapi.seoul.go.kr:8088"

# 상권 좌표계. 서울 상권분석 영역 데이터는 보통 EPSG:5181 (make_map.py 와 동일 가정)
SRC_CRS = "EPSG:5181"

# 컬럼 후보. 서울 상권분석 서비스는 버전에 따라 이름이 조금씩 달라진다.
CAND = {
    "zone": ["TRDAR_CD"],
    "zone_nm": ["TRDAR_CD_NM"],
    "x": ["XCNTS_VALUE", "XCNTS_VAL"],
    "y": ["YDNTS_VALUE", "YDNTS_VAL"],
    "ind": ["SVC_INDUTY_CD_NM", "SVC_INDUTY_NM"],
    "sales": ["THSMON_SELNG_AMT", "SELNG_AMT"],
    "stores": ["STOR_CO", "SIMILR_INDUTY_STOR_CO", "TOT_STOR_CO"],
    "quarter": ["STDR_YYQU_CD"],
}


def pick(df, key, required=True):
    for c in CAND[key]:
        if c in df.columns:
            return c
    if required:
        fail(f"필요한 컬럼을 찾지 못했습니다: {key} (후보 {CAND[key]}). "
             f"CSV 컬럼 예시: {list(df.columns)[:25]}")
    return None


def fail(reason):
    json.dump({"available": False, "reason": reason,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)
    sys.exit(1)


def fetch(service, start, end):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{service}/{start}/{end}/"
    req = urllib.request.Request(url, headers={"User-Agent": "sangkwon-analysis"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")


def station_master():
    """역명 → (lon, lat). collect_subway.py 와 동일한 소스·페이징."""
    coords = {}
    rt = ET.fromstring(fetch("subwayStationMaster", 1, 1))
    total = int(rt.findtext(".//list_total_count") or 0)
    for s in range(1, total + 1, 1000):
        e = min(s + 999, total)
        for attempt in range(4):
            try:
                xml = fetch("subwayStationMaster", s, e)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        for row in ET.fromstring(xml).findall(".//row"):
            nm = (row.findtext("BLDN_NM") or "").strip()
            try:
                lat = float(row.findtext("LAT")); lon = float(row.findtext("LOT"))
            except (TypeError, ValueError):
                continue
            if nm and lat and lon:
                coords.setdefault(nm, (lon, lat))
        time.sleep(0.1)
    return coords


def haversine_m(lon1, lat1, lon2, lat2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="seoul_trdar_dataset.csv")
    ap.add_argument("--stations", help="역 좌표 캐시 JSON {역명:[lon,lat]}. 없으면 API 호출")
    ap.add_argument("--bin", type=int, default=100, help="거리 구간 폭(m)")
    ap.add_argument("--max-d", type=int, default=1500, help="분석 최대 거리(m)")
    ap.add_argument("--min-n", type=int, default=12, help="구간 최소 표본 수")
    ap.add_argument("--crs", default=SRC_CRS)
    args = ap.parse_args()

    df = pd.read_csv(args.csv, low_memory=False)

    c_zone = pick(df, "zone")
    c_x, c_y = pick(df, "x"), pick(df, "y")
    c_ind = pick(df, "ind")
    c_sales = pick(df, "sales")
    c_stores = pick(df, "stores")
    c_q = pick(df, "quarter", required=False)

    # 최신 분기만
    quarter = None
    if c_q:
        quarter = str(sorted(df[c_q].astype(str).unique())[-1])
        df = df[df[c_q].astype(str) == quarter]

    # 상권 좌표 → 위경도
    try:
        from pyproj import Transformer
    except ImportError:
        fail("pyproj 가 필요합니다: pip install pyproj (make_map.py 와 동일 의존성)")
    tf = Transformer.from_crs(args.crs, "EPSG:4326", always_xy=True)

    zones = df.groupby(c_zone).agg(x=(c_x, "first"), y=(c_y, "first")).reset_index()
    lon, lat = tf.transform(zones["x"].astype(float).values, zones["y"].astype(float).values)
    zones["lon"], zones["lat"] = lon, lat
    zones = zones[(zones["lat"].between(37.3, 37.75)) & (zones["lon"].between(126.7, 127.3))]
    if zones.empty:
        fail(f"좌표 변환 결과가 서울 범위를 벗어났습니다. --crs 를 EPSG:5186 등으로 바꿔 보세요 (현재 {args.crs}).")

    # 역 좌표
    if args.stations:
        raw = json.load(open(args.stations, encoding="utf-8"))
        coords = {k: (float(v[0]), float(v[1])) for k, v in raw.items()}
    else:
        if not KEY:
            fail("SEOUL_API_KEY 가 없고 --stations 캐시도 없습니다.")
        coords = station_master()
    if not coords:
        fail("역 좌표를 0개 확보했습니다.")

    # 각 상권 → 가장 가까운 역까지의 거리
    st = list(coords.items())
    dist = {}
    for _, z in zones.iterrows():
        best, best_nm = 1e18, None
        for nm, (slon, slat) in st:
            d = haversine_m(z["lon"], z["lat"], slon, slat)
            if d < best:
                best, best_nm = d, nm
        dist[z[c_zone]] = (best, best_nm)

    # 점포당 매출
    g = df.groupby([c_zone, c_ind]).agg(sales=(c_sales, "sum"), stores=(c_stores, "sum")).reset_index()
    g = g[(g["stores"] > 0) & (g["sales"] > 0)]
    g["per_store"] = g["sales"] / g["stores"]
    g["dist_m"] = g[c_zone].map(lambda z: dist.get(z, (None, None))[0])
    g = g[g["dist_m"].notna() & (g["dist_m"] <= args.max_d)]
    if g.empty:
        fail("거리·매출이 함께 있는 행이 없습니다.")

    result = {}
    for ind, sub in g.groupby(c_ind):
        if len(sub) < args.min_n * 3:
            continue
        bins, dropped = [], 0
        base = None
        for start in range(0, args.max_d, args.bin):
            part = sub[(sub["dist_m"] >= start) & (sub["dist_m"] < start + args.bin)]
            if len(part) < args.min_n:
                dropped += len(part)
                continue
            med = float(part["per_store"].median())
            if base is None:
                base = med
            bins.append({"d_from": start, "d_to": start + args.bin, "n": int(len(part)),
                         "median_per_store": round(med), "index": round(med / base * 100, 1)})
        if len(bins) < 3:
            continue
        # 꺾이는 지점: 첫 구간 대비 80% 아래로 처음 떨어지고, 그 뒤로 회복하지 않는 지점
        breakpoint_m = None
        for i, b in enumerate(bins):
            if b["index"] < 80 and all(x["index"] < 90 for x in bins[i:]):
                breakpoint_m = b["d_from"]
                break
        result[ind] = {
            "bins": bins, "breakpoint_m": breakpoint_m,
            "dropped_rows_small_bins": dropped,
            "note": "첫 구간(가장 가까운 구간)을 100으로 둔 상대지수. "
                    "표본 12개 미만 구간은 제외했습니다."
        }

    if not result:
        fail("업종별 표본이 부족해 구간을 만들 수 없었습니다. --bin 을 200 이상으로 늘려 보세요.")

    out = {
        "available": True,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "quarter": quarter,
        "bin_m": args.bin, "max_d_m": args.max_d, "min_n": args.min_n,
        "n_zones": int(len(zones)), "n_stations": len(coords),
        "method": "상권 대표좌표에서 가장 가까운 지하철역까지의 직선거리 기준. "
                  "업종별로 거리 구간별 점포당 추정매출 중위값을 계산.",
        "limits": [
            "상권 좌표는 상권의 대표점 하나이므로, 상권 크기만큼 거리 오차가 있습니다.",
            "직선거리입니다. 실제 도보 경로는 더 깁니다.",
            "역 근처는 임대료와 유동인구도 함께 높습니다. 이 분석은 거리 효과만 분리하지 못합니다.",
            "상관관계이며 인과관계가 아닙니다. '역에서 멀면 매출이 낮다'가 아니라 "
            "'역에서 먼 상권의 점포당 매출 중위값이 낮게 관측된다'로 읽어야 합니다.",
            "매출은 카드 기반 추정값이며 개별 점포 실적이 아닙니다."
        ],
        "ind": result
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)}개 · 역 {len(coords)}개 · 업종 {len(result)}개")
    for ind, r in list(result.items())[:10]:
        bp = f"{r['breakpoint_m']}m 부터 꺾임" if r["breakpoint_m"] else "꺾이는 지점 없음"
        print(f"  {ind}: 구간 {len(r['bins'])}개 · {bp}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
