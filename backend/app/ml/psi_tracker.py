import numpy as np
import pandas as pd
from typing import Dict, Any

class PopulationStabilityIndexTracker:
    """
    MLOps Population Stability Index (PSI) Data Drift Tracker.
    Monitors feature distribution shifts between baseline training data and live inference payloads.
    """
    @staticmethod
    def calculate_psi(expected: np.ndarray, actual: np.ndarray, num_buckets: int = 10) -> float:
        """
        Calculates Population Stability Index (PSI) between baseline expected array and actual inferenced array.
        """
        expected = np.asarray(expected)
        actual = np.asarray(actual)
        
        if len(expected) == 0 or len(actual) == 0:
            return 0.0
            
        percentiles = np.linspace(0, 100, num_buckets + 1)
        buckets = np.percentile(expected, percentiles)
        buckets[0] -= 1e-5
        buckets[-1] += 1e-5
        
        expected_counts = np.histogram(expected, bins=buckets)[0]
        actual_counts = np.histogram(actual, bins=buckets)[0]
        
        expected_pct = np.clip(expected_counts / len(expected), 1e-4, 1.0)
        actual_pct = np.clip(actual_counts / len(actual), 1e-4, 1.0)
        
        psi_val = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
        return round(float(psi_val), 4)

    @staticmethod
    def audit_data_drift(baseline_df: pd.DataFrame, current_df: pd.DataFrame) -> Dict[str, Any]:
        psi_results = {}
        max_psi = 0.0
        
        numeric_cols = [c for c in ["foot_traffic_daily", "rent_per_m2", "competitor_count_100m", "vacancy_rate"] if c in baseline_df.columns and c in current_df.columns]
        
        for col in numeric_cols:
            psi = PopulationStabilityIndexTracker.calculate_psi(baseline_df[col].dropna(), current_df[col].dropna())
            psi_results[col] = psi
            if psi > max_psi:
                max_psi = psi
                
        # Status determination based on industry standard PSI thresholds
        if max_psi < 0.1:
            status = "STABLE"
            message = f"전체 변수 PSI 지수 {max_psi:.4f}로 데이터 분포가 매우 안정적입니다 (No Retraining Required)."
        elif max_psi < 0.25:
            status = "MODERATE_DRIFT"
            message = f"일부 변수에서 PSI 지수 {max_psi:.4f}의 경미한 데이터 드리프트가 감지되었습니다."
        else:
            status = "SIGNIFICANT_DRIFT"
            message = f"PSI 지수 {max_psi:.4f}의 유의미한 데이터 드리프트 발생! 모델 재학습(Retraining)을 권장합니다."
            
        return {
            "overall_psi": max_psi,
            "drift_status": status,
            "feature_psi_breakdown": psi_results,
            "alert_message": message,
            "audited_records_count": len(current_df)
        }

psi_tracker = PopulationStabilityIndexTracker()
