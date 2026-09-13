from typing import Dict, Any
from app.data.collectors.public_api import seoul_api_collector, small_biz_collector, land_registry_collector
from app.data.quality.validator import DataQualityValidator

class DataIngestionPipeline:
    """
    Orchestrates data collection across Public APIs, validates quality, and prepares clean Feature Store records.
    """
    def run_ingestion(self, district_code: str = "1000001", industry: str = "카페/디저트",
                      lat: float = None, lng: float = None) -> Dict[str, Any]:
        traffic_data = seoul_api_collector.fetch_foot_traffic(district_code)
        store_data = (small_biz_collector.fetch_store_density(lat=lat, lng=lng, industry=industry)
                      if lat is not None and lng is not None
                      else {"source": "unavailable", "competitor_count": None,
                            "note": "반경 점포 조회에는 위도와 경도가 필요합니다."})
        rent_data = land_registry_collector.fetch_rent_rates(district_code)
        
        merged_features = {
            "district_code": district_code,
            "district_name": traffic_data.get("district_name"),
            "foot_traffic_total": traffic_data.get("foot_traffic_total"),
            "foot_traffic_lunch_total": traffic_data.get("foot_traffic_lunch_total"),
            "foot_traffic_dinner_total": traffic_data.get("foot_traffic_dinner_total"),
            "age_20_30_ratio": traffic_data.get("age_20_30_ratio"),
            "workplace_pop": traffic_data.get("workplace_pop"),
            "competitor_count_500m": store_data.get("competitor_count"),
            "openings_1yr": store_data.get("openings_1yr"),
            "closures_1yr": store_data.get("closures_1yr"),
            "avg_operating_months": store_data.get("avg_operating_months"),
            "rent_per_m2": rent_data.get("rent_per_m2"),
            "vacancy_rate": rent_data.get("vacancy_rate"),
            "card_sales_avg": None,
            "sources": {"traffic": traffic_data.get("source"),
                        "stores": store_data.get("source"),
                        "rent": rent_data.get("source", "unavailable")}
        }
        
        # Quality Validation
        quality_res = DataQualityValidator.validate_record(merged_features)
        merged_features["data_quality_score"] = quality_res["overall_quality_score"]
        
        return {
            "ingestion_status": "SUCCESS" if all(v == "live_api" for v in merged_features["sources"].values()) else "PARTIAL",
            "district_code": district_code,
            "quality_report": quality_res,
            "feature_vector": merged_features
        }

ingestion_pipeline = DataIngestionPipeline()
