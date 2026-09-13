from typing import Dict, Any

class DataQualityValidator:
    """
    Validates input and commercial dataset quality, calculating a 0.0-1.0 Quality Score.
    """
    @staticmethod
    def validate_record(data: Dict[str, Any]) -> Dict[str, Any]:
        
        # Key required variables
        required_keys = ["foot_traffic_total", "rent_per_m2", "competitor_count_500m", "card_sales_avg"]
        missing_keys = [k for k in required_keys if k not in data or data[k] is None]
        
        completeness = max(0.0, 1.0 - (len(missing_keys) / len(required_keys)))
        recency = None
        stability = None
        overall_quality = round(completeness, 3)
        
        return {
            "completeness": round(completeness, 3),
            "recency": recency,
            "stability": stability,
            "overall_quality_score": overall_quality,
            "missing_keys": missing_keys
        }
