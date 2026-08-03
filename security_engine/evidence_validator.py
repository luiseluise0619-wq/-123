"""
Agent 4: Evidence Validator — REAL & SAFE (replaces fabricated sandbox theater).

이전 버전은 응답 패킷(REFUND_APPROVED / 300000)과 컨테이너 ID를 하드코딩하고
아무것도 실행하지 않은 채 "HYPOTHESIS_PROVEN_REPRODUCIBLE"를 반환했다(가짜).

진짜 증거란 무엇인가(안전한 정적 검증):
  - 라이브 시스템을 공격하지 않는다(위험·범위밖). 대신 "패치 전 코드에 취약점이
    실제로 있고, 패치 후 그 취약점이 실제로 사라졌다"를 실도구(Bandit)로 재검증한다.
  - before/after 스캔 결과와 코드에 SHA-256 지문을 찍어 재현 가능한 증거를 만든다.
  - verdict 는 스캐너가 실제로 확인한 사실에서만 나온다(주장 아님).
"""

import hashlib
import json
import time
from typing import Dict, Any, List

from pydantic import BaseModel

try:
    from security_engine.real_detector import scan_python_with_bandit
except Exception:
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from security_engine.real_detector import scan_python_with_bandit


class EvidenceRecord(BaseModel):
    evidence_id: str
    timestamp_utc: str
    method: str                       # 정직 표기: 정적 재검증(라이브 공격 아님)
    before_findings: int
    after_findings: int
    resolved: int
    before_rules: List[str]
    after_rules: List[str]
    code_before_sha256: str
    code_after_sha256: str
    reproduce: str                    # 누구나 재현할 수 있는 명령
    verdict: str


class EvidenceVerificationAgent:
    """정적 재스캔으로 '취약→해결'을 객관 검증하고 재현가능한 증거를 발급."""

    def verify_fix(self, code_before: str, code_after: str) -> EvidenceRecord:
        before = scan_python_with_bandit(code_before)
        after = scan_python_with_bandit(code_after)
        resolved = len(before) - len(after)

        if len(before) == 0:
            verdict = "NO_VULN_IN_ORIGINAL"          # 원본에 취약점 없음
        elif resolved > 0 and len(after) < len(before):
            verdict = "FIX_VERIFIED_BY_RESCAN"       # 재스캔으로 해결 확인
        elif len(after) >= len(before):
            verdict = "NOT_FIXED"                    # 여전히 취약(정직)
        else:
            verdict = "PARTIAL_FIX"

        sha_b = hashlib.sha256(code_before.encode()).hexdigest()
        sha_a = hashlib.sha256(code_after.encode()).hexdigest()
        return EvidenceRecord(
            evidence_id=f"EV-{time.strftime('%Y%m%d')}-{sha_a[:8]}",
            timestamp_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            method="static-rescan (Bandit); no live exploitation",
            before_findings=len(before),
            after_findings=len(after),
            resolved=max(resolved, 0),
            before_rules=sorted(f"{f['rule_id']}@{f.get('line')}" for f in before),
            after_rules=sorted(f"{f['rule_id']}@{f.get('line')}" for f in after),
            code_before_sha256=sha_b,
            code_after_sha256=sha_a,
            reproduce="bandit -q -ll <file_before> && bandit -q -ll <file_after>",
            verdict=verdict,
        )


if __name__ == "__main__":
    before = ("import hashlib\ndef d(x):\n    return hashlib.md5(x).hexdigest()\n")
    after = ("import hashlib\ndef d(x):\n    return hashlib.sha256(x).hexdigest()\n")
    ev = EvidenceVerificationAgent().verify_fix(before, after)
    print(ev.model_dump_json(indent=2))
