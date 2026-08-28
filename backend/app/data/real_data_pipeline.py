import os
import pandas as pd
from typing import Dict, Any, Optional
from app.core.config import settings
from app.data.quality.validator import DataQualityValidator

class RealDataIngestionPipeline:
    """
    상권 데이터 CSV 를 적재/정제/검증하는 파이프라인.

    정직성 고지: 기본 제공 CSV(`sample_real_data/`)는 실제 공공데이터가 아니라
    통계 분포로 생성한 합성/시드 데이터입니다. `data_provenance` 속성으로
    현재 적재된 데이터의 출처를 구분합니다:
        - "real_public_data" : 사용자가 직접 제공한 실제 공공데이터 CSV
        - "synthetic"        : 대규모 합성 데이터(seoul_bigdata_multi_thousand_2026.csv)
        - "seed_sample"      : 소규모 수기 시드 샘플(seoul_commercial_districts_2026.csv)
    """
    def __init__(self, csv_filepath: Optional[str] = None):
        base_dir = settings.BASE_DIR
        # build_seoul_dataset.py --build 로 생성되는 실제 공공데이터 CSV (있으면 최우선)
        real_path = os.path.join(base_dir, "data", "real_data", "seoul_trdar_dataset.csv")
        bigdata_path = os.path.join(base_dir, "data", "sample_real_data", "seoul_bigdata_multi_thousand_2026.csv")
        seed_path = os.path.join(base_dir, "data", "sample_real_data", "seoul_commercial_districts_2026.csv")

        if csv_filepath and os.path.exists(csv_filepath):
            # 사용자가 명시적으로 넣은 CSV 는 실제 공공데이터로 간주.
            self.csv_filepath = csv_filepath
            self.data_provenance = "real_public_data"
        elif os.path.exists(real_path):
            # 서울 상권분석 API 로 수집한 실제 공공데이터
            self.csv_filepath = real_path
            self.data_provenance = "real_public_data"
        elif os.path.exists(bigdata_path):
            self.csv_filepath = bigdata_path
            self.data_provenance = "synthetic"
        else:
            self.csv_filepath = seed_path
            self.data_provenance = "seed_sample"

    def load_real_dataset(self) -> pd.DataFrame:
        if not os.path.exists(self.csv_filepath):
            raise FileNotFoundError(f"Real commercial data CSV file not found at: {self.csv_filepath}")
            
        df = pd.read_csv(self.csv_filepath, encoding="utf-8-sig")
        
        # Mapping CSV target columns
        if "monthly_revenue_actual" in df.columns and "target_monthly_revenue" not in df.columns:
            df["target_monthly_revenue"] = df["monthly_revenue_actual"] / 10000.0 # in 10k KRW
        if "success_label_actual" in df.columns and "target_success_label" not in df.columns:
            df["target_success_label"] = df["success_label_actual"]
        if "closure_risk_actual" in df.columns and "target_closure_risk" not in df.columns:
            df["target_closure_risk"] = df["closure_risk_actual"]
            
        return df

    def run_csv_ingestion(self) -> Dict[str, Any]:
        df = self.load_real_dataset()
        records_count = len(df)
        
        # Run Data Quality Check
        quality_res = DataQualityValidator.validate_record(df.to_dict(orient="records")[0])
        
        return {
            "status": "SUCCESS",
            "csv_filepath": self.csv_filepath,
            "total_records_loaded": records_count,
            "quality_summary": quality_res,
            "columns_loaded": df.columns.tolist()
        }

real_data_pipeline = RealDataIngestionPipeline()
