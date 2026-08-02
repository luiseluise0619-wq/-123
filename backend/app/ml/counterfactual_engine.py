import numpy as np
from typing import Dict, Any

class CounterfactualSimulationEngine:
    """
    Enhanced Business Decision Simulator supporting Price, Operation, and Location scenarios.
    Returns expected revenue delta, risk delta, and AI recommendation tag (RECOMMENDED / CAUTION).
    """
    @staticmethod
    def simulate_scenario(
        base_features: Dict[str, Any] = None,
        base_score: float = 87.5,
        base_revenue: float = 3850.0, # in 10k KRW (38.5M KRW)
        price_change_pct: float = 0.0,    # e.g. +10% price
        hours_extension: float = 0.0,     # e.g. +2 hours
        rent_delta_pct: float = -20.0,     # e.g. -20% rent
        size_delta_pct: float = 20.0       # e.g. +20% size
    ) -> Dict[str, Any]:
        
        # 1. Price scenario impact
        price_impact = (price_change_pct / 100.0) * 0.40 * base_revenue
        
        # 2. Operating hours scenario impact
        hours_impact = (hours_extension / 12.0) * 0.15 * base_revenue
        
        # 3. Rent & Size scenario impact
        rent_impact = (rent_delta_pct / 100.0) * -0.12 * base_revenue
        size_impact = (size_delta_pct / 100.0) * 0.20 * base_revenue
        
        tot_revenue_delta_10k = round(price_impact + hours_impact + rent_impact + size_impact, 1)
        simulated_revenue_10k = max(800.0, round(base_revenue + tot_revenue_delta_10k, 1))
        
        revenue_delta_krw = int(tot_revenue_delta_10k * 10000)
        revenue_delta_pct = round((tot_revenue_delta_10k / base_revenue) * 100.0, 1)
        
        # Decision Score & Risk Shift
        score_shift = round((price_change_pct * 0.15) + (hours_extension * 1.5) - (rent_delta_pct * 0.10) + (size_delta_pct * 0.12), 1)
        simulated_score = round(np.clip(base_score + score_shift, 0.0, 100.0), 1)
        
        # AI Recommendation Tag
        if simulated_score >= 88.0 and revenue_delta_krw > 0:
            rec_tag = "RECOMMENDED"
            rec_label = "강력 추천 시나리오"
        elif simulated_score >= 75.0:
            rec_tag = "CAUTION"
            rec_label = "검토 필요 시나리오"
        else:
            rec_tag = "NOT_RECOMMENDED"
            rec_label = "비추천 시나리오"
            
        return {
            "scenario_summary": {
                "price_change_pct": price_change_pct,
                "operating_hours_extension": hours_extension,
                "rent_reduction_pct": rent_delta_pct,
                "store_size_expansion_pct": size_delta_pct
            },
            "metrics": {
                "original_score": base_score,
                "simulated_score": simulated_score,
                "score_delta": score_shift,
                "original_revenue_krw": int(base_revenue * 10000),
                "simulated_revenue_krw": int(simulated_revenue_10k * 10000),
                "revenue_delta_krw": revenue_delta_krw,
                "revenue_delta_pct": revenue_delta_pct,
                "recommendation_tag": rec_tag,
                "recommendation_label": rec_label
            },
            "insight_text": (
                f"선택하신 경영 시나리오(임대료 {abs(rent_delta_pct)}% 감축, 면적 {size_delta_pct}% 확장, 영업시간 +{hours_extension}시간 연장) 적용 시 "
                f"월 매출이 ₩{revenue_delta_krw:+,}원 ({revenue_delta_pct:+}%) 개선되어 "
                f"AI 종합 진단 점수가 {base_score}점 ➔ {simulated_score}점으로 상향 평가됩니다. [{rec_label}]"
            )
        }

counterfactual_engine = CounterfactualSimulationEngine()
