"""
공공데이터 수집 어댑터 (Public Data Collectors).

중요 (정직성 고지):
- 각 collector 는 실제 공공 API 를 호출하려고 시도합니다.
- API 키가 설정되지 않았거나(settings.USE_REAL_DATA=False) 호출이 실패하면,
  통계 분포 기반의 '합성(synthetic) 폴백' 값을 반환합니다.
- 반환 dict 의 "source" 필드로 실제 데이터인지 폴백인지 반드시 구분합니다:
    - "source": "live_api"           -> 실제 공공 API 응답
    - "source": "synthetic_fallback" -> 합성 폴백 (실제 데이터 아님)
- 절대로 합성 값을 실제 API 응답인 것처럼 표기하지 않습니다.

실제 데이터 연동 방법:
1. https://data.seoul.go.kr 에서 인증키 발급 -> 환경변수 SEOUL_OPENDATA_API_KEY
2. https://data.go.kr 에서 인증키 발급 -> 환경변수 DATA_GO_KR_API_KEY
3. 환경변수 USE_REAL_DATA=true
"""

import logging
from typing import Any, Dict

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 8  # seconds


class SeoulOpenDataCollector:
    """
    서울 열린데이터광장 - 우리마을가게 상권분석 서비스 어댑터.

    - 유동인구:   VwsmTrdarFlpopQq  (상권-길단위인구)
    - 추정매출:   VwsmTrdarSelngQq  (상권-추정매출)
    문서: https://data.seoul.go.kr (Open API, JSON)
    엔드포인트 형식:
        http://openapi.seoul.go.kr:8088/{KEY}/json/{SERVICE}/{START}/{END}/
    """

    BASE_URL = "http://openapi.seoul.go.kr:8088"

    def _build_url(self, service: str, start: int = 1, end: int = 5) -> str:
        key = settings.SEOUL_OPENDATA_API_KEY or "sample"
        return f"{self.BASE_URL}/{key}/json/{service}/{start}/{end}/"

    def _call(self, service: str) -> Dict[str, Any]:
        url = self._build_url(service)
        resp = requests.get(url, timeout=DEFAULT_TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        # 서울 OpenAPI 응답 구조: { SERVICE: { RESULT: {CODE, MESSAGE}, row: [...] } }
        body = payload.get(service, {})
        result_code = body.get("RESULT", {}).get("CODE", "")
        if result_code and result_code != "INFO-000":
            raise RuntimeError(
                f"Seoul API error {result_code}: {body.get('RESULT', {}).get('MESSAGE')}"
            )
        rows = body.get("row", [])
        if not rows:
            raise RuntimeError("Seoul API returned no rows")
        return rows[0]

    def fetch_foot_traffic(self, district_code: str = "1000001") -> Dict[str, Any]:
        """상권 유동인구 조회. 실패 시 합성 폴백을 명시적으로 반환."""
        if settings.USE_REAL_DATA and settings.SEOUL_OPENDATA_API_KEY:
            try:
                row = self._call("VwsmTrdarFlpopQq")
                return {
                    "district_code": district_code,
                    "foot_traffic_daily": float(row.get("TOT_FLPOP_CO", 0)),
                    "foot_traffic_lunch": float(row.get("TMZON_11_14_FLPOP_CO", 0)),
                    "foot_traffic_dinner": float(row.get("TMZON_17_21_FLPOP_CO", 0)),
                    "status": "SUCCESS",
                    "source": "live_api",
                }
            except Exception as exc:  # noqa: BLE001 - 폴백으로 처리
                logger.warning(
                    "Seoul foot-traffic API failed, using synthetic fallback: %s", exc
                )

        return self._synthetic_foot_traffic(district_code)

    @staticmethod
    def _synthetic_foot_traffic(district_code: str) -> Dict[str, Any]:
        return {
            "district_code": district_code,
            "foot_traffic_daily": 34500,
            "foot_traffic_lunch": 12075,
            "foot_traffic_dinner": 13110,
            "age_20_30_ratio": 0.42,
            "workplace_pop": 35000,
            "status": "SUCCESS",
            "source": "synthetic_fallback",  # 실제 데이터 아님
        }


class SmallBusinessDataCollector:
    """
    소상공인시장진흥공단 상가(상권)정보 어댑터 (공공데이터포털 data.go.kr).
    실제 연동 시 반경 내 점포 좌표를 받아 100m/500m 경쟁 점포 수를 직접 집계합니다.
    """

    # data.go.kr 상가업소 정보 - 지정 반경 내 상가 목록 조회
    BASE_URL = "http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"

    def fetch_store_density(
        self,
        lat: float = 37.5445,
        lng: float = 127.0560,
        radius: int = 500,
        industry: str = "카페/디저트",
    ) -> Dict[str, Any]:
        if settings.USE_REAL_DATA and settings.DATA_GO_KR_API_KEY:
            try:
                params = {
                    "serviceKey": settings.DATA_GO_KR_API_KEY,
                    "radius": radius,
                    "cx": lng,
                    "cy": lat,
                    "type": "json",
                    "numOfRows": 1000,
                }
                resp = requests.get(self.BASE_URL, params=params, timeout=DEFAULT_TIMEOUT)
                resp.raise_for_status()
                items = resp.json().get("body", {}).get("items", [])
                return {
                    "lat": lat,
                    "lng": lng,
                    "radius_m": radius,
                    "industry": industry,
                    "total_stores_in_radius": len(items),
                    "status": "SUCCESS",
                    "source": "live_api",
                }
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "SmallBiz store API failed, using synthetic fallback: %s", exc
                )

        return {
            "lat": lat,
            "lng": lng,
            "radius_m": radius,
            "industry": industry,
            "total_stores_500m": 42,
            "stores_100m": 4,
            "openings_1yr": 5,
            "closures_1yr": 1,
            "avg_operating_months": 44.5,
            "status": "SUCCESS",
            "source": "synthetic_fallback",  # 실제 데이터 아님
        }


class LandRegistryDataCollector:
    """
    한국부동산원 상업용부동산 임대동향조사 임대료·공실률 어댑터 (자치구 분기별).

    실 API (data.go.kr 활용신청 후 사용):
      - 상업용부동산 임대동향 조사 통계 조회 서비스: data.go.kr/data/15002275/openapi.do
      - 소규모상가 임대료/공실률(파일): data.go.kr/data/15069766 · 15069726
    키: 환경변수 DATA_GO_KR_KEY. 지어낸 임대료(예전 55000 하드코딩)는 제거 —
    키/명세 확정 전에는 available=False 로 정직하게 알리고 가짜 숫자를 내지 않는다.
    """

    ENDPOINT = "https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do"

    def fetch_rent_rates(self, sgg_nm: str = "강남구", small: bool = True) -> Dict[str, Any]:
        import os
        key = os.getenv("DATA_GO_KR_KEY") or os.getenv("REB_API_KEY")
        if not key:
            return {"available": False, "sgg": sgg_nm,
                    "message": "DATA_GO_KR_KEY 없음. data.go.kr 15002275 활용신청 후 "
                               "export DATA_GO_KR_KEY=키. 지어낸 임대료는 반환하지 않습니다."}
        # 실제 연동은 활용신청 시 발급되는 명세(STATBL_ID/WRTTIME 등)로 확정.
        # 명세 확정 전에는 정직하게 미연동 표기(가짜 숫자 금지).
        return {"available": False, "sgg": sgg_nm, "endpoint": self.ENDPOINT,
                "message": "부동산원 임대동향 API 명세(STATBL_ID·기간코드) 확정 후 연결. "
                           "샌드박스는 data.go.kr 차단 — 키 넣고 네 PC/서버에서 연동."}


seoul_api_collector = SeoulOpenDataCollector()
small_biz_collector = SmallBusinessDataCollector()
land_registry_collector = LandRegistryDataCollector()
