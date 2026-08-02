from typing import Dict, Any
import pandas as pd

COLUMN_ALIAS_MAP = {
    # Target Variables
    "매출": "monthly_revenue",
    "월매출": "monthly_revenue",
    "월매출액": "monthly_revenue",
    "추정매출": "monthly_revenue",
    "monthly_revenue_actual": "monthly_revenue",
    "target_monthly_revenue": "monthly_revenue",
    "성공여부": "success_label",
    "target_success_label": "success_label",
    "폐업위험": "closure_risk",
    "target_closure_risk": "closure_risk",

    # Demographics & Traffic
    "유동인구": "foot_traffic_daily",
    "일일유동인구": "foot_traffic_daily",
    "일유동인구": "foot_traffic_daily",
    "점심유동인구": "foot_traffic_lunch",
    "저녁유동인구": "foot_traffic_dinner",
    "직장인구": "workplace_pop",
    "직장인구수": "workplace_pop",
    "상주인구": "resident_pop",
    "상주인구수": "resident_pop",
    "총인구": "pop_total",
    "세대수": "households",
    "2030비율": "age_20_30_ratio",
    "4050비율": "age_40_50_ratio",

    # Competition & Real Estate
    "임대료": "rent_per_m2",
    "평당임대료": "rent_per_m2",
    "공실률": "vacancy_rate",
    "경쟁점포": "competitor_count_100m",
    "경쟁점포수": "competitor_count_100m",
    "500m경쟁점포": "competitor_count_500m",
    "개업수": "openings_1yr",
    "폐업수": "closures_1yr",
    "평균영업개월": "avg_operating_months",
    "건물연식": "building_age",
    "대중교통승하차": "transit_passengers_daily",
    
    # Category & Location
    "상권코드": "district_code",
    "상권명": "district_name",
    "자치구": "gu_name",
    "행정동": "dong_name",
    "업종": "industry",
    "업종명": "industry"
}

class SchemaMappingEngine:
    """
    Standardizes arbitrary Korean/English public CSV column headers into normalized ML schema.
    """
    @staticmethod
    def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
        df_clean = df.copy()
        
        # Rename mapped columns
        rename_dict = {}
        for col in df_clean.columns:
            clean_col = str(col).strip()
            if clean_col in COLUMN_ALIAS_MAP:
                rename_dict[col] = COLUMN_ALIAS_MAP[clean_col]
                        
        df_clean = df_clean.rename(columns=rename_dict)
        # Deduplicate columns if rename created duplicates
        df_clean = df_clean.loc[:, ~df_clean.columns.duplicated()]
        
        # Normalize Revenue unit to 10k KRW if values are in full KRW (> 100,000)
        if "monthly_revenue" in df_clean.columns:
            s_rev = df_clean["monthly_revenue"]
            if isinstance(s_rev, pd.Series) and s_rev.median() > 100000:
                df_clean["monthly_revenue"] = s_rev / 10000.0
                
        return df_clean

schema_mapper = SchemaMappingEngine()
