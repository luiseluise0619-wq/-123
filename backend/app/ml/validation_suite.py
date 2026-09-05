import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.model_selection import cross_val_score, KFold
from sklearn.metrics import r2_score, mean_squared_error

class ModelValidationSuite:
    """
    Production Validation Suite: 5-Fold Cross Validation, Overfitting Gap Check,
    Baseline Comparison, and Out-of-Sample metrics evaluation.
    """
    @staticmethod
    def validate_regressor(model, X_train, X_test, y_train, y_test) -> Dict[str, Any]:
        # 1. Fit & Train/Test Predictions
        y_train_pred = model.predict(X_train)
        y_test_pred = model.predict(X_test)
        
        # 2. R2 Metrics & Overfitting Gap
        r2_train = round(float(r2_score(y_train, y_train_pred)), 4)
        r2_test = round(float(r2_score(y_test, y_test_pred)), 4)
        overfitting_gap = round(float(r2_train - r2_test), 4)
        
        rmse_test = round(float(np.sqrt(mean_squared_error(y_test, y_test_pred))), 2)
        
        # 3. Baseline Dummy Regressor (Predicting Mean)
        baseline_pred = np.full_like(y_test, y_train.mean())
        baseline_rmse = round(float(np.sqrt(mean_squared_error(y_test, baseline_pred))), 2)
        rmse_improvement_pct = round(float(((baseline_rmse - rmse_test) / baseline_rmse) * 100), 2)
        
        # 4. 5-Fold Cross Validation
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, pd.concat([X_train, X_test]), pd.concat([y_train, y_test]), cv=kf, scoring="r2")
        cv_r2_mean = round(float(cv_scores.mean()), 4)
        cv_r2_std = round(float(cv_scores.std()), 4)
        
        return {
            "r2_train": r2_train,
            "r2_test": r2_test,
            "overfitting_gap": overfitting_gap,
            "is_overfitted": overfitting_gap > 0.15,
            "rmse_test": rmse_test,
            "baseline_rmse": baseline_rmse,
            "rmse_improvement_pct": rmse_improvement_pct,
            "cv_r2_mean": cv_r2_mean,
            "cv_r2_std": cv_r2_std
        }

validation_suite = ModelValidationSuite()
