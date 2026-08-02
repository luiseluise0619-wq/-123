import pandas as pd
import numpy as np
from typing import List, Tuple, Dict, Any
from sklearn.feature_selection import mutual_info_regression

LEAKY_TARGET_PROXIES = [
    "card_sales_avg", "monthly_revenue_actual", "target_monthly_revenue",
    "success_label", "closure_risk", "success_label_actual", "closure_risk_actual",
    "target_success_label", "target_closure_risk"
]

class DynamicFeatureEngine:
    """
    Automated Feature Engineering: Automatically prunes Target Leakage proxies (e.g. card_sales_avg, target labels),
    encodes categorical variables, imputes missing values, and runs Mutual Information selection.
    """
    @staticmethod
    def process_and_engineer(df: pd.DataFrame, target_col: str = "monthly_revenue") -> Tuple[pd.DataFrame, List[str]]:
        df_proc = df.copy()
        
        # Drop ID, String Name, and Target Leakage columns
        ignore_cols = ["district_code", "district_name", "dong_name", "quarter"] + LEAKY_TARGET_PROXIES
        df_proc = df_proc.drop(columns=[c for c in ignore_cols if c in df_proc.columns and c != target_col], errors="ignore")
        
        # Categorical Encoding
        cat_cols = df_proc.select_dtypes(include=["object", "category"]).columns.tolist()
        if target_col in cat_cols:
            cat_cols.remove(target_col)
            
        for c in cat_cols:
            # Frequency Encoding
            freq_map = df_proc[c].value_counts(normalize=True).to_dict()
            df_proc[f"{c}_freq_enc"] = df_proc[c].map(freq_map).fillna(0.0)
            df_proc = df_proc.drop(columns=[c])
            
        # Numerical Imputation (Median)
        num_cols = df_proc.select_dtypes(include=[np.number]).columns.tolist()
        for c in num_cols:
            if df_proc[c].isnull().sum() > 0:
                df_proc[c] = df_proc[c].fillna(df_proc[c].median())
                
        # Feature Selection via Mutual Information
        feature_cols = [c for c in df_proc.columns if c != target_col and not c.startswith("target_") and c not in LEAKY_TARGET_PROXIES]
        
        if target_col in df_proc.columns and len(feature_cols) > 0:
            X = df_proc[feature_cols]
            y = df_proc[target_col]
            mi_scores = mutual_info_regression(X, y, random_state=42)
            mi_series = pd.Series(mi_scores, index=feature_cols).sort_values(ascending=False)
            
            # Select top K features (up to 18)
            top_features = mi_series.head(min(18, len(feature_cols))).index.tolist()
            return df_proc, top_features
            
        return df_proc, feature_cols

dynamic_feature_engine = DynamicFeatureEngine()
