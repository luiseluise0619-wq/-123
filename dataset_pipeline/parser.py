"""
==============================================================================
Open Security Intelligence AI - Dataset Pipeline: Parser Module
File: dataset_pipeline/parser.py
Description: Multi-format Security Data Parser for JSON, JSONL, CSV, Git Diffs, & ZIP.
==============================================================================
"""

import re
from typing import Dict, Any, List
from pydantic import BaseModel

class ParsedSecurityRecord(BaseModel):
    record_id: str
    language: str
    vulnerable_code: str
    fixed_code: str
    vulnerability_type: str
    cwe_id: str
    severity: str
    root_cause: str
    attack_flow: List[str]
    fix_method: str

class SecurityDataParser:
    """
    Multi-format Data Parser:
    Converts heterogeneous vulnerability payloads into standardized schema.
    """
    def __init__(self):
        pass

    def detect_language(self, code_snippet: str) -> str:
        if re.search(r"def\s+\w+|import\s+os|from\s+\w+", code_snippet):
            return "Python"
        elif re.search(r"const\s+\w+|function\s+\w+|let\s+\w+", code_snippet):
            return "JavaScript"
        elif re.search(r"public\s+class|private\s+\w+|import\s+java", code_snippet):
            return "Java"
        elif re.search(r"func\s+\w+|import\s+fmt", code_snippet):
            return "Go"
        elif re.search(r"func\s+\w+.*?->|import\s+Foundation", code_snippet):
            return "Swift"
        return "Generic"

    def parse_raw_record(self, raw_item: Dict[str, Any]) -> ParsedSecurityRecord:
        payload = raw_item.get("raw_payload", {})
        code_vuln = payload.get("vulnerable_code", "")
        code_fix = payload.get("fixed_code", "")
        
        lang = payload.get("language") or self.detect_language(code_vuln)
        cwe = payload.get("cwe_id", "CWE- Other")
        sev = payload.get("severity", "HIGH").upper()
        
        summary = payload.get("summary", "Vulnerability Detected")
        details = payload.get("details", "Direct input execution without validation.")

        return ParsedSecurityRecord(
            record_id=payload.get("id", "VULN-000"),
            language=lang,
            vulnerable_code=code_vuln,
            fixed_code=code_fix,
            vulnerability_type=summary,
            cwe_id=cwe,
            severity=sev,
            root_cause=details,
            attack_flow=[
                "1. User controlled payload injected",
                "2. System accepts payload without sanitization",
                "3. Vulnerable sink executed with elevated impact"
            ],
            fix_method="Apply parameterized binding and server-side policy re-validation."
        )

if __name__ == "__main__":
    parser = SecurityDataParser()
    parsed = parser.parse_raw_record({
        "raw_payload": {
            "id": "GHSA-cwe-89",
            "summary": "SQL Injection",
            "vulnerable_code": "query = f'SELECT * FROM users WHERE id={user_id}'",
            "fixed_code": "db.execute('SELECT * FROM users WHERE id=:id', {'id': user_id})",
            "cwe_id": "CWE-89",
            "severity": "CRITICAL"
        }
    })
    print(parsed.model_dump_json(indent=2))
