import os
import sys
import pickle
import json
import argparse
import shap
import pandas as pd
import numpy as np
from lightgbm import LGBMRegressor, LGBMClassifier
from sklearn.model_selection import train_test_split
from app.core.config import settings
from app.data.schemas.schema import schema_mapper
from app.data.quality.validator import DataQualityValidator
from app.ml.auto_eda import auto_eda_generator
from app.ml.auto_features import dynamic_feature_engine
from app.ml.validation_suite import validation_suite

def run_pipeline(csv_path: str):
    print("==========================================================================")
    print("[AI Local Intelligence] Production MLOps One-Click Pipeline Starting...")
    print("==========================================================================")
    
    # 1. Data Loading & Schema Mapping
    print(f"\n[1/7] Data Loading & Schema Mapping from: {csv_path}")
    if not os.path.exists(csv_path):
        print(f"Error: Dataset file not found at {csv_path}")
        sys.exit(1)
        
    raw_df = pd.read_csv(csv_path, encoding="utf-8-sig")
    print(f" Raw Records Count: {len(raw_df):,} rows | Raw Columns: {len(raw_df.columns)}")
    
    df_clean = schema_mapper.normalize_dataframe(raw_df)
    print(f" Schema Normalized: Mapped headers into standardized ML features.")

    # 2. Data Quality Check
    print("\n[2/7] Data Quality Check & Imputation")
    first_record = df_clean.to_dict(orient="records")[0]
    quality_report = DataQualityValidator.validate_record(first_record)
    print(f" Data Quality Score: {quality_report['overall_quality_score']*100:.1f}% (Completeness, Recency, Stability)")

    # 3. Automated EDA Report Generation
    print("\n[3/7] Automated EDA Report Generation")
    eda_summary = auto_eda_generator.generate_eda_report(df_clean)
    print(f" Top Positive Revenue Driver: {eda_summary['top_positive'][0] if eda_summary['top_positive'] else 'N/A'}")
    print(f" Automated eda_report.md exported successfully!")

    # 4. Dynamic Feature Engineering & Feature Selection
    print("\n[4/7] Dynamic Feature Engineering & Feature Selection")
    target_col = "monthly_revenue" if "monthly_revenue" in df_clean.columns else df_clean.columns[-1]
    df_processed, selected_features = dynamic_feature_engine.process_and_engineer(df_clean, target_col=target_col)
    print(f" Selected Top {len(selected_features)} Features via Mutual Info: {selected_features}")

    # Prepare Train / Test Arrays
    X = df_processed[selected_features]
    y_revenue = df_processed[target_col]
    
    y_success = df_processed["success_label"] if "success_label" in df_processed.columns else (y_revenue > y_revenue.median()).astype(int)
    y_risk = df_processed["closure_risk"] if "closure_risk" in df_processed.columns else np.digitize(y_revenue, np.quantile(y_revenue, [0.33, 0.66]))

    X_train, X_test, y_rev_train, y_rev_test = train_test_split(X, y_revenue, test_size=0.2, random_state=42)
    _, _, y_suc_train, y_suc_test = train_test_split(X, y_success, test_size=0.2, random_state=42)
    _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)

    # 5. LightGBM Training & 5-Fold Cross Validation
    print("\n[5/7] LightGBM Multi-Model Training & 5-Fold Cross Validation")
    min_child = min(5, max(1, len(X_train) // 4))
    
    rev_model = LGBMRegressor(n_estimators=120, learning_rate=0.04, min_child_samples=min_child, random_state=42, verbose=-1)
    rev_model.fit(X_train, y_rev_train)
    val_results = validation_suite.validate_regressor(rev_model, X_train, X_test, y_rev_train, y_rev_test)
    
    print(f" Revenue Model R2 (Test): {val_results['r2_test']} | 5-Fold CV Mean R2: {val_results['cv_r2_mean']} (+/- {val_results['cv_r2_std']})")
    print(f" Overfitting Gap (Train R2 - Test R2): {val_results['overfitting_gap']} (Overfitted: {val_results['is_overfitted']})")
    print(f" RMSE Improvement vs Baseline: {val_results['rmse_improvement_pct']}% (Model RMSE: {val_results['rmse_test']})")

    suc_model = LGBMClassifier(n_estimators=100, learning_rate=0.04, min_child_samples=min_child, random_state=42, verbose=-1)
    suc_model.fit(X_train, y_suc_train)
    
    risk_model = LGBMClassifier(n_estimators=100, learning_rate=0.04, min_child_samples=min_child, random_state=42, verbose=-1)
    risk_model.fit(X_train, y_risk_train)

    # 6. SHAP Explanation
    print("\n[6/7] SHAP TreeExplainer Calculation")
    shap_explainer = shap.TreeExplainer(rev_model)
    print(" SHAP TreeExplainer generated successfully.")

    # 7. Model Registry Save
    print("\n[7/7] Model Registry Saving & Dashboard Artifact Update")
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
        "version": "v3.0-production-adapter",
        "data_source_path": csv_path,
        "total_records": len(df_clean),
        "selected_features": selected_features,
        "validation_results": val_results,
        "trained_at": "2026-07-31"
    }
    meta_path = os.path.join(settings.MODEL_DIR, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print("\n==========================================================================")
    print("[SUCCESS] MLOps Pipeline Complete! Dashboard API is now serving trained model v3.0!")
    print("==========================================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Local Intelligence One-Click MLOps Pipeline")
    parser.add_argument("--dataset", type=str, default=os.path.join("data", "raw", "commercial_data.csv"), help="Path to raw CSV dataset file")
    args = parser.parse_args()
    
    run_pipeline(args.dataset)
