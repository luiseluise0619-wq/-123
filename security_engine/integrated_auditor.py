"""
Integrated Security Auditor — REAL end-to-end pipeline (no theater).

이전 버전은 가짜 컴포넌트(CodeBERT 추론 흉내, 하드코딩 샌드박스 증거, 가짜 PR)를
엮고 sandbox_verified=True 와 security_score 를 지어냈다.

이 버전은 실제 컴포넌트만 연결한다:
  1) 탐지  : ModelInferenceEngine (Bandit 실도구 + 있으면 학습모델 확률)
  2) 추론  : reasoning_agent (KB 기반 원인/권고)
  3) 패치  : patch_agent (결정적 수정 가능하면 수정, 아니면 needs_llm=True 정직표기)
  4) 검증  : EvidenceVerificationAgent.verify_fix (패치 전/후 재스캔으로 객관 확인)

모든 verdict/숫자는 실제 도구가 낸 값이다. 못 고치는 건 못 고친다고 정직하게 낸다.
자동 PR 은 실제 GitHub 연동이 있을 때만 — 기본은 요약만 내고 지어내지 않는다.
"""

import time
from typing import Dict, Any, List, Optional

from pydantic import BaseModel

from ml.inference import ModelInferenceEngine
from security_ai_core import reasoning_agent, patch_agent
from security_engine.evidence_validator import EvidenceVerificationAgent


class AuditReport(BaseModel):
    audit_id: str
    timestamp_utc: str
    engine: str
    findings_count: int
    findings: List[Dict[str, Any]]
    model_available: bool
    model_vuln_probability: Optional[float]
    patch_applied: bool
    patch_needs_llm: bool
    patched_code: Optional[str]
    fix_verified_by_rescan: bool
    evidence: Optional[Dict[str, Any]]
    reasoning: List[Dict[str, Any]]


class IntegratedSecurityAuditor:
    """탐지→추론→패치→재스캔검증. 전부 실제 도구."""

    def __init__(self):
        self.inference = ModelInferenceEngine()
        self.evidence_agent = EvidenceVerificationAgent()

    def run_full_audit(self, code_snippet: str) -> AuditReport:
        audit_id = f"AUD-{int(time.time())}"
        pred = self.inference.predict(code_snippet)
        findings = [f.model_dump() for f in pred.findings]

        # 추론(원인/권고)
        reasoning = [reasoning_agent({"rule_id": f["rule_id"], "cwe": f.get("cwe"),
                                      "message": f.get("message")})
                     for f in findings]

        # 패치: 결정적으로 고칠 수 있는 finding 을 순회하며 모두 적용
        patched_code, applied, needs_llm = code_snippet, False, False
        for f in findings:
            patch = patch_agent(patched_code, {"rule_id": f["rule_id"]})
            if patch["patched"]:
                patched_code = patch["code"]; applied = True
            elif patch.get("needs_llm"):
                needs_llm = True  # 결정적 수정 불가한 게 남아있음(정직 표기)

        # 검증: 패치 전/후 재스캔으로 객관 확인
        evidence, verified = None, False
        if applied:
            ev = self.evidence_agent.verify_fix(code_snippet, patched_code)
            evidence = ev.model_dump()
            verified = ev.verdict == "FIX_VERIFIED_BY_RESCAN"

        return AuditReport(
            audit_id=audit_id,
            timestamp_utc=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            engine=pred.engine,
            findings_count=pred.num_findings,
            findings=findings,
            model_available=pred.model_available,
            model_vuln_probability=pred.model_vuln_probability,
            patch_applied=applied,
            patch_needs_llm=needs_llm,
            patched_code=patched_code if applied else None,
            fix_verified_by_rescan=verified,
            evidence=evidence,
            reasoning=reasoning,
        )


if __name__ == "__main__":
    code = ("import hashlib, subprocess\n"
            "def digest(d):\n    return hashlib.md5(d).hexdigest()\n"
            "def run(c):\n    subprocess.call(c, shell=True)\n")
    report = IntegratedSecurityAuditor().run_full_audit(code)
    print(report.model_dump_json(indent=2))
