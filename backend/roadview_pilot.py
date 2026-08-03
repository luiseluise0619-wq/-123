#!/usr/bin/env python3
"""
로드뷰 Vision 파일럿 — 1단계: 상권 좌표 → 위경도 변환 → 로드뷰 이미지 수집.

우리 데이터의 영역-상권 좌표(XCNTS_VALUE, YDNTS_VALUE, EPSG:5181)를
WGS84 위경도로 바꾸고, 표본 상권의 구글 Street View 이미지를 받는다.
(2단계: Vision 모델로 1층여부/간판/도로접면 점수화 → 3단계: R² 효과 검증)

준비:
    pip install pyproj requests
    구글 클라우드 콘솔에서 Street View Static API 키 발급(결제 등록, 월 $200 무료 크레딧)
    export GOOGLE_MAPS_KEY="발급키"

실행:
    export USE_REAL_DATA=true
    python roadview_pilot.py --n 200
이미지는 app/data/roadview/ 에 저장, 목록은 roadview_manifest.csv 로.
"""

import argparse
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.real_data_pipeline import real_data_pipeline  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "data", "roadview")
MANIFEST = os.path.join(OUT_DIR, "roadview_manifest.csv")


def to_wgs84(x, y):
    """EPSG:5181 (중부원점 TM) → WGS84 위경도."""
    from pyproj import Transformer
    tr = Transformer.from_crs("EPSG:5181", "EPSG:4326", always_xy=True)
    lng, lat = tr.transform(x, y)
    return lat, lng


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200, help="표본 상권 수")
    ap.add_argument("--size", default="640x640")
    args = ap.parse_args()

    key = os.getenv("GOOGLE_MAPS_KEY", "").strip()
    if not key:
        print("환경변수 GOOGLE_MAPS_KEY 가 없습니다. 구글 Street View Static API 키를 설정하세요.")
        sys.exit(1)

    df = real_data_pipeline.load_real_dataset()
    need = {"XCNTS_VALUE", "YDNTS_VALUE", "TRDAR_CD"}
    if not need.issubset(df.columns):
        print("영역-상권 좌표 컬럼이 없습니다. add_services.py 로 영역-상권을 먼저 붙이세요.")
        sys.exit(1)

    # 상권당 1줄로 정리 + 표본
    zones = (df[["TRDAR_CD", "TRDAR_CD_NM", "XCNTS_VALUE", "YDNTS_VALUE", "SIGNGU_CD_NM"]]
             .dropna(subset=["XCNTS_VALUE", "YDNTS_VALUE"])
             .drop_duplicates("TRDAR_CD"))
    zones = zones.sample(min(args.n, len(zones)), random_state=42).reset_index(drop=True)

    os.makedirs(OUT_DIR, exist_ok=True)
    import requests
    rows = []
    for i, r in zones.iterrows():
        try:
            lat, lng = to_wgs84(float(r["XCNTS_VALUE"]), float(r["YDNTS_VALUE"]))
            url = ("https://maps.googleapis.com/maps/api/streetview"
                   f"?size={args.size}&location={lat},{lng}&fov=80&key={key}")
            img = requests.get(url, timeout=15)
            fn = f"{r['TRDAR_CD']}.jpg"
            path = os.path.join(OUT_DIR, fn)
            with open(path, "wb") as f:
                f.write(img.content)
            rows.append({"TRDAR_CD": r["TRDAR_CD"], "name": r["TRDAR_CD_NM"],
                         "gu": r["SIGNGU_CD_NM"], "lat": round(lat, 6), "lng": round(lng, 6),
                         "image": fn, "bytes": len(img.content)})
            if (i + 1) % 25 == 0:
                print(f"  {i + 1}/{len(zones)} 수집...")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {r['TRDAR_CD']} 실패: {exc}")

    man = pd.DataFrame(rows)
    man.to_csv(MANIFEST, index=False, encoding="utf-8-sig")
    print(f"\n✅ {len(man)}개 이미지 저장: {OUT_DIR}")
    print(f"   목록: {MANIFEST}")
    print("   샘플 좌표 확인:")
    print(man.head(5).to_string(index=False))
    print("\n다음(2단계): Vision 모델로 1층여부/간판노출/도로접면 점수화 → 매출과 상관 검증")


if __name__ == "__main__":
    main()
