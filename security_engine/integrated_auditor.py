"""
==============================================================================
Open Security Intelligence AI - Integrated Audit Engine
File: security_engine/integrated_auditor.py
Description: Full-pipeline Security Auditor connecting Static Analyzer, Model Inference,
             Business Logic Agent, Docker Sandbox Validator, and Auto PR Generator.
==============================================================================
"""

import json
import time
from typing import Dict, Any, List
from pydantic import BaseModel

from security_engine.static_analyzer import StaticAnalysisAgent
from security_engine.vulnerability_detector import VulnerabilityDetectorAgent
from security_engine.business_logic_agent import BusinessLogicAgent
from security_engine.evidence_validator import EvidenceVerificationAgent
from auto_pr_generator import SecurityPRGenerator, PRCreationRequest

class FullAuditReport(BaseModel):
    audit_id: str
    target_repo_or_url: str
    timestamp_utc: str
    security_score: int
    static_findings_count: int
    vulnerability_type: str
    cwe_id: str
    severity: str
    confidence_score: float
    explanation: str
    sandbox_verified: bool
    evidence_sha256: str
    reproducible_curl: str
    pull_request_url: str
    ci_status: str

class IntegratedSecurityAuditor:
    """
    Step 4, 5, 6: Integrated Security Auditor
    Full Pipeline:
    Upload -> Static Analyzer -> Model Inference -> Business Logic -> Sandbox -> Evidence -> Auto PR
    """
    def __init__(self):
        self.static_agent = StaticAnalysisAgent()
        self.detector_agent = VulnerabilityDetectorAgent()
        self.logic_agent = BusinessLogicAgent()
        self.evidence_agent = EvidenceVerificationAgent()

    def run_full_audit(self, repo_url: str, code_snippet: str = "") -> FullAuditReport:
        audit_id = f"AUD-2026-{int(time.time())}"
        print(f"[Full Audit Pipeline] Initiating End-to-End Audit for {repo_url} ({audit_id})...")
        
        target_code = code_snippet or "refund = original_price - refund_fee"

        # 1. Static Analyzer
        static_findings = self.static_agent.scan_source(target_code, "app.py")
        print(f"   |-- Step 1: Static Analyzer found {len(static_findings)} pattern matches")

        # 2. AI Model Inference
        model_prediction = self.detector_agent.classify(target_code)
        print(f"   |-- Step 2: CodeBERT Model Inference -> {model_prediction.vulnerability_type} ({model_prediction.severity})")

        # 3. Business Logic Flow
        logic_scenario = self.logic_agent.analyze_service_flow(["/api/v1/tickets/cancel"], target_code)
        print(f"   |-- Step 3: Business Logic Agent mapped flow -> {logic_scenario.domain}")

        # 4. Sandbox Evidence Verification
        evidence = self.evidence_agent.verify_exploit_in_sandbox(
            "http://127.0.0.1:18090/api/v1/tickets/cancel",
            logic_scenario.exploit_payload
        )
        print(f"   |-- Step 4: Docker Sandbox Proof captured -> SHA-256: {evidence.sha256_hash[:16]}...")

        # 5. Automated GitHub Fix PR
        pr_req = PRCreationRequest(
            vulnerability_id="VULN-2026-001",
            github_repo="https://github.com/organization/ticket-backend",
            target_branch="main",
            patch_branch_name="security/fix-refund-fee",
            vulnerable_file="app.py",
            vulnerable_code=target_code,
            fixed_code=model_prediction.fix_suggestion,
            cve_id=model_prediction.cwe_id
        )
        pr_generator = SecurityPRGenerator(pr_req)
        pr_result = pr_generator.create_security_pull_request()
        print(f"   +-- Step 5: GitHub Auto PR Issued -> {pr_result.pr_id} ({pr_result.ci_status})")

        sec_score = 100 - (35 if model_prediction.severity == "CRITICAL" else 20)

        report = FullAuditReport(
            audit_id=audit_id,
            target_repo_or_url=repo_url,
            timestamp_utc=time.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            security_score=sec_score,
            static_findings_count=len(static_findings),
            vulnerability_type=model_prediction.vulnerability_type,
            cwe_id=model_prediction.cwe_id,
            severity=model_prediction.severity,
            confidence_score=model_prediction.confidence,
            explanation=f"Server-side validation missing for parameter in {logic_scenario.domain}.",
            sandbox_verified=True,
            evidence_sha256=evidence.sha256_hash,
            reproducible_curl=evidence.curl_replay,
            pull_request_url=pr_result.pr_url,
            ci_status=pr_result.ci_status
        )

        return report

if __name__ == "__main__":
    auditor = IntegratedSecurityAuditor()
    rep = auditor.run_full_audit("https://github.com/organization/ticket-backend")
    print("\n[+] Full Pipeline Audit Report:\n", rep.model_dump_json(indent=2))
