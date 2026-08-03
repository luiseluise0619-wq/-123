"""
==============================================================================
AegisAI - Multi-Agent Engine: Agent 1 - Expanded Static Analyzer
File: security_engine/static_analyzer.py
Description: Expanded SAST rulesets covering SSRF, Insecure Deserialization,
             OAuth Flaws, Cloud IAM Wildcards, Kubernetes Misconfigs, Secrets Exposure,
             Mobile Manifests, and Web AST patterns.
==============================================================================
"""

import re
from typing import Dict, Any, List
from pydantic import BaseModel

class StaticFinding(BaseModel):
    rule_id: str
    target_type: str  # 'Web', 'Android', 'iOS', 'Cloud/K8s'
    cwe_id: str
    title: str
    severity: str
    file_path: str
    code_snippet: str
    remediation: str

class StaticAnalysisAgent:
    """
    Agent 1: Expanded Static Analysis Agent
    Scans code, config manifests, cloud IAM templates, and secrets.
    """
    def __init__(self):
        pass

    def scan_source(self, code_content: str, file_path: str = "app.py") -> List[StaticFinding]:
        findings = []

        # 1. Hardcoded Secrets Exposure (CWE-798)
        if re.search(r"(?i)(aws_secret_access_key|api_key|secret_key|private_key|github_pat)\s*=\s*['\"][A-Za-z0-9/\+=]{16,}['\"]", code_content):
            findings.append(StaticFinding(
                rule_id="SAST-SEC-001",
                target_type="Web/Mobile/Cloud",
                cwe_id="CWE-798",
                title="Hardcoded API Secret Key Leak",
                severity="CRITICAL",
                file_path=file_path,
                code_snippet=code_content[:150],
                remediation="Store secrets in Environment Variables or KMS/Secret Manager."
            ))

        # 2. SSRF (Server-Side Request Forgery - CWE-918)
        if re.search(r"(?i)(requests\.get|fetch|http\.get)\s*\(\s*(req|payload|input|params)", code_content):
            findings.append(StaticFinding(
                rule_id="SAST-WEB-002",
                target_type="Web",
                cwe_id="CWE-918",
                title="Server-Side Request Forgery (SSRF) Unvalidated URL Fetch",
                severity="HIGH",
                file_path=file_path,
                code_snippet=code_content[:150],
                remediation="Enforce strict domain whitelist and block internal private IP ranges (127.0.0.1, 169.254.169.254)."
            ))

        # 3. Insecure Deserialization (CWE-502)
        if re.search(r"(?i)(pickle\.loads|yaml\.unsafe_load|ObjectInputStream|eval\s*\()", code_content):
            findings.append(StaticFinding(
                rule_id="SAST-WEB-003",
                target_type="Web",
                cwe_id="CWE-502",
                title="Insecure Deserialization of Untrusted User Input",
                severity="CRITICAL",
                file_path=file_path,
                code_snippet=code_content[:150],
                remediation="Use safe serialization formats like JSON/Protocol Buffers instead of binary object deserialization."
            ))

        # 4. OAuth 2.0 Missing State CSRF Validation (CWE-601 / CWE-352)
        if ("oauth" in code_content.lower() or "authorize" in code_content.lower()) and "state" not in code_content.lower():
            findings.append(StaticFinding(
                rule_id="SAST-WEB-004",
                target_type="Web",
                cwe_id="CWE-601",
                title="OAuth 2.0 Missing State Parameter CSRF Vulnerability",
                severity="HIGH",
                file_path=file_path,
                code_snippet=code_content[:150],
                remediation="Include unguessable cryptographic 'state' parameter in OAuth authorization requests to prevent CSRF."
            ))

        # 5. Cloud IAM Wildcard Over-Privilege (CWE-732)
        if re.search(r'(?i)"Effect"\s*:\s*"Allow"\s*,\s*"Action"\s*:\s*"\*"\s*,\s*"Resource"\s*:\s*"\*"', code_content):
            findings.append(StaticFinding(
                rule_id="SAST-CLOUD-001",
                target_type="Cloud IAM",
                cwe_id="CWE-732",
                title="AWS/GCP Cloud IAM Full Admin Wildcard Action (Action: *) Over-Privilege",
                severity="CRITICAL",
                file_path=file_path if file_path != "app.py" else "iam_policy.json",
                code_snippet='"Effect": "Allow", "Action": "*", "Resource": "*"',
                remediation="Restrict IAM policies to least-privilege specific actions and resource ARNs."
            ))

        # 6. Kubernetes Privileged Container / HostPath Mount (CWE-250)
        if "privileged: true" in code_content or "runAsUser: 0" in code_content:
            findings.append(StaticFinding(
                rule_id="SAST-K8S-001",
                target_type="Kubernetes",
                cwe_id="CWE-250",
                title="Kubernetes Deployment Running Privileged Root Container",
                severity="HIGH",
                file_path=file_path if file_path != "app.py" else "deployment.yaml",
                code_snippet="securityContext: { privileged: true, runAsUser: 0 }",
                remediation="Set `privileged: false` and enforce non-root user execution (`runAsNonRoot: true`)."
            ))

        # 7. Android Manifest MODE_WORLD_READABLE check
        if "MODE_WORLD_READABLE" in code_content:
            findings.append(StaticFinding(
                rule_id="SAST-MOB-001",
                target_type="Android",
                cwe_id="CWE-922",
                title="Android Insecure Shared Preferences Exposure (MODE_WORLD_READABLE)",
                severity="HIGH",
                file_path=file_path,
                code_snippet="getSharedPreferences(\"user_session\", MODE_WORLD_READABLE)",
                remediation="Use MODE_PRIVATE for local storage."
            ))

        # 8. iOS Info.plist ATS check
        if "NSAllowsArbitraryLoads" in code_content and "<true/>" in code_content:
            findings.append(StaticFinding(
                rule_id="SAST-MOB-002",
                target_type="iOS",
                cwe_id="CWE-319",
                title="iOS App Transport Security (ATS) Cleartext HTTP Permitted",
                severity="HIGH",
                file_path="Info.plist",
                code_snippet="<key>NSAllowsArbitraryLoads</key><true/>",
                remediation="Set NSAllowsArbitraryLoads to false and enforce HTTPS."
            ))

        return findings

if __name__ == "__main__":
    agent = StaticAnalysisAgent()
    res = agent.scan_source('{"Effect": "Allow", "Action": "*", "Resource": "*"}', "iam_policy.json")
    print(res)
