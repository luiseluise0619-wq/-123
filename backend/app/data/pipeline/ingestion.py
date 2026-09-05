from typing import Dict, Any
from app.data.collectors.public_api import seoul_api_collector, small_biz_collector, land_registry_collector
from app.data.quality.validator import DataQualityValidator

class DataIngestionPipeline:
    """
    Orchestrates data collection across Public APIs, validates quality, and prepares clean Feature Store records.
    """
    def run_ingestion(self, district_code: str = "1000001", industry: str = "카페/디저트") -> Dict[str, Any]:
        traffic_data = seoul_api_collector.fetch_foot_traffic(district_code)
        store_data = small_biz_collector.fetch_store_density(district_code, industry)
        rent_data = land_registry_collector.fetch_rent_rates(district_code)
        
        merged_features = {
            "district_code": district_code,
            "district_name": traffic_data.get("district_name", "성수동2가"),
            "foot_traffic_daily": traffic_data.get("foot_traffic_daily", 34500),
            "foot_traffic_lunch": traffic_data.get("foot_traffic_lunch", 12075),
            "foot_traffic_dinner": traffic_data.get("foot_traffic_dinner", 13110),
            "age_20_30_ratio": traffic_data.get("age_20_30_ratio", 0.42),
            "workplace_pop": traffic_data.get("workplace_pop", 35000),
            "competitor_count_100m": store_data.get("stores_100m", 4),
            "competitor_count_500m": store_data.get("total_stores_500m", 42),
            "openings_1yr": store_data.get("openings_1yr", 5),
            "closures_1yr": store_data.get("closures_1yr", 1),
            "avg_operating_months": store_data.get("avg_operating_months", 44.5),
            "rent_per_m2": rent_data.get("rent_per_m2", 55000),
            "vacancy_rate": rent_data.get("vacancy_rate", 0.042),
            "card_sales_avg": 38500000
        }
        
        # Quality Validation
        quality_res = DataQualityValidator.validate_record(merged_features)
        merged_features["data_quality_score"] = quality_res["overall_quality_score"]
        
        return {
            "ingestion_status": "SUCCESS",
            "district_code": district_code,
            "quality_report": quality_res,
            "feature_vector": merged_features
        }

ingestion_pipeline = DataIngestionPipeline()
