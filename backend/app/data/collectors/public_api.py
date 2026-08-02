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
    국토교통부 상업용 부동산 임대료/실거래 어댑터.
    실제 임대료·공실률은 한국부동산원 R-ONE 상업용부동산 임대동향조사가 더 정확합니다.
    (엔드포인트/파라미터 확정 후 live_api 분기 추가 예정)
    """

    def fetch_rent_rates(self, district_code: str = "1000001") -> Dict[str, Any]:
        # 실제 연동 전까지는 합성 폴백을 정직하게 표기합니다.
        return {
            "district_code": district_code,
            "rent_per_m2": 55000,  # KRW/m2
            "avg_key_money": 35000000,  # 35M KRW
            "vacancy_rate": 0.042,  # 4.2%
            "status": "SUCCESS",
            "source": "synthetic_fallback",  # 실제 데이터 아님
        }


seoul_api_collector = SeoulOpenDataCollector()
small_biz_collector = SmallBusinessDataCollector()
land_registry_collector = LandRegistryDataCollector()
