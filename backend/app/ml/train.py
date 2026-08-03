import os
import pickle
import json
import shap
import pandas as pd
import numpy as np
from lightgbm import LGBMRegressor, LGBMClassifier
from sklearn.model_selection import train_test_split
from app.core.config import settings
from app.data.real_data_pipeline import real_data_pipeline
from app.ml.data_processing import FEATURE_NAMES
from app.ml.feature_selection import FeatureSelectionEngine
from app.ml.evaluate import ModelEvaluator

def train_and_register_models():
    print("[ML Pipeline] Loading commercial dataset CSV...")
    df = real_data_pipeline.load_real_dataset()
    data_provenance = real_data_pipeline.data_provenance
    print(f"Loaded {len(df):,} records (data_provenance={data_provenance}).")
    if data_provenance != "real_public_data":
        print(
            "[경고] 현재 데이터는 실제 공공데이터가 아닙니다(합성/시드 데이터). "
            "아래 성능 지표는 실제 상권 예측 성능을 보장하지 않습니다."
        )
    
    target_cols = ["target_monthly_revenue", "target_success_label", "target_closure_risk"]
    df = df.dropna(subset=target_cols)
    
    X_raw = df[[f for f in FEATURE_NAMES if f in df.columns]]
    y_revenue = df["target_monthly_revenue"]
    y_success = df["target_success_label"].astype(int)
    y_risk = df["target_closure_risk"].astype(int)
    
    print("[Feature Selection] Selecting top influential features via Mutual Information...")
    selected_features = FeatureSelectionEngine.select_top_features(X_raw, y_revenue, top_k=min(18, len(X_raw.columns)))
    print(f"Selected {len(selected_features)} features: {selected_features}")
    
    X = X_raw[selected_features]

    # Train/Test Split.
    #  실데이터(분기 STDR_YYQU_CD 존재)면 '시간 기반 분할'을 쓴다:
    #  과거 분기로 학습 -> 최신 분기로 테스트 (실제 미래 예측 상황과 동일, 정직한 성능).
    #  무작위 분할은 같은 상권이 학습/테스트에 동시에 들어가 성능을 과대평가한다.
    if "STDR_YYQU_CD" in df.columns and df["STDR_YYQU_CD"].astype(str).nunique() > 1:
        quarters = sorted(df["STDR_YYQU_CD"].astype(str).unique())
        test_quarter = quarters[-1]
        test_mask = df["STDR_YYQU_CD"].astype(str).values == test_quarter
        split_method = f"time_holdout(test_quarter={test_quarter})"
        print(f"[Split] 시간기반 분할 → 테스트=최신분기 {test_quarter} "
              f"(train={int((~test_mask).sum()):,}, test={int(test_mask.sum()):,})")
        X_train, X_test = X[~test_mask], X[test_mask]
        y_rev_train, y_rev_test = y_revenue[~test_mask], y_revenue[test_mask]
        y_suc_train, y_suc_test = y_success[~test_mask], y_success[test_mask]
        y_risk_train, y_risk_test = y_risk[~test_mask], y_risk[test_mask]
    else:
        split_method = "random_80_20"
        print("[Split] 무작위 80/20 분할 (분기 정보 없음 — 합성/시드 데이터)")
        X_train, X_test, y_rev_train, y_rev_test = train_test_split(X, y_revenue, test_size=0.2, random_state=42)
        _, _, y_suc_train, y_suc_test = train_test_split(X, y_success, test_size=0.2, random_state=42)
        _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    
    n_records = len(df)

    # 1. Revenue Regressor
    print(f"Training LightGBM Revenue Regressor on {n_records:,} records...")
    rev_model = LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    rev_model.fit(X_train, y_rev_train)
    rev_metrics = ModelEvaluator.evaluate_regressor(rev_model, X_test, y_rev_test)
    print(f"Revenue Regressor Metrics: {rev_metrics}")

    # 2. Success Classifier
    print(f"Training LightGBM Success Classifier on {n_records:,} records...")
    suc_model = LGBMClassifier(n_estimators=120, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    suc_model.fit(X_train, y_suc_train)
    suc_metrics = ModelEvaluator.evaluate_classifier(suc_model, X_test, y_suc_test)
    print(f"Success Classifier Metrics: {suc_metrics}")

    # 3. Closure Risk Classifier
    print(f"Training LightGBM Closure Risk Classifier on {n_records:,} records...")
    risk_model = LGBMClassifier(n_estimators=120, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    risk_model.fit(X_train, y_risk_train)
    risk_metrics = ModelEvaluator.evaluate_classifier(risk_model, X_test, y_risk_test)
    print(f"Risk Classifier Metrics: {risk_metrics}")
    
    # 4. SHAP Explainer
    print("Building SHAP TreeExplainer on trained model...")
    shap_explainer = shap.TreeExplainer(rev_model)
    
    # Create Registry Folder
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    
    artifacts = {
        "revenue_model.pkl": rev_model,
        "success_model.pkl": suc_model,
        "risk_model.pkl": risk_model,
        "shap_explainer.pkl": shap_explainer,
    }
    
    for filename, obj in artifacts.items():
        filepath = os.path.join(settings.MODEL_DIR, filename)
        with open(filepath, "wb") as f:
            pickle.dump(obj, f)
            
    metadata = {
        "version": "v2.0-production-seed",
        "data_source": f"commercial dataset CSV ({len(df):,} records)",
        "data_provenance": data_provenance,  # real_public_data | synthetic | seed_sample
        "is_real_public_data": data_provenance == "real_public_data",
        "trained_at": "2026-07-31",
        "total_training_records": len(df),
        "selected_features": selected_features,
        "revenue_metrics": rev_metrics,
        "success_metrics": suc_metrics,
        "risk_metrics": risk_metrics,
    }
    
    meta_path = os.path.join(settings.MODEL_DIR, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
        
    provenance_warning = (
        ""
        if data_provenance == "real_public_data"
        else "\n> ⚠️ **주의**: 학습 데이터가 실제 공공데이터가 아닌 **합성/시드 데이터**입니다. "
        "아래 지표는 실제 상권 예측 성능을 보장하지 않으며, 실제 공공데이터로 재학습해야 합니다.\n"
    )
    model_card_content = f"""# Model Card: AI Local Intelligence v2.0 ({len(df):,} Records)
{provenance_warning}
- **Data Source**: commercial dataset CSV ({len(df):,} records)
- **Data Provenance**: {data_provenance}
- **Model Type**: LightGBM Multi-Model Ensemble (Regressor + Classifiers)
- **Features Used ({len(selected_features)})**: {', '.join(selected_features)}
- **Revenue Predictor Performance**: RMSE={rev_metrics['rmse']} (Baseline={rev_metrics['baseline_rmse']}, R2={rev_metrics['r2']})
- **Success Rate Classifier Accuracy**: {suc_metrics['accuracy']} (ROC-AUC={suc_metrics['roc_auc']})
- **Closure Risk Classifier Accuracy**: {risk_metrics['accuracy']} (ROC-AUC={risk_metrics['roc_auc']})
"""
    model_card_path = os.path.join(settings.MODEL_DIR, "model_card.md")
    with open(model_card_path, "w", encoding="utf-8") as f:
        f.write(model_card_content)

    print(f"[ML Pipeline] Model Training & Registry Complete! ({len(df):,} records, provenance={data_provenance})")

if __name__ == "__main__":
    train_and_register_models()
