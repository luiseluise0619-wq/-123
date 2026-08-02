from typing import Dict, Any

class DataQualityValidator:
    """
    Validates input and commercial dataset quality, calculating a 0.0-1.0 Quality Score.
    """
    @staticmethod
    def validate_record(data: Dict[str, Any]) -> Dict[str, Any]:
        missing_count = 0
        total_fields = len(data) if data else 1
        
        # Key required variables
        required_keys = ["foot_traffic_daily", "avg_rent_m2", "competitor_count", "population_total", "card_sales_avg"]
        missing_keys = [k for k in required_keys if k not in data or data[k] is None]
        
        completeness = max(0.0, 1.0 - (len(missing_keys) / len(required_keys)))
        recency = 0.95  # Simulated 95% recency score
        stability = 0.90  # Simulated 90% stability score
        
        overall_quality = round(completeness * 0.4 + recency * 0.3 + stability * 0.3, 3)
        
        return {
            "completeness": round(completeness, 3),
            "recency": round(recency, 3),
            "stability": round(stability, 3),
            "overall_quality_score": overall_quality,
            "missing_keys": missing_keys
        }
