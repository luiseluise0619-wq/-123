from typing import Dict, Any

class OpportunityScoreEngine:
    """
    Computes Normalized 0-100 AI Opportunity Score for map overlays & zone classification.
    """
    @staticmethod
    def calculate_opportunity(
        foot_traffic_growth: float,  # e.g. 0.15 (15%)
        competitor_growth: float,    # e.g. 0.08 (8%)
        rent_per_m2: float           # e.g. 45000 KRW
    ) -> Dict[str, Any]:
        # Normalize to 0.0 - 1.0 range
        demand_norm = max(0.0, min(1.0, (foot_traffic_growth + 0.2) / 0.5))
        comp_growth_norm = max(0.0, min(1.0, (competitor_growth + 0.1) / 0.4))
        rent_eff_norm = max(0.0, min(1.0, 1.0 - (rent_per_m2 / 150000.0)))
        
        # 각 항목을 0~1의 '좋은 정도'로 맞춘 뒤 가중 평균한다.
        # 예전 식은 경쟁도를 빼고도 3으로 나눠 이론상 최고점이 66.7점이라
        # GREEN 기준(68점)에 절대 도달할 수 없었다.
        competition_efficiency = 1.0 - comp_growth_norm
        raw_opp = demand_norm * 0.40 + competition_efficiency * 0.35 + rent_eff_norm * 0.25
        opp_score = round(max(0.0, min(1.0, raw_opp)) * 100.0, 1)
        
        # Zone Classification
        if opp_score >= 68.0:
            zone_type = "GREEN"
            zone_label = "기회 지역 (수요 성장 대비 공급 부족)"
            badge_color = "#10b981" # Emerald Green
        elif opp_score <= 45.0:
            zone_type = "RED"
            zone_label = "경쟁 과열 지역 (레드오션 리스크)"
            badge_color = "#ef4444" # Red
        else:
            zone_type = "BLUE"
            zone_label = "안정적 성숙 상권"
            badge_color = "#3b82f6" # Blue
            
        return {
            "opportunity_score": opp_score,
            "zone_type": zone_type,
            "zone_label": zone_label,
            "badge_color": badge_color,
            "components": {
                "demand_growth_norm": round(demand_norm * 100, 1),
                "competition_growth_norm": round(comp_growth_norm * 100, 1),
                "competition_efficiency_norm": round(competition_efficiency * 100, 1),
                "rent_efficiency_norm": round(rent_eff_norm * 100, 1)
            }
        }
