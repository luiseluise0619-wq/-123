"""
==============================================================================
Open Security Intelligence AI - Dataset Pipeline: Cleaner Module
File: dataset_pipeline/cleaner.py
Description: Data Quality Filtering, Deduplication (SHA-256), Invalid Code Removal,
             and Automated Quality Score Assessment.
==============================================================================
"""

import hashlib
from typing import Dict, Any, List, Tuple
from dataset_pipeline.parser import ParsedSecurityRecord

class SecurityDataCleaner:
    """
    Quality Audit & Deduplication Engine:
    - SHA-256 Hashing Deduplication
    - Empty/Malformed Code Removal
    - Data Quality Score Calculation (Quality Threshold >= 0.75)
    """
    def __init__(self, quality_threshold: float = 0.75):
        self.seen_hashes = set()
        self.quality_threshold = quality_threshold

    def clean_and_audit(self, records: List[ParsedSecurityRecord]) -> Tuple[List[ParsedSecurityRecord], Dict[str, int]]:
        cleaned = []
        metrics = {"ingested": len(records), "duplicates_removed": 0, "corrupted_dropped": 0, "passed": 0}

        for rec in records:
            # 1. Minimum Length & Validation
            if not rec.vulnerable_code or len(rec.vulnerable_code.strip()) < 8:
                metrics["corrupted_dropped"] += 1
                continue

            # 2. SHA-256 Deduplication
            content_hash = hashlib.sha256(f"{rec.vulnerable_code}:{rec.cwe_id}".encode()).hexdigest()
            if content_hash in self.seen_hashes:
                metrics["duplicates_removed"] += 1
                continue
            self.seen_hashes.add(content_hash)

            # 3. Quality Score Rules
            quality_score = 1.0
            if not rec.fixed_code:
                quality_score -= 0.15
            if rec.vulnerable_code == rec.fixed_code and rec.fixed_code != "":
                quality_score -= 0.35

            if quality_score >= self.quality_threshold:
                cleaned.append(rec)

        metrics["passed"] = len(cleaned)
        print(f"🧹 [Data Cleaner] Audit Complete: {metrics['passed']}/{metrics['ingested']} passed (Duplicates: {metrics['duplicates_removed']}, Dropped: {metrics['corrupted_dropped']})")
        return cleaned, metrics

if __name__ == "__main__":
    from dataset_pipeline.parser import ParsedSecurityRecord
    cleaner = SecurityDataCleaner()
    dummy_records = [
        ParsedSecurityRecord(
            record_id="V-1", language="Python", vulnerable_code="query = f'SELECT * FROM u WHERE id={i}'",
            fixed_code="db.execute(query)", vulnerability_type="SQLi", cwe_id="CWE-89", severity="HIGH",
            root_cause="Lack of validation", attack_flow=["step 1"], fix_method="Parameterize"
        )
    ]
    cleaned, metrics = cleaner.clean_and_audit(dummy_records)
    print("Cleaned Records Count:", len(cleaned))
