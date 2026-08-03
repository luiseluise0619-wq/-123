"""
==============================================================================
Open Security Intelligence AI - Dataset Pipeline: Builder Module
File: dataset_pipeline/builder.py
Description: Assembles verified parsed/cleaned samples into standardized dataset
             batches ready for ML model training and evaluation.
==============================================================================
"""

import json
import os
from typing import Dict, Any, List
from dataset_pipeline.parser import ParsedSecurityRecord

class StandardDatasetSample(BaseModel):
    language: str
    vulnerable_code: str
    fixed_code: str
    vulnerability_type: str
    CWE: str
    severity: str
    root_cause: str
    attack_flow: List[str]
    fix_method: str

class SecurityDatasetBuilder:
    """
    Standardized Dataset Builder:
    Exports verified dataset into JSON/JSONL format matching exact specification schema.
    """
    def __init__(self, output_dir: str = "./data/processed"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def build_dataset_batch(self, cleaned_records: List[ParsedSecurityRecord], dataset_name: str = "security_dataset_v1.json") -> str:
        dataset_samples = []
        for rec in cleaned_records:
            sample = StandardDatasetSample(
                language=rec.language,
                vulnerable_code=rec.vulnerable_code,
                fixed_code=rec.fixed_code,
                vulnerability_type=rec.vulnerability_type,
                CWE=rec.cwe_id,
                severity=rec.severity,
                root_cause=rec.root_cause,
                attack_flow=rec.attack_flow,
                fix_method=rec.fix_method
            )
            dataset_samples.append(sample.model_dump())

        file_path = os.path.join(self.output_dir, dataset_name)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(dataset_samples, f, indent=2, ensure_ascii=False)

        print(f"📦 [Dataset Builder] Standardized dataset saved to {file_path} ({len(dataset_samples)} samples)")
        return file_path

if __name__ == "__main__":
    builder = SecurityDatasetBuilder()
    sample_rec = ParsedSecurityRecord(
        record_id="V-1", language="Python", vulnerable_code="query = f'SELECT * FROM u WHERE id={i}'",
        fixed_code="db.execute(query)", vulnerability_type="SQL Injection", cwe_id="CWE-89", severity="HIGH",
        root_cause="Lack of validation", attack_flow=["User input", "SQL Query", "Execute"], fix_method="Parameterize"
    )
    builder.build_dataset_batch([sample_rec], "sample_test.json")
