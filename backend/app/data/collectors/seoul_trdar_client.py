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
import time
import json
import logging
from typing import Dict, List, Optional

import pandas as pd
import requests

logger = logging.getLogger(__name__)

BASE_URL = "http://openapi.seoul.go.kr:8088"
PAGE_SIZE = 1000  # 서울 API 는 한 번에 최대 1000건
MAX_RETRIES = 4   # 네트워크 오류 시 지수백오프 재시도

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
    "spend": "trdarNcmCnsmp",          # 소득소비-상권 (지출총액/항목별, Vwsm 패턴 아님-확인됨)
    "facility": "VwsmTrdarFcltyQq",    # 집객시설-상권
    "area": "TbgisTrdarRelm",          # 영역-상권 (자치구·좌표·면적, 분기/업종 없음-상권당 1줄)
    "change": "VwsmTrdarIxQq",         # 상권변화지표-상권 (등급 LL/LH/HL/HH, 운영·폐업 평균개월)
    "apt": "VwsmTrdarAptQq",           # 아파트-상권 (단지수·가구·시세) — --test 로 검증 후 사용
}

# 추정매출(sales) 서비스가 제공하는 '분해' 매출 컬럼.
#  이 컬럼들을 long-format 으로 펼치면 zone×업종×분기 1행 → 요일 7행 / 시간대 6행 으로
#  세분화되어, zone 내부 변동(요일·시간·인구층별)을 타깃이 담게 됨 = 공공데이터 최대 해상도.
SALES_TOTAL_COL = "THSMON_SELNG_AMT"   # 당월 매출 총액(현재 타깃)
DOW_COLS = {  # 요일별 매출
    "MON_SELNG_AMT": "mon", "TUES_SELNG_AMT": "tue", "WED_SELNG_AMT": "wed",
    "THUR_SELNG_AMT": "thu", "FRI_SELNG_AMT": "fri",
    "SAT_SELNG_AMT": "sat", "SUN_SELNG_AMT": "sun",
}
TMZON_COLS = {  # 시간대별 매출
    "TMZON_00_06_SELNG_AMT": "t00_06", "TMZON_06_11_SELNG_AMT": "t06_11",
    "TMZON_11_14_SELNG_AMT": "t11_14", "TMZON_14_17_SELNG_AMT": "t14_17",
    "TMZON_17_21_SELNG_AMT": "t17_21", "TMZON_21_24_SELNG_AMT": "t21_24",
}


def get_api_key() -> str:
    key = os.getenv("SEOUL_OPENDATA_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "환경변수 SEOUL_OPENDATA_API_KEY 가 설정되지 않았습니다. "
            'export SEOUL_OPENDATA_API_KEY="발급받은키" 후 다시 실행하세요.'
        )
    return key


def _get_page(url: str, timeout: int) -> requests.Response:
    """지수 백오프 재시도(2/4/8/16초)로 한 페이지 요청."""
    last = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp
        except requests.RequestException as exc:  # 네트워크/일시오류만 재시도
            last = exc
            wait = 2 ** (attempt + 1)
            logger.warning("    요청 실패(%d/%d) %ds 후 재시도: %s",
                           attempt + 1, MAX_RETRIES, wait, str(exc)[:60])
            time.sleep(wait)
    raise RuntimeError(f"요청 4회 실패: {last}")


def fetch_service(service: str, key: str, max_rows: int = 10_000_000, timeout: int = 20,
                  cache_dir: Optional[str] = None) -> pd.DataFrame:
    """서비스 하나를 페이지네이션으로 전량 수집해 DataFrame 으로 반환.

    - 네트워크 오류는 지수백오프로 최대 4회 재시도.
    - cache_dir 지정 시 서비스별 parquet 캐시로 저장/재사용(중단 후 재개에 유리).
    max_rows 는 폭주 방지용 상한일 뿐, 실제로는 list_total_count 에 도달하면 종료한다."""
    if cache_dir:
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"{service}.parquet")
        if os.path.exists(cache_path):
            logger.info("    캐시 사용: %s", cache_path)
            try:
                return pd.read_parquet(cache_path)
            except Exception:  # 캐시 손상 시 재수집
                logger.warning("    캐시 로드 실패 — 재수집")

    rows = []
    start = 1
    while start <= max_rows:
        end = start + PAGE_SIZE - 1
        url = f"{BASE_URL}/{key}/json/{service}/{start}/{end}/"
        resp = _get_page(url, timeout)
        body = resp.json().get(service, {})
        code = body.get("RESULT", {}).get("CODE")
        if code not in ("INFO-000", None):
            raise RuntimeError(f"{service} API error {code}: {body.get('RESULT', {}).get('MESSAGE')}")
        batch = body.get("row", [])
        if not batch:
            break
        rows.extend(batch)
        total = int(body.get("list_total_count", 0) or 0)
        if (start // PAGE_SIZE) % 10 == 0 or (total and end >= total):
            logger.info("    %s: %s/%s rows...", service, f"{len(rows):,}", f"{total:,}")
        if total and end >= total:
            break
        start += PAGE_SIZE

    df = pd.DataFrame(rows)
    if cache_dir and not df.empty:
        try:
            df.to_parquet(os.path.join(cache_dir, f"{service}.parquet"), index=False)
        except Exception as exc:  # parquet 엔진 없을 때 CSV 폴백
            logger.warning("    parquet 캐시 실패(%s) — 스킵", str(exc)[:40])
    return df


def reshape_sales_long(sales: pd.DataFrame, by: str = "dow") -> pd.DataFrame:
    """추정매출을 요일/시간대 단위 long-format 으로 펼쳐 타깃 해상도를 높인다.

    zone×업종×분기 1행 → (by='dow') 요일 7행 / (by='tmzon') 시간대 6행.
    각 행의 타깃 slice_selng_amt = 해당 슬라이스 매출. 공공데이터로 얻을 수 있는
    가장 세분화된 타깃(zone 내부 요일·시간 변동을 담음).
    """
    colmap = DOW_COLS if by == "dow" else TMZON_COLS
    present = {c: v for c, v in colmap.items() if c in sales.columns}
    if not present:
        logger.warning("reshape_sales_long: %s 분해 컬럼이 없음 — 원본 반환", by)
        return sales
    id_cols = [c for c in sales.columns if c not in colmap]  # 나머지 컬럼 유지
    long = sales.melt(id_vars=id_cols, value_vars=list(present.keys()),
                      var_name="slice_raw", value_name="slice_selng_amt")
    long["slice"] = long["slice_raw"].map(present)
    long["slice_kind"] = by
    long["slice_selng_amt"] = pd.to_numeric(long["slice_selng_amt"], errors="coerce")
    return long.drop(columns=["slice_raw"])


class PerStoreAdapter:
    """천장(0.28)을 실제로 뚫는 유료/제휴 데이터 슬롯.

    공공데이터의 타깃은 zone 평균이라 구조적으로 0.28 을 못 넘는다. 가게 단위
    실매출(카드사·POS·배달앱)을 붙이면 타깃이 per-store 가 되어 천장이 열린다.
    여기에 그 데이터를 CSV 로 넣으면 학습 프레임에 병합된다(형식만 맞추면 됨).

    필수 컬럼: store_id, TRDAR_CD, SVC_INDUTY_CD, STDR_YYQU_CD, store_monthly_revenue
    """

    REQUIRED = ["store_id", "TRDAR_CD", "SVC_INDUTY_CD", "STDR_YYQU_CD",
                "store_monthly_revenue"]

    def __init__(self, csv_path: Optional[str] = None):
        self.csv_path = csv_path

    def load(self) -> Optional[pd.DataFrame]:
        if not self.csv_path or not os.path.exists(self.csv_path):
            logger.info("PerStoreAdapter: per-store 데이터 없음(공공데이터만 사용). "
                        "가게단위 실매출 CSV 를 넣으면 천장이 열림.")
            return None
        df = pd.read_csv(self.csv_path)
        missing = [c for c in self.REQUIRED if c not in df.columns]
        if missing:
            raise ValueError(f"per-store 데이터에 필수 컬럼 없음: {missing}")
        return df


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
        # TRDAR_CD 만 있으면 조인 가능(영역-상권처럼 분기 없는 상권 단위 차원 테이블 포함).
        if df is None or df.empty or "TRDAR_CD" not in df.columns:
            logger.warning("  skip '%s' (empty or missing TRDAR_CD)", name)
            continue
        if merged is None:
            merged = df.copy()
            continue
        join_keys = [k for k in CANDIDATE_KEYS if k in merged.columns and k in df.columns]
        dup = [c for c in df.columns if c in merged.columns and c not in join_keys]
        merged = merged.merge(df.drop(columns=dup), on=join_keys, how="left")
        logger.info("  merged '%s' on %s -> %d rows", name, join_keys, len(merged))
    return merged if merged is not None else pd.DataFrame()
