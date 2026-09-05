import os
import json
import pandas as pd
import numpy as np
from typing import Dict, Any
from app.core.config import settings
from app.data.real_data_pipeline import real_data_pipeline
from app.ml.data_processing import FEATURE_NAMES

class CommercialDataEDA:
    """
    Exploratory Data Analysis (EDA) Engine for Real Public Commercial Data CSVs.
    Analyzes feature distributions, correlations, missing values, skewness, and feature-target relationships.
    """
    def __init__(self, df: pd.DataFrame = None):
        if df is not None:
            self.df = df
        else:
            try:
                self.df = real_data_pipeline.load_real_dataset()
            except Exception as e:
                print(f"Loading fallback dataset: {e}")
                from app.ml.data_processing import generate_synthetic_commercial_dataset
                self.df = generate_synthetic_commercial_dataset(n_samples=1500)

    def run_full_eda(self) -> Dict[str, Any]:
        df = self.df
        
        # 1. Dataset Shape & Summary
        shape = {"rows": len(df), "columns": len(df.columns)}
        
        # 2. Missing Value Analysis
        missing_summary = {col: int(df[col].isnull().sum()) for col in df.columns}
        
        # 3. Descriptive Statistics for Core Features
        feature_stats = {}
        for col in FEATURE_NAMES:
            if col in df.columns:
                series = df[col].dropna()
                feature_stats[col] = {
                    "mean": round(float(series.mean()), 3),
                    "std": round(float(series.std()), 3),
                    "min": round(float(series.min()), 3),
                    "25%": round(float(series.quantile(0.25)), 3),
                    "50% (median)": round(float(series.median()), 3),
                    "75%": round(float(series.quantile(0.75)), 3),
                    "max": round(float(series.max()), 3),
                    "skewness": round(float(series.skew()), 3) if len(series) > 2 else 0.0
                }
                
        # 4. Target Variable Analysis
        # 실데이터엔 성공/폐업 라벨이 없을 수 있으므로 존재하는 것만 분석한다.
        revenue_target = df["target_monthly_revenue"]
        target_stats = {
            "monthly_revenue": {
                "mean_krw_10k": round(float(revenue_target.mean()), 1),
                "median_krw_10k": round(float(revenue_target.median()), 1),
                "std_krw_10k": round(float(revenue_target.std()), 1),
                "skewness": round(float(revenue_target.skew()), 3) if len(revenue_target) > 2 else 0.0
            }
        }
        if "target_success_label" in df.columns:
            success_target = df["target_success_label"]
            target_stats["success_rate_split"] = {
                "success_count": int((success_target == 1).sum()),
                "fail_count": int((success_target == 0).sum()),
                "success_ratio_pct": round(float((success_target == 1).mean() * 100), 1)
            }
        if "target_closure_risk" in df.columns:
            risk_target = df["target_closure_risk"]
            target_stats["closure_risk_split"] = {
                "low_risk_pct": round(float((risk_target == 0).mean() * 100), 1),
                "medium_risk_pct": round(float((risk_target == 1).mean() * 100), 1),
                "high_risk_pct": round(float((risk_target == 2).mean() * 100), 1)
            }
        
        # 5. Correlation Analysis with Revenue Target
        corr_series = df.corr(numeric_only=True)["target_monthly_revenue"].drop("target_monthly_revenue", errors="ignore")
        
        top_positive_corr = [(col, round(float(val), 4)) for col, val in corr_series.sort_values(ascending=False).head(5).items() if not np.isnan(val)]
        top_negative_corr = [(col, round(float(val), 4)) for col, val in corr_series.sort_values(ascending=True).head(5).items() if not np.isnan(val)]
        
        eda_results = {
            "dataset_shape": shape,
            "missing_values": missing_summary,
            "feature_statistics": feature_stats,
            "target_analysis": target_stats,
            "correlations_with_revenue": {
                "top_positive": top_positive_corr,
                "top_negative": top_negative_corr
            }
        }
        
        # Save EDA Report JSON
        os.makedirs(settings.MODEL_DIR, exist_ok=True)
        report_path = os.path.join(settings.MODEL_DIR, "eda_report.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(eda_results, f, ensure_ascii=False, indent=2)
            
        return eda_results

if __name__ == "__main__":
    eda = CommercialDataEDA()
    results = eda.run_full_eda()
    print("Full Real Data CSV EDA Analysis Completed!")
    print(f"Top Positive Revenue Drivers: {results['correlations_with_revenue']['top_positive']}")
    print(f"Top Negative Revenue Drivers: {results['correlations_with_revenue']['top_negative']}")
