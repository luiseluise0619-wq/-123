import json
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.db.models import FeatureStoreRecord
from app.data.quality.validator import DataQualityValidator

class FeatureStore:
    def __init__(self, db: Session):
        self.db = db

    def save_features(self, district_code: str, features: Dict[str, Any], timestamp: str = "2026-07", feature_version: str = "v1.0") -> FeatureStoreRecord:
        quality_res = DataQualityValidator.validate_record(features)
        quality_score = quality_res["overall_quality_score"]
        
        record = FeatureStoreRecord(
            district_code=district_code,
            timestamp=timestamp,
            feature_version=feature_version,
            data_quality_score=quality_score,
            features_json=features
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_latest_features(self, district_code: str) -> Optional[Dict[str, Any]]:
        record = (
            self.db.query(FeatureStoreRecord)
            .filter(FeatureStoreRecord.district_code == district_code)
            .order_by(FeatureStoreRecord.id.desc())
            .first()
        )
        if record:
            res = dict(record.features_json)
            res["data_quality_score"] = record.data_quality_score
            return res
        return None
