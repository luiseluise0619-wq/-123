"""
서울시 상권분석서비스 - '상권(TRDAR)' 단위 데이터 수집 클라이언트.

- 서울 열린데이터광장 Open API 를 페이지네이션으로 전량 수집합니다.
- 필드명을 추측하지 않고 각 서비스의 모든 컬럼을 그대로 받아옵니다.
- 인증키는 코드에 하드코딩하지 않고 환경변수 SEOUL_OPENDATA_API_KEY 로만 받습니다.

응답 구조(서울 OpenAPI 공통):
    { SERVICE: { list_total_count, RESULT:{CODE,MESSAGE}, row:[ {...}, ... ] } }
정상 코드: RESULT.CODE == "INFO-000"
"""

import os
import logging
from typing import Dict

import pandas as pd
import requests

logger = logging.getLogger(__name__)

BASE_URL = "http://openapi.seoul.go.kr:8088"
PAGE_SIZE = 1000  # 서울 API 는 한 번에 최대 1000건
KEY_COLS = ["STDR_YYQU_CD", "TRDAR_CD"]  # 조인 키: 기준년분기 + 상권코드

# 서울시 상권분석서비스 '상권' 단위 서비스명.
# (집객시설-상권배후지=VwsmTrdhlFcltyQq 를 실제 확인함. 상권 단위는 Trdar.
#  일부 서비스명은 실제 상세페이지로 검증 후 확정 권장 — test 모드로 확인 가능)
SERVICES: Dict[str, str] = {
    "sales": "VwsmTrdarSelngQq",       # 추정매출-상권 (타겟 원천)
    "footfall": "VwsmTrdarFlpopQq",    # 길단위인구-상권 (유동인구)
    "stores": "VwsmTrdarStorQq",       # 점포-상권
    "resident": "VwsmTrdarRepopQq",    # 상주인구-상권
    "worker": "VwsmTrdarWrcPopltnQq",  # 직장인구-상권
    "spend": "VwsmTrdarConsmpQq",      # 소비-상권
    "facility": "VwsmTrdarFcltyQq",    # 집객시설-상권
}


def get_api_key() -> str:
    key = os.getenv("SEOUL_OPENDATA_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "환경변수 SEOUL_OPENDATA_API_KEY 가 설정되지 않았습니다. "
            'export SEOUL_OPENDATA_API_KEY="발급받은키" 후 다시 실행하세요.'
        )
    return key


def fetch_service(service: str, key: str, max_rows: int = 200_000, timeout: int = 20) -> pd.DataFrame:
    """서비스 하나를 페이지네이션으로 전량 수집해 DataFrame 으로 반환."""
    rows = []
    start = 1
    while start <= max_rows:
        end = start + PAGE_SIZE - 1
        url = f"{BASE_URL}/{key}/json/{service}/{start}/{end}/"
        resp = requests.get(url, timeout=timeout)
        resp.raise_for_status()
        body = resp.json().get(service, {})
        code = body.get("RESULT", {}).get("CODE")
        if code not in ("INFO-000", None):
            raise RuntimeError(f"{service} API error {code}: {body.get('RESULT', {}).get('MESSAGE')}")
        batch = body.get("row", [])
        if not batch:
            break
        rows.extend(batch)
        total = int(body.get("list_total_count", 0) or 0)
        logger.info("  %s: %d/%d rows", service, len(rows), total)
        if total and end >= total:
            break
        start += PAGE_SIZE
    return pd.DataFrame(rows)


def merge_all(frames: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """여러 서비스 DataFrame 을 상권코드+분기로 조인. 중복 컬럼은 뒤에서 제거."""
    merged = None
    for name, df in frames.items():
        if df.empty or not set(KEY_COLS).issubset(df.columns):
            logger.warning("  skip '%s' (empty or missing key cols)", name)
            continue
        if merged is None:
            merged = df.copy()
            continue
        # 이미 있는 비-키 컬럼은 중복이므로 제거 후 조인
        dup = [c for c in df.columns if c in merged.columns and c not in KEY_COLS]
        merged = merged.merge(df.drop(columns=dup), on=KEY_COLS, how="left")
    return merged if merged is not None else pd.DataFrame()
