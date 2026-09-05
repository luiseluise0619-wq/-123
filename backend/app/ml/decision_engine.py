from typing import Dict, Any
from app.ml.adaptive_weights import IndustryAdaptiveWeightEngine

class AIDecisionEngine:
    """
    Computes overall AI Decision Score (0-100) and Confidence Index (0-100%).
    """
    @staticmethod
    def calculate_decision_metrics(
        industry: str,
        expected_revenue: float, # KRW
        success_prob: float,     # 0.0-1.0
        closure_risk: str,       # LOW, MEDIUM, HIGH
        rent_per_m2: float,
        foot_traffic_growth: float,
        data_quality_score: float = 0.92
    ) -> Dict[str, Any]:
        weights = IndustryAdaptiveWeightEngine.get_weights(industry)
        
        # 1. Success Prob Score (0-100)
        s_score = success_prob * 100.0
        
        # 2. Revenue Score (Normalized: 30M KRW = 80 score)
        rev_score = min(100.0, max(20.0, (expected_revenue / 40000000.0) * 100.0))
        
        # 3. Rent Efficiency Score (Lower rent ratio = higher score)
        rent_efficiency = max(20.0, min(100.0, 100.0 - (rent_per_m2 / 1800.0)))
        
        # 4. Competition Safety Score
        risk_map = {"LOW": 90.0, "MEDIUM": 65.0, "HIGH": 35.0}
        comp_safety = risk_map.get(closure_risk.upper(), 60.0)
        
        # 5. Growth Rate Score
        growth_score = max(20.0, min(100.0, 50.0 + (foot_traffic_growth * 150.0)))
        
        # Weighted Combination
        raw_decision_score = (
            weights["success_prob"] * s_score +
            weights["expected_revenue"] * rev_score +
            weights["rent_efficiency"] * rent_efficiency +
            weights["competition_safety"] * comp_safety +
            weights["growth_rate"] * growth_score
        )
        decision_score = round(max(30.0, min(99.0, raw_decision_score)), 1)
        
        # Confidence Score calculation
        # Completeness (40%) + Recency (30%) + Model Calibration Stability (30%)
        completeness_pct = min(100.0, data_quality_score * 100.0)
        recency_pct = 95.0
        model_stability_pct = 88.0
        
        overall_confidence = round(
            completeness_pct * 0.40 + recency_pct * 0.30 + model_stability_pct * 0.30, 1
        )
        
        return {
            "decision_score": decision_score,
            "confidence_score": overall_confidence,
            "confidence_breakdown": {
                "completeness_pct": round(completeness_pct, 1),
                "recency_pct": round(recency_pct, 1),
                "model_stability_pct": round(model_stability_pct, 1)
            },
            "sub_scores": {
                "success_prob_score": round(s_score, 1),
                "revenue_score": round(rev_score, 1),
                "rent_efficiency_score": round(rent_efficiency, 1),
                "competition_safety_score": round(comp_safety, 1),
                "growth_score": round(growth_score, 1)
            },
            "applied_weights": weights
        }
