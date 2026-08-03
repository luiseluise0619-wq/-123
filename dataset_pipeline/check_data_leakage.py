"""
==============================================================================
AegisAI - Data Leakage & Overlap Audit Engine
File: dataset_pipeline/check_data_leakage.py
Description: Audits train.jsonl, val.jsonl, and test.jsonl to detect:
             1. Same CVE ID present in both train & test.
             2. Same GitHub Repo URL present in both train & test.
             3. Code snippet exact hash collision.
             4. Patch before/after code mix-up.
             Outputs data_leakage_report.json.
==============================================================================
"""

import json
import os
import hashlib
from typing import Dict, Any, List, Set

def audit_data_leakage(dataset_dir: str = "./data/dataset_v2") -> Dict[str, Any]:
    train_file = os.path.join(dataset_dir, "train.jsonl")
    val_file = os.path.join(dataset_dir, "val.jsonl")
    test_file = os.path.join(dataset_dir, "test.jsonl")

    def load_jsonl(filepath: str) -> List[Dict[str, Any]]:
        items = []
        if not os.path.exists(filepath):
            return items
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    items.append(json.loads(line))
        return items

    train_data = load_jsonl(train_file)
    val_data = load_jsonl(val_file)
    test_data = load_jsonl(test_file)

    train_cves = {item.get("cve_id") for item in train_data if item.get("cve_id")}
    test_cves = {item.get("cve_id") for item in test_data if item.get("cve_id")}

    train_repos = {item.get("source_url") for item in train_data if item.get("source_url")}
    test_repos = {item.get("source_url") for item in test_data if item.get("source_url")}

    train_code_hashes = {hashlib.sha256(item["vulnerable_code"].encode()).hexdigest() for item in train_data if "vulnerable_code" in item}
    test_code_hashes = {hashlib.sha256(item["vulnerable_code"].encode()).hexdigest() for item in test_data if "vulnerable_code" in item}

    cve_overlap = train_cves.intersection(test_cves)
    repo_overlap = train_repos.intersection(test_repos)
    code_hash_overlap = train_code_hashes.intersection(test_code_hashes)

    # Check for inverted patch code
    patch_inversion_bugs = []
    for item in (train_data + test_data):
        if item.get("vulnerable_code") == item.get("fixed_code"):
            patch_inversion_bugs.append(item.get("sample_id"))

    has_leakage = bool(cve_overlap or repo_overlap or code_hash_overlap or patch_inversion_bugs)

    report = {
        "audit_timestamp": "2026-08-03T17:00:00Z",
        "dataset_directory": os.path.abspath(dataset_dir),
        "dataset_sample_counts": {
            "train_samples": len(train_data),
            "val_samples": len(val_data),
            "test_samples": len(test_data)
        },
        "data_leakage_detected": has_leakage,
        "leakage_checks": {
            "cve_id_overlap_count": len(cve_overlap),
            "cve_id_overlaps": list(cve_overlap),
            "github_repo_overlap_count": len(repo_overlap),
            "github_repo_overlaps": list(repo_overlap),
            "code_hash_overlap_count": len(code_hash_overlap),
            "patch_inversion_bugs_count": len(patch_inversion_bugs)
        },
        "audit_verdict": "PASSED_ZERO_LEAKAGE" if not has_leakage else "FAILED_LEAKAGE_FOUND"
    }

    report_path = "./data_leakage_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"[Data Leakage Auditor] Audit completed. Verdict: {report['audit_verdict']}. Report -> {report_path}")
    return report

if __name__ == "__main__":
    audit_data_leakage()
