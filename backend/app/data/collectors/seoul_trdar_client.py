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

# 학습 그레인 = 상권 × 업종 × 분기.
#  - 추정매출/점포 는 업종(SVC_INDUTY_CD)까지 포함 -> 3개 키로 조인
#  - 유동인구/상주인구/직장인구/집객시설 은 상권 단위 -> 2개 키로 조인(업종에 broadcast)
BASE_KEYS = ["STDR_YYQU_CD", "TRDAR_CD"]         # 모든 서비스 공통(최소)
CANDIDATE_KEYS = ["STDR_YYQU_CD", "TRDAR_CD", "SVC_INDUTY_CD"]  # 있으면 함께 조인
KEY_COLS = CANDIDATE_KEYS  # 하위호환 별칭

# 서울시 상권분석서비스 '상권' 단위 서비스명.
# (집객시설-상권배후지=VwsmTrdhlFcltyQq 를 실제 확인함. 상권 단위는 Trdar.
#  일부 서비스명은 실제 상세페이지로 검증 후 확정 권장 — test 모드로 확인 가능)
SERVICES: Dict[str, str] = {
    "sales": "VwsmTrdarSelngQq",       # 추정매출-상권 (타겟 원천)
    "footfall": "VwsmTrdarFlpopQq",    # 길단위인구-상권 (유동인구)
    "stores": "VwsmTrdarStorQq",       # 점포-상권
    "resident": "VwsmTrdarRepopQq",    # 상주인구-상권
    "worker": "VwsmTrdarWrcPopltnQq",  # 직장인구-상권
    # 소득소비-상권: 정확한 서비스명 미확정(VwsmTrdarConsmpQq 는 빈응답).
    # 후보로 소득소비(ICAA) 명을 사용 — 여전히 빈응답이면 자동 skip 됨(핵심 아님).
    "spend": "VwsmTrdarIcaaQq",        # 소득소비-상권 (best guess)
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
        # 10페이지(1만 행)마다 또는 마지막에 진행 표시
        if (start // PAGE_SIZE) % 10 == 0 or (total and end >= total):
            logger.info("    %s: %s/%s rows...", service, f"{len(rows):,}", f"{total:,}")
        if total and end >= total:
            break
        start += PAGE_SIZE
    return pd.DataFrame(rows)


def merge_all(frames: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    서비스 DataFrame 들을 조인. 그레인은 가장 세분화된 매출(상권×업종×분기)에 맞춘다.
      - base = 매출('sales'): 업종(SVC_INDUTY_CD)을 포함
      - 각 프레임은 base 와 공통으로 가진 키(2~3개)로만 left-join
        (업종 없는 상권 단위 데이터는 2키로 조인되어 모든 업종에 broadcast)
    이렇게 하면 업종별 데이터를 붙일 때 행이 폭발하지 않는다.
    """
    # 매출을 base 로 먼저 놓는다(없으면 입력 순서 유지).
    order = (["sales"] if "sales" in frames else []) + [k for k in frames if k != "sales"]

    merged = None
    for name in order:
        df = frames.get(name)
        if df is None or df.empty or not set(BASE_KEYS).issubset(df.columns):
            logger.warning("  skip '%s' (empty or missing base keys)", name)
            continue
        if merged is None:
            merged = df.copy()
            continue
        join_keys = [k for k in CANDIDATE_KEYS if k in merged.columns and k in df.columns]
        dup = [c for c in df.columns if c in merged.columns and c not in join_keys]
        merged = merged.merge(df.drop(columns=dup), on=join_keys, how="left")
        logger.info("  merged '%s' on %s -> %d rows", name, join_keys, len(merged))
    return merged if merged is not None else pd.DataFrame()
