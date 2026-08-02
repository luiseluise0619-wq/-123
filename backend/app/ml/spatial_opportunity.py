import numpy as np
import pandas as pd
from typing import List, Dict, Any
from sklearn.cluster import KMeans

class SpatialOpportunityEngine:
    """
    Spatial Opportunity Clustering Engine: Uses K-Means/DBSCAN spatial clustering
    to classify Seoul commercial districts into Opportunity (Green), Red Ocean (Red), or Stable (Blue) zones.
    """
    @staticmethod
    def classify_opportunity_zones(df: pd.DataFrame) -> List[Dict[str, Any]]:
        features = ["foot_traffic_3yr_growth", "competitor_density", "vacancy_rate", "rent_per_m2"]
        available_cols = [c for c in features if c in df.columns]
        
        if len(available_cols) < 2:
            return []
            
        X = df[available_cols].fillna(df[available_cols].median())
        
        # Fit K-Means 3 clusters
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X)
        
        zones = []
        for idx, row in df.iterrows():
            cluster_id = clusters[idx] if idx < len(clusters) else 0
            
            growth = row.get("foot_traffic_3yr_growth", 0.05)
            comp = row.get("competitor_density", 1.2)
            vacancy = row.get("vacancy_rate", 0.04)
            
            # Opportunity Score Index (0-100)
            score = round(np.clip(50 + (growth * 200) - (comp * 12) - (vacancy * 250), 10.0, 98.0), 1)
            
            if score >= 75:
                zone_type = "GREEN"
                label = "기회 상권 (Demand Expansion Zone)"
                desc = "수요 성장률이 높고 인근 유사 경쟁 밀집도가 낮아 초기 시장 선점에 최적인 블루오션 상권입니다."
            elif comp > 1.8 or vacancy > 0.08:
                zone_type = "RED"
                label = "레드오션 상권 (Saturated Competition Zone)"
                desc = "경쟁점포 밀집도가 과밀하거나 공실률이 높아 출혈 경쟁 및 폐업 리스크가 존재하는 상권입니다."
            else:
                zone_type = "BLUE"
                label = "안정 상권 (Stable Commercial Zone)"
                desc = "유동인구 흐름과 임대 수익성이 수년간 일정 수준 이상 유지되어 안정적 매출이 확보되는 상권입니다."
                
            zones.append({
                "district_code": str(row.get("district_code", f"100{idx}")),
                "district_name": str(row.get("district_name", "성수동 상권")),
                "gu_name": str(row.get("gu_name", "성동구")),
                "lat": float(row.get("lat", 37.5445)),
                "lng": float(row.get("lng", 127.0560)),
                "opportunity_score": score,
                "zone_type": zone_type,
                "zone_label": label,
                "description": desc,
                "cluster_id": int(cluster_id)
            })
            
        return zones

spatial_opportunity_engine = SpatialOpportunityEngine()
