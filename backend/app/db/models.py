from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from datetime import datetime
from app.db.database import Base

class CommercialDistrict(Base):
    __tablename__ = "commercial_districts"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(String, unique=True, index=True)
    district_name = Column(String, index=True)
    gu_name = Column(String, index=True)
    dong_name = Column(String, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    zone_type = Column(String)  # e.g., "골목상권", "발달상권", "전통시장", "관광특구"


class FeatureStoreRecord(Base):
    __tablename__ = "feature_store"

    id = Column(Integer, primary_key=True, index=True)
    district_code = Column(String, index=True)
    timestamp = Column(String, index=True)  # e.g., "2026-07"
    feature_version = Column(String, default="v1.0")
    data_quality_score = Column(Float, default=0.92)
    features_json = Column(JSON)  # All 50+ normalized & engineered variables


class AnalysisHistoryRecord(Base):
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String, default="기본 창업 프로젝트")
    user_persona = Column(String, default="founder")  # founder, investor, gov
    address = Column(String)
    district_name = Column(String)
    industry = Column(String)
    budget = Column(Float)
    floor_area = Column(Float)
    
    # ML & Decision Outputs
    decision_score = Column(Float)
    confidence_score = Column(Float)
    expected_revenue = Column(Float)
    success_rate = Column(Float)
    closure_risk = Column(String)
    opportunity_score = Column(Float)
    
    # JSON Payloads
    shap_factors_json = Column(JSON)
    counterfactual_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelRegistryRecord(Base):
    __tablename__ = "model_registry"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String)
    version = Column(String)
    rmse = Column(Float)
    mae = Column(Float)
    r2 = Column(Float)
    accuracy = Column(Float)
    roc_auc = Column(Float)
    is_winner = Column(Boolean, default=False)
    trained_at = Column(DateTime, default=datetime.utcnow)
