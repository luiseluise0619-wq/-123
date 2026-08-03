#!/usr/bin/env python3
"""
서울 상권분석서비스 실데이터 → 학습용 CSV 생성 스크립트.

사용법 (backend 폴더에서 실행):

  1) 키 설정
     export SEOUL_OPENDATA_API_KEY="발급받은_인증키"      # mac/linux/git-bash
     set SEOUL_OPENDATA_API_KEY=발급받은_인증키           # windows cmd

  2) 연결/서비스명/컬럼 확인 (5건씩만 조회)
     python build_seoul_dataset.py --test

  3) 전량 수집 + 조인 + CSV 생성
     python build_seoul_dataset.py --build

출력: app/data/real_data/seoul_trdar_dataset.csv
그 뒤 학습:
     export USE_REAL_DATA=true
     python -m app.ml.train   # (real_data_pipeline 가 이 CSV 를 쓰도록 지정해 사용)
"""

import argparse
import logging
import os
import sys

import pandas as pd

# 수집 진행 상황이 화면에 보이도록 로깅 설정 (안 보이면 멈춘 걸로 오해하게 됨)
logging.basicConfig(level=logging.INFO, format="%(message)s")

# backend 폴더 기준으로 app 패키지 import 가능하게
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.data.collectors.seoul_trdar_client import (  # noqa: E402
    SERVICES,
    KEY_COLS,
    fetch_service,
    get_api_key,
    merge_all,
    reshape_sales_long,
    PerStoreAdapter,
)

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "data", "real_data")
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "seoul_trdar_dataset.csv")
CACHE_DIR = os.path.join(OUTPUT_DIR, "_cache")
MANIFEST = os.path.join(OUTPUT_DIR, "provenance.json")


def run_test() -> None:
    """각 서비스에서 5건만 받아 연결/서비스명/컬럼을 점검."""
    key = get_api_key()
    print("=== 서울 상권분석 API 연결 테스트 (서비스당 5건) ===\n")
    for name, service in SERVICES.items():
        try:
            df = fetch_service(service, key, max_rows=5)
            status = "OK  " if not df.empty else "빈응답"
            cols = ", ".join(list(df.columns)[:12])
            print(f"[{status}] {name:9s} {service:22s} rows={len(df)}")
            if not df.empty:
                print(f"         컬럼: {cols}{' ...' if len(df.columns) > 12 else ''}")
        except Exception as exc:  # noqa: BLE001
            print(f"[ERROR] {name:9s} {service:22s} -> {exc}")
    print(
        "\n※ ERROR-310(해당 서비스 없음) 이 뜬 서비스는 이름이 실제와 다른 것입니다.\n"
        "  그 서비스의 실제 상세페이지 서비스명을 알려주시면 코드에서 바로잡아 드립니다."
    )


def detect_target(df: pd.DataFrame) -> str:
    """추정매출 금액 컬럼을 자동 탐지 (당월 매출금액 우선)."""
    candidates = [c for c in df.columns if "SELNG_AMT" in c.upper()]
    for pref in ("THSMON_SELNG_AMT", "MT_SELNG_AMT"):
        if pref in df.columns:
            return pref
    return candidates[0] if candidates else ""


def run_build(granular: str = "", use_cache: bool = True,
              per_store_csv: str = "") -> None:
    import datetime
    key = get_api_key()
    print("=== 서울 상권분석 실데이터 전량 수집 ===")
    cache = CACHE_DIR if use_cache else None
    if cache:
        print(f"  (캐시: {cache} — 중단 후 재실행하면 이어받음)")
    frames, prov = {}, {}
    for name, service in SERVICES.items():
        try:
            print(f"- {name} ({service}) 수집 중...")
            frames[name] = fetch_service(service, key, cache_dir=cache)
            prov[name] = {"service": service, "rows": int(len(frames[name]))}
        except Exception as exc:  # noqa: BLE001
            print(f"  ! {name} 실패(건너뜀): {exc}")
            prov[name] = {"service": service, "error": str(exc)[:120]}

    merged = merge_all(frames)
    if merged.empty:
        print("병합 결과가 비었습니다. --test 로 서비스명을 먼저 점검하세요.")
        sys.exit(1)

    # (선택) 요일/시간대 단위로 타깃 해상도 확대
    if granular:
        before = len(merged)
        merged = reshape_sales_long(merged, by=granular)
        merged["monthly_revenue_actual"] = merged["slice_selng_amt"]
        merged["target_monthly_revenue"] = pd.to_numeric(
            merged["slice_selng_amt"], errors="coerce") / 10000.0
        print(f"세분화({granular}): {before:,} → {len(merged):,} 행 "
              f"(타깃=슬라이스 매출, zone 내부 변동 반영)")
    else:
        target = detect_target(merged)
        if target:
            merged["monthly_revenue_actual"] = pd.to_numeric(merged[target], errors="coerce")
            merged["target_monthly_revenue"] = merged["monthly_revenue_actual"] / 10000.0
            print(f"타겟 컬럼 감지: {target} -> monthly_revenue_actual / target_monthly_revenue")
        else:
            print("⚠️ 매출(SELNG_AMT) 컬럼을 못 찾았습니다. 추정매출 서비스 컬럼명 확인 필요.")

    # (선택) 천장을 여는 per-store 실매출 병합
    ps = PerStoreAdapter(per_store_csv or None).load()
    if ps is not None:
        keys = [k for k in ["STDR_YYQU_CD", "TRDAR_CD", "SVC_INDUTY_CD"]
                if k in merged.columns and k in ps.columns]
        merged = merged.merge(ps, on=keys, how="left")
        print(f"per-store 실매출 병합: +{len(ps):,}건 (키={keys}) → 천장 돌파용 타깃 확보")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    merged.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")

    # provenance 기록 (무엇을·언제·몇 행 받았는지 정직하게 남김)
    quarters = sorted(merged["STDR_YYQU_CD"].dropna().unique().tolist()) \
        if "STDR_YYQU_CD" in merged.columns else []
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump({
            "collected_at": datetime.datetime.now().isoformat(timespec="seconds"),
            "source": "서울열린데이터광장 상권분석서비스 OpenAPI",
            "services": prov,
            "granular": granular or "none",
            "per_store_merged": ps is not None,
            "output_rows": int(len(merged)),
            "output_cols": int(len(merged.columns)),
            "quarters": quarters,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 저장 완료: {OUTPUT_CSV}")
    print(f"   행={len(merged):,}  열={len(merged.columns)}  분기={len(quarters)}개")
    print(f"   provenance: {MANIFEST}")
    print("\n다음:  export USE_REAL_DATA=true  &&  python -m app.ml.eda  후  python -m app.ml.train")


def main() -> None:
    parser = argparse.ArgumentParser(description="서울 상권분석 실데이터 CSV 생성")
    parser.add_argument("--test", action="store_true", help="연결/서비스명/컬럼 점검 (5건씩)")
    parser.add_argument("--build", action="store_true", help="전량 수집 + 조인 + CSV 생성")
    parser.add_argument("--granular", choices=["dow", "tmzon"], default="",
                        help="타깃 세분화: dow=요일별, tmzon=시간대별 (해상도↑)")
    parser.add_argument("--no-cache", action="store_true", help="서비스 캐시 비활성화")
    parser.add_argument("--per-store", default="",
                        help="가게단위 실매출 CSV 경로(천장 돌파용, 있으면 병합)")
    args = parser.parse_args()

    if args.test:
        run_test()
    elif args.build:
        run_build(granular=args.granular, use_cache=not args.no_cache,
                  per_store_csv=args.per_store)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
