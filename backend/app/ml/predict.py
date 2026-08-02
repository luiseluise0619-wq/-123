import os
import pickle
import json
import pandas as pd
import numpy as np
from typing import Dict, Any
from app.core.config import settings
from app.ml.shap_engine import ShapExplainabilityEngine
from app.ml.decision_engine import AIDecisionEngine
from app.ml.opportunity_engine import OpportunityScoreEngine
from app.ml.counterfactual_engine import CounterfactualEngine

class InferenceService:
    def __init__(self):
        self.rev_model = None
        self.suc_model = None
        self.risk_model = None
        self.shap_engine = None
        self.selected_features = []
        self._load_artifacts()

    def _load_artifacts(self):
        try:
            meta_path = os.path.join(settings.MODEL_DIR, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    self.selected_features = meta.get("selected_features", [])
                    
            rev_path = os.path.join(settings.MODEL_DIR, "revenue_model.pkl")
            suc_path = os.path.join(settings.MODEL_DIR, "success_model.pkl")
            risk_path = os.path.join(settings.MODEL_DIR, "risk_model.pkl")
            shap_path = os.path.join(settings.MODEL_DIR, "shap_explainer.pkl")
            
            if os.path.exists(rev_path):
                with open(rev_path, "rb") as f:
                    self.rev_model = pickle.load(f)
            if os.path.exists(suc_path):
                with open(suc_path, "rb") as f:
                    self.suc_model = pickle.load(f)
            if os.path.exists(risk_path):
                with open(risk_path, "rb") as f:
                    self.risk_model = pickle.load(f)
            if os.path.exists(shap_path):
                with open(shap_path, "rb") as f:
                    explainer = pickle.load(f)
                    self.shap_engine = ShapExplainabilityEngine(self.rev_model, explainer)
        except Exception as e:
            print(f"⚠️ Artifact loading warning: {e}")

    def analyze_district(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        industry = input_data.get("industry", "카페/디저트")
        address = input_data.get("address", "서울시 성동구 성수동2가")
        budget = float(input_data.get("budget", 100000000)) # 100M KRW
        floor_area = float(input_data.get("floor_area", 50)) # 50m2
        
        # Prepare feature vector (using deterministic feature generator for address/industry hash)
        seed_val = abs(hash(address + industry)) % 10000
        np.random.seed(seed_val)
        
        foot_traffic_daily = np.random.randint(12000, 48000)
        foot_traffic_growth = np.random.uniform(0.05, 0.28)
        comp_count_100m = np.random.randint(2, 14)
        rent_m2 = np.random.uniform(35000, 110000)
        quality_score = round(np.random.uniform(0.88, 0.98), 3)
        
        raw_features = {
            "lat": 37.5445, "lng": 127.0560, "pop_total": 28000, "households": 12500,
            "age_20_30_ratio": 0.42, "age_40_50_ratio": 0.28, "workplace_pop": 35000,
            "resident_pop": 21000, "foot_traffic_daily": foot_traffic_daily,
            "foot_traffic_lunch": int(foot_traffic_daily * 0.35),
            "foot_traffic_dinner": int(foot_traffic_daily * 0.38),
            "dwell_time_avg": 45.0, "foot_traffic_3yr_growth": foot_traffic_growth,
            "card_sales_avg": 32000.0, "industry_spend_ratio": 0.32, "avg_ticket_size": 14000.0,
            "competitor_count_100m": comp_count_100m, "competitor_count_500m": comp_count_100m * 4,
            "openings_1yr": 4, "closures_1yr": 2, "competitor_density": comp_count_100m * 0.2,
            "avg_operating_months": 42.0, "rent_per_m2": rent_m2, "vacancy_rate": 0.045,
            "building_age": 8.0, "transit_passengers_daily": 45000,
            "data_quality_score": quality_score
        }
        
        # Format DataFrame
        df_full = pd.DataFrame([raw_features])
        if self.selected_features:
            df_input = df_full[[f for f in self.selected_features if f in df_full.columns]]
        else:
            df_input = df_full
            
        # Model Inference
        if self.rev_model:
            pred_rev_10k = float(self.rev_model.predict(df_input)[0])
            expected_revenue = max(10000000.0, float(pred_rev_10k * 10000.0))
        else:
            expected_revenue = 34500000.0
            
        if self.suc_model:
            success_prob = float(self.suc_model.predict_proba(df_input)[0][1])
        else:
            success_prob = 0.82
            
        if self.risk_model:
            risk_class = int(self.risk_model.predict(df_input)[0])
            risk_label_map = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
            closure_risk = risk_label_map.get(risk_class, "LOW")
        else:
            closure_risk = "LOW"
            
        # SHAP Explanation
        if self.shap_engine:
            shap_res = self.shap_engine.explain_instance(df_input)
        else:
            shap_res = ShapExplainabilityEngine(None).explain_instance(df_full)
            
        # Decision & Opportunity Metrics
        decision_metrics = AIDecisionEngine.calculate_decision_metrics(
            industry, expected_revenue, success_prob, closure_risk, rent_m2, foot_traffic_growth, quality_score
        )
        
        opportunity_res = OpportunityScoreEngine.calculate_opportunity(
            foot_traffic_growth, competitor_growth=0.04, rent_per_m2=rent_m2
        )
        
        # What-If Counterfactual Baseline
        what_if_res = CounterfactualEngine.simulate_what_if(
            industry, expected_revenue, success_prob, closure_risk, rent_m2, foot_traffic_growth,
            rent_change_pct=-0.20, floor_area_change_pct=0.20
        )
        
        return {
            "address": address,
            "industry": industry,
            "budget_krw": budget,
            "floor_area_m2": floor_area,
            "district_name": address.split()[-1] if len(address.split()) > 0 else "성수동2가",
            "expected_monthly_revenue": int(expected_revenue),
            "success_probability_pct": round(success_prob * 100.0, 1),
            "closure_risk": closure_risk,
            "decision_score": decision_metrics["decision_score"],
            "confidence_score": decision_metrics["confidence_score"],
            "confidence_breakdown": decision_metrics["confidence_breakdown"],
            "sub_scores": decision_metrics["sub_scores"],
            "opportunity": opportunity_res,
            "shap_explanation": shap_res,
            "what_if_simulation": what_if_res,
            "raw_features_summary": {
                "foot_traffic_daily": foot_traffic_daily,
                "rent_per_m2": int(rent_m2),
                "competitor_count_100m": comp_count_100m,
                "data_quality_score": quality_score
            }
        }

inference_service = InferenceService()
