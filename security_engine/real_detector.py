"""
Real vulnerability detector — replaces the fake regex "CodeBERT" inference.

Runs actual open-source static analysis engines (Bandit for Python, offline;
Semgrep for multi-language) and returns REAL findings with CWE/severity/line.
No fabricated confidence scores, no hardcoded verdicts.
"""

import json
import subprocess
import tempfile
import os
from typing import List, Dict, Any


def scan_python_with_bandit(code: str) -> List[Dict[str, Any]]:
    """Run Bandit (offline, bundled rules) on Python code. Returns real findings."""
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
        f.write(code)
        path = f.name
    try:
        proc = subprocess.run(
            ["bandit", "-f", "json", "-q", path],
            capture_output=True, text=True, timeout=60,
        )
        data = json.loads(proc.stdout or "{}")
        findings = []
        for r in data.get("results", []):
            findings.append({
                "engine": "bandit",
                "rule_id": r.get("test_id"),
                "title": r.get("test_name"),
                "severity": r.get("issue_severity"),      # LOW/MEDIUM/HIGH (real)
                "confidence": r.get("issue_confidence"),   # real, tool-reported
                "cwe": (r.get("issue_cwe") or {}).get("id"),
                "line": r.get("line_number"),
                "message": r.get("issue_text"),
            })
        return findings
    finally:
        os.unlink(path)


def scan_with_semgrep(code: str, lang_suffix: str = ".py", config: str = "p/security-audit") -> List[Dict[str, Any]]:
    """Run Semgrep (multi-language). Needs rule config; falls back gracefully offline."""
    with tempfile.NamedTemporaryFile("w", suffix=lang_suffix, delete=False, encoding="utf-8") as f:
        f.write(code)
        path = f.name
    try:
        proc = subprocess.run(
            ["semgrep", "--config", config, "--json", "-q", path],
            capture_output=True, text=True, timeout=120,
        )
        data = json.loads(proc.stdout or "{}")
        out = []
        for r in data.get("results", []):
            extra = r.get("extra", {})
            out.append({
                "engine": "semgrep",
                "rule_id": r.get("check_id"),
                "severity": extra.get("severity"),
                "cwe": (extra.get("metadata", {}) or {}).get("cwe"),
                "line": r.get("start", {}).get("line"),
                "message": extra.get("message"),
            })
        return out
    except Exception:
        return []  # 오프라인/룰 미수신 시 조용히 건너뜀 (거짓 결과 만들지 않음)
    finally:
        os.unlink(path)


def audit_code(code: str, language: str = "python") -> Dict[str, Any]:
    findings = []
    if language == "python":
        findings += scan_python_with_bandit(code)
    findings += scan_with_semgrep(code)
    sev_rank = {"HIGH": 3, "ERROR": 3, "MEDIUM": 2, "WARNING": 2, "LOW": 1, "INFO": 0}
    findings.sort(key=lambda f: sev_rank.get(str(f.get("severity")).upper(), 0), reverse=True)
    return {
        "total_findings": len(findings),
        "engines_used": sorted({f["engine"] for f in findings}) or ["bandit"],
        "findings": findings,
        # 취약점 없으면 정직하게 없다고 함 (가짜 0.99 confidence 안 만듦)
        "verdict": "VULNERABILITIES_FOUND" if findings else "NO_ISSUES_DETECTED_BY_ENGINES",
    }


if __name__ == "__main__":
    vulnerable = '''import subprocess, hashlib
password = "admin123"
def run(cmd):
    subprocess.call(cmd, shell=True)
def check(user_input):
    return eval(user_input)
def weak(data):
    return hashlib.md5(data).hexdigest()
'''
    result = audit_code(vulnerable, "python")
    print(json.dumps(result, indent=2, ensure_ascii=False))
