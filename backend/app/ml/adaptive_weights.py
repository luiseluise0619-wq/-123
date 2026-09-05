from typing import Dict

class IndustryAdaptiveWeightEngine:
    """
    Dynamically adjusts weight vectors based on business industry sector.
    """
    DEFAULT_WEIGHTS = {
        "success_prob": 0.40,
        "expected_revenue": 0.25,
        "rent_efficiency": 0.15,
        "competition_safety": 0.10,
        "growth_rate": 0.10
    }
    
    INDUSTRY_WEIGHT_MAP = {
        "카페/디저트": {
            "success_prob": 0.35,
            "expected_revenue": 0.25,
            "rent_efficiency": 0.15,
            "competition_safety": 0.10,
            "growth_rate": 0.15  # Trend & young demographic heavy
        },
        "음식점/식당": {
            "success_prob": 0.35,
            "expected_revenue": 0.30, # High revenue sensitivity
            "rent_efficiency": 0.15,
            "competition_safety": 0.10,
            "growth_rate": 0.10
        },
        "병의원/클리닉": {
            "success_prob": 0.45, # High household stability demand
            "expected_revenue": 0.20,
            "rent_efficiency": 0.15,
            "competition_safety": 0.15,
            "growth_rate": 0.05
        },
        "미용/뷰티": {
            "success_prob": 0.35,
            "expected_revenue": 0.25,
            "rent_efficiency": 0.20,
            "competition_safety": 0.10,
            "growth_rate": 0.10
        }
    }

    @classmethod
    def get_weights(cls, industry: str) -> Dict[str, float]:
        for key in cls.INDUSTRY_WEIGHT_MAP:
            if key in industry or industry in key:
                return cls.INDUSTRY_WEIGHT_MAP[key]
        return cls.DEFAULT_WEIGHTS
