import pandas as pd
import numpy as np
from sklearn.feature_selection import mutual_info_regression
from typing import List

class FeatureSelectionEngine:
    """
    Automated Feature Selection via Mutual Information scoring.
    Filters raw variables to select top influential predictors.
    """
    @staticmethod
    def select_top_features(X: pd.DataFrame, y: pd.Series, top_k: int = 18) -> List[str]:
        mi_scores = mutual_info_regression(X.fillna(0), y, random_state=42)
        mi_series = pd.Series(mi_scores, index=X.columns).sort_values(ascending=False)
        selected_features = mi_series.head(top_k).index.tolist()
        return selected_features
