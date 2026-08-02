from typing import Dict, Any

class FestivalImpactEngine:
    """
    Predicts foot traffic surge, revenue surge per industry, and overall economic impact of regional festivals/events.
    """
    @staticmethod
    def predict_impact(
        location: str = "서울시 성동구 성수동2가",
        event_name: str = "성수 디저트 & 아티스트 팝업 페스티벌",
        event_duration_days: int = 3,
        expected_visitors: int = 50000,
        event_scale: str = "REGIONAL" # LOCAL, REGIONAL, NATIONAL
    ) -> Dict[str, Any]:
        scale_multipliers = {"LOCAL": 1.15, "REGIONAL": 1.35, "NATIONAL": 1.65}
        mult = scale_multipliers.get(event_scale.upper(), 1.35)
        
        traffic_surge_pct = round((expected_visitors / 25000.0) * 18.0 * mult, 1)
        
        total_economic_impact = int(expected_visitors * 28000 * mult) # in KRW
        
        industry_surge = {
            "카페/디저트": round(traffic_surge_pct * 0.85, 1),
            "음식점/식당": round(traffic_surge_pct * 0.70, 1),
            "소매/패션": round(traffic_surge_pct * 0.50, 1),
            "숙박/게스트하우스": round(traffic_surge_pct * 0.40, 1)
        }
        
        beneficiary_ranking = [
            {"industry": "카페/디저트", "surge_pct": industry_surge["카페/디저트"], "rank": 1},
            {"industry": "음식점/식당", "surge_pct": industry_surge["음식점/식당"], "rank": 2},
            {"industry": "소매/패션", "surge_pct": industry_surge["소매/패션"], "rank": 3}
        ]
        
        return {
            "event_name": event_name,
            "location": location,
            "event_duration_days": event_duration_days,
            "expected_visitors": expected_visitors,
            "foot_traffic_surge_pct": traffic_surge_pct,
            "total_economic_impact_krw": total_economic_impact,
            "industry_revenue_surge": industry_surge,
            "top_beneficiary_industries": beneficiary_ranking,
            "recommended_event_strategy": (
                f"축제 기간({event_duration_days}일간) 동안 20~30대 방문객 유입에 대비하여 "
                f"테이크아웃 전용 시그니처 세트 상품을 구성하고 가공 재료 재고를 평시 대비 30% 증대 확보하세요."
            )
        }

festival_impact_engine = FestivalImpactEngine()
