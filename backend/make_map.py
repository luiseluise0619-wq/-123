"""
상권 지도 생성 — 네 PC의 실데이터로 '진짜 지도' HTML을 만든다.

수집한 seoul_trdar_dataset.csv 에는 영역 데이터의 좌표(XCNTS_VALUE, YDNTS_VALUE,
좌표계 EPSG:5181)가 들어있다. 이걸 위경도(WGS84)로 변환해, 상권별 매출 등급을
색으로 찍은 Leaflet 지도(folium)를 만든다. 브라우저로 열면 실제 지도 위에 표시됨
(아티팩트와 달리 로컬 브라우저는 지도 타일 접근 가능).

사용:
  pip install folium pyproj pandas
  python make_map.py                       # 전체 업종 합산 등급 지도
  python make_map.py --industry 커피-음료   # 특정 업종만
출력: seoul_sangkwon_map.html  (더블클릭해서 브라우저로 열기)
"""

import argparse
import os
import sys
import pandas as pd

CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "app", "data", "real_data", "seoul_trdar_dataset.csv")
GRADE_COLOR = {"A+": "#16a34a", "A": "#22c55e", "B": "#38bdf8",
               "C": "#f59e0b", "D": "#fb7185", "F": "#dc2626"}


def to_grade(p):
    return ("A+" if p >= .95 else "A" if p >= .85 else "B" if p >= .65
            else "C" if p >= .4 else "D" if p >= .2 else "F")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", default=CSV)
    ap.add_argument("--industry", default="", help="특정 업종명(부분일치). 비우면 전체 합산")
    ap.add_argument("--crs", default="EPSG:5181", help="원본 좌표계(서울 상권은 보통 5181)")
    ap.add_argument("--out", default="seoul_sangkwon_map.html")
    args = ap.parse_args()

    if not os.path.exists(args.csv):
        print(f"CSV 없음: {args.csv}\n먼저 build_seoul_dataset.py --build 로 수집하세요."); sys.exit(1)
    try:
        import folium
        from pyproj import Transformer
    except Exception:
        print("설치 필요:  pip install folium pyproj"); sys.exit(1)

    print("[1] 데이터 로드")
    df = pd.read_csv(args.csv, low_memory=False)
    need = ["XCNTS_VALUE", "YDNTS_VALUE", "TRDAR_CD", "THSMON_SELNG_AMT"]
    miss = [c for c in need if c not in df.columns]
    if miss:
        print(f"필요한 컬럼 없음: {miss} (영역/매출 데이터가 병합됐는지 확인)"); sys.exit(1)

    name_col = "TRDAR_CD_NM" if "TRDAR_CD_NM" in df.columns else "TRDAR_CD"
    if args.industry and "SVC_INDUTY_CD_NM" in df.columns:
        df = df[df["SVC_INDUTY_CD_NM"].astype(str).str.contains(args.industry, na=False)]
        print(f"    업종 필터 '{args.industry}': {len(df):,}행")

    # 상권 단위로 집계(좌표는 대표값, 매출은 합계)
    df["rev"] = pd.to_numeric(df["THSMON_SELNG_AMT"], errors="coerce")
    g = df.groupby("TRDAR_CD").agg(
        x=("XCNTS_VALUE", "first"), y=("YDNTS_VALUE", "first"),
        name=(name_col, "first"), rev=("rev", "sum")).reset_index()
    g = g[(g["rev"] > 0) & g["x"].notna() & g["y"].notna()]
    g["p"] = g["rev"].rank(pct=True)
    g["grade"] = g["p"].apply(to_grade)
    print(f"    상권 {len(g):,}개")

    print("[2] 좌표 변환 (EPSG:5181 → 위경도)")
    tf = Transformer.from_crs(args.crs, "EPSG:4326", always_xy=True)
    lon, lat = tf.transform(g["x"].astype(float).values, g["y"].astype(float).values)
    g["lat"], g["lon"] = lat, lon
    # 서울 범위 sanity 체크
    ok = g[(g["lat"].between(37.3, 37.75)) & (g["lon"].between(126.7, 127.3))]
    if len(ok) < len(g) * 0.5:
        print(f"    ⚠ 좌표변환 이상(서울범위 {len(ok)}/{len(g)}). --crs EPSG:5186 등으로 시도해보세요.")
    g = ok if len(ok) else g

    print("[3] 지도 생성")
    m = folium.Map(location=[37.55, 126.98], zoom_start=11, tiles="CartoDB positron")
    for _, r in g.iterrows():
        folium.CircleMarker(
            [r["lat"], r["lon"]], radius=5,
            color=GRADE_COLOR[r["grade"]], fill=True, fill_opacity=0.8, weight=0,
            popup=f"{r['name']}<br>등급 {r['grade']} · 상위 {round((1-r['p'])*100)}%<br>"
                  f"월매출 {r['rev']/1e8:.1f}억",
        ).add_to(m)
    # 범례
    legend = "<div style='position:fixed;bottom:20px;left:20px;z-index:9999;background:white;" \
             "padding:10px 12px;border-radius:8px;font:12px sans-serif;box-shadow:0 1px 6px #0003'>" \
             "<b>매출 등급</b><br>" + "".join(
        f"<span style='color:{c}'>●</span> {gr}&nbsp;" for gr, c in GRADE_COLOR.items()) + "</div>"
    m.get_root().html.add_child(folium.Element(legend))
    m.save(args.out)
    print(f"\n✅ 저장: {args.out}  — 더블클릭해서 브라우저로 열면 진짜 지도가 나옵니다.")
    print(f"   상권 {len(g):,}개, 업종={'전체' if not args.industry else args.industry}")


if __name__ == "__main__":
    main()
