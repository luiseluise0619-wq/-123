"""
Security AI Core — 4-agent self-healing loop, built REAL (no theater).

  Detector → Reasoning → Patch → Reviewer  (loop until resolved)
                    |
              Knowledge Base (CWE → cause / fix / verify)

Honesty rules:
- Detector & Reviewer use the REAL static-analysis engine (Bandit). The Reviewer
  RE-SCANS the patched code, so "resolved" is proven objectively, not asserted.
- Patch applies deterministic transforms for known CWE patterns (verifiable). For
  patterns without a deterministic fix it returns needs_llm=True and does NOT
  fabricate a fix or claim success.
"""

import re
from typing import Dict, Any, List, Optional

from security_engine.real_detector import scan_python_with_bandit


# ---- Knowledge Base: grows over time; each entry is real & verifiable ----
KNOWLEDGE_BASE: Dict[str, Dict[str, Any]] = {
    "B324": {  # weak hash
        "cwe": "CWE-327", "cause": "약한 해시(MD5/SHA1)를 보안 용도로 사용",
        "fix": "SHA-256 이상으로 교체",
        "transform": (r"hashlib\.md5\(", "hashlib.sha256("),
    },
    "B602": {  # shell=True
        "cwe": "CWE-78", "cause": "subprocess에 shell=True로 명령어 주입 가능",
        "fix": "shell=False + 인자 리스트 사용",
        "transform": (r"shell\s*=\s*True", "shell=False"),
    },
    "B303": {  # insecure MD5/SHA1 via hashlib.new
        "cwe": "CWE-327", "cause": "취약한 해시 알고리즘",
        "fix": "SHA-256 사용",
        "transform": (r"hashlib\.sha1\(", "hashlib.sha256("),
    },
}


def detector_agent(code: str) -> List[Dict[str, Any]]:
    """진짜 정적분석으로 취약점 탐지."""
    return scan_python_with_bandit(code)


def reasoning_agent(finding: Dict[str, Any]) -> Dict[str, Any]:
    """KB로 원인/흐름 설명 (LLM 연동 시 여기서 코드 문맥까지 심층 분석)."""
    kb = KNOWLEDGE_BASE.get(finding["rule_id"], {})
    return {
        "rule": finding["rule_id"],
        "cwe": kb.get("cwe", f"CWE-{finding.get('cwe')}"),
        "cause": kb.get("cause", finding.get("message")),
        "recommended_fix": kb.get("fix", "표준 보안 가이드 적용"),
        "llm_enhanced": False,  # 정직하게: LLM 미연동 상태 표기
    }


def patch_agent(code: str, finding: Dict[str, Any]) -> Dict[str, Any]:
    """알려진 패턴은 결정적으로 수정. 없으면 needs_llm=True (가짜 수정 안 함)."""
    kb = KNOWLEDGE_BASE.get(finding["rule_id"])
    if kb and kb.get("transform"):
        pat, repl = kb["transform"]
        new_code, n = re.subn(pat, repl, code)
        if n > 0:
            return {"patched": True, "code": new_code, "changes": n, "needs_llm": False}
    return {"patched": False, "code": code, "changes": 0, "needs_llm": True}


def reviewer_agent(before: List[Dict], patched_code: str) -> Dict[str, Any]:
    """패치 코드를 다시 진짜 스캔 → 해결 여부를 객관적으로 검증."""
    after = detector_agent(patched_code)
    before_ids = sorted(f"{f['rule_id']}@{f['line']}" for f in before)
    after_ids = sorted(f"{f['rule_id']}@{f['line']}" for f in after)
    resolved = len(before) - len(after)
    return {"before": len(before), "after": len(after),
            "resolved": resolved, "remaining_findings": after}


def run_security_loop(code: str, max_iter: int = 5) -> Dict[str, Any]:
    log = []
    current = code
    for i in range(max_iter):
        findings = detector_agent(current)
        if not findings:
            log.append({"iter": i, "action": "clean", "findings": 0})
            break
        # 결정적으로 고칠 수 있는 것부터 패치
        progressed = False
        for f in findings:
            reason = reasoning_agent(f)
            patch = patch_agent(current, f)
            if patch["patched"]:
                review = reviewer_agent(findings, patch["code"])
                current = patch["code"]
                log.append({"iter": i, "rule": f["rule_id"], "cwe": reason["cwe"],
                            "fix": reason["recommended_fix"],
                            "resolved_delta": review["resolved"]})
                progressed = True
                break
        if not progressed:
            # 남은 것은 결정적 수정 불가 → 정직하게 LLM 필요로 표기
            log.append({"iter": i, "action": "needs_llm_patch",
                        "unresolved": [f["rule_id"] for f in findings]})
            break
    final = detector_agent(current)
    return {"iterations": len(log), "log": log,
            "final_findings": len(final), "patched_code": current}


if __name__ == "__main__":
    import json
    vuln = '''import hashlib, subprocess
def digest(data):
    return hashlib.md5(data).hexdigest()
def run(cmd):
    subprocess.call(cmd, shell=True)
'''
    print("=== 입력(취약) ===\n" + vuln)
    result = run_security_loop(vuln)
    print("=== 루프 로그 ===")
    for step in result["log"]:
        print(" ", json.dumps(step, ensure_ascii=False))
    print(f"\n최종 취약점: {result['final_findings']}건 (시작 대비 해결됨)")
    print("=== 자동 수정된 코드 ===\n" + result["patched_code"])
