#!/usr/bin/env python3
"""
기존 수집 CSV 에 '새 서비스'만 받아서 붙인다 (전체 재수집 X).
영역-상권(TbgisTrdarRelm) + 상권변화지표-상권(VwsmTrdarIxQq) 만 추가 수집(~2분).

실행:
    export SEOUL_OPENDATA_API_KEY="인증키"
    python add_services.py
"""

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.collectors.seoul_trdar_client import fetch_service, get_api_key  # noqa: E402

CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "app", "data", "real_data", "seoul_trdar_dataset.csv")

NEW = {
    "영역-상권": "TbgisTrdarRelm",       # 자치구/좌표/면적 (TRDAR_CD 만, 분기 없음)
    "상권변화지표-상권": "VwsmTrdarIxQq",  # 등급/운영·폐업개월 (STDR_YYQU_CD+TRDAR_CD)
}


def main():
    if not os.path.exists(CSV):
        print(f"기존 CSV 없음: {CSV}\n먼저 build_seoul_dataset.py --build 를 하세요.")
        sys.exit(1)
    key = get_api_key()

    df = pd.read_csv(CSV, dtype={"STDR_YYQU_CD": str, "TRDAR_CD": str}, low_memory=False)
    print(f"기존 데이터: {len(df):,}행 × {len(df.columns)}열")

    for label, svc in NEW.items():
        print(f"- {label} ({svc}) 수집 중...")
        nd = fetch_service(svc, key)
        if nd.empty or "TRDAR_CD" not in nd.columns:
            print(f"  ! {label} 비어있음/키 없음 → 건너뜀")
            continue
        nd["TRDAR_CD"] = nd["TRDAR_CD"].astype(str)
        join = ["TRDAR_CD"]
        if "STDR_YYQU_CD" in nd.columns:
            nd["STDR_YYQU_CD"] = nd["STDR_YYQU_CD"].astype(str)
            join = ["STDR_YYQU_CD", "TRDAR_CD"]
        dup = [c for c in nd.columns if c in df.columns and c not in join]
        before = len(df.columns)
        df = df.merge(nd.drop(columns=dup), on=join, how="left")
        print(f"  붙임: +{len(df.columns) - before}열 (조인키={join})")

    df.to_csv(CSV, index=False, encoding="utf-8-sig")
    print(f"\n✅ 갱신 완료: {len(df):,}행 × {len(df.columns)}열")
    print("이제:  python forward_select.py  로 새 변수 효과 확인")


if __name__ == "__main__":
    main()
