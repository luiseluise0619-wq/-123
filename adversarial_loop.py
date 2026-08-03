"""
Red / Blue / Judge self-play — built REAL and SAFE.

  Red   : injects KNOWN vulnerable patterns into code (generates test cases).
          It does NOT attack any live system — it only produces code strings.
  Judge : the real static analyzer (Bandit). Objectively confirms whether the
          generated code is actually vulnerable, and whether Blue's patch fixed it.
          Reward comes from the Judge, never from Red/Blue self-claims.
  Blue  : the patch agent (deterministic transforms, re-scan verified).

Every verified (vulnerable -> patched -> confirmed) triple is appended as
self-generated, Judge-labeled training data. No fabrication: if the Judge does
not confirm, no reward and no data is recorded.

SAFETY: static analysis only, offline, no exploitation of real systems.
"""

import json
import os
from typing import Dict, Any, List

from security_engine.real_detector import scan_python_with_bandit
from security_ai_core import patch_agent, reasoning_agent

DATASET = os.path.join(os.path.dirname(os.path.abspath(__file__)), "selfplay_dataset.jsonl")

# Red 의 "공격" = 안전한 취약 패턴 주입 (라이브 공격 아님)
RED_INJECTIONS = [
    ("weak_hash", "import hashlib\ndef f(d):\n    return hashlib.md5(d).hexdigest()\n"),
    ("cmd_injection", "import subprocess\ndef run(c):\n    subprocess.call(c, shell=True)\n"),
    ("insecure_temp", "import tempfile, os\ndef t():\n    p = tempfile.mktemp()\n    return p\n"),
    ("assert_used", "def check(x):\n    assert x > 0, 'bad'\n    return x\n"),
]


def judge(code: str) -> List[Dict[str, Any]]:
    """객관 판정관 = 진짜 정적분석."""
    return scan_python_with_bandit(code)


def run_selfplay(rounds: int = None) -> Dict[str, Any]:
    scoreboard = {"red_points": 0, "blue_points": 0, "judge_verified": 0}
    records = []
    for name, vuln_code in RED_INJECTIONS:
        # 1) Red 생성 → Judge 가 실제 취약한지 확인
        before = judge(vuln_code)
        if not before:
            continue  # Judge가 취약 인정 안 하면 Red 점수 없음(주장만으론 X)
        scoreboard["red_points"] += 100

        # 2) Blue 패치 (첫 finding 대상)
        patch = patch_agent(vuln_code, before[0])
        if not patch["patched"]:
            records.append({"attack": name, "cwe": before[0].get("cwe"),
                            "blue": "no_deterministic_fix", "verified_fixed": False})
            continue

        # 3) Judge 재판정: 실제로 해결됐나
        after = judge(patch["code"])
        fixed = len(after) < len(before)
        if fixed:
            scoreboard["blue_points"] += 100
            scoreboard["judge_verified"] += 50
            records.append({
                "attack": name,
                "reasoning": reasoning_agent(before[0]),
                "vulnerable_code": vuln_code,
                "patched_code": patch["code"],
                "cwe": reasoning_agent(before[0])["cwe"],
                "verified_fixed": True,   # Judge가 재스캔으로 확인 (주장 아님)
            })

    # Judge가 확인한 것만 학습데이터로 저장
    with open(DATASET, "a", encoding="utf-8") as f:
        for r in records:
            if r.get("verified_fixed"):
                f.write(json.dumps(r, ensure_ascii=False) + "\n")

    return {"scoreboard": scoreboard, "records": records,
            "verified_samples_saved": sum(1 for r in records if r.get("verified_fixed"))}


if __name__ == "__main__":
    result = run_selfplay()
    print("=== Red/Blue/Judge Self-Play (안전·정적분석) ===\n")
    for r in result["records"]:
        status = "✅ Judge 검증 해결" if r.get("verified_fixed") else "⚠️ 결정적수정 불가(LLM 필요)"
        print(f"  [{r['attack']}] CWE={r.get('cwe')} → {status}")
    print(f"\n점수판: {result['scoreboard']}")
    print(f"Judge가 검증한 학습샘플 저장: {result['verified_samples_saved']}건 → selfplay_dataset.jsonl")
    print("※ 보상은 전부 Judge(실제 스캐너)가 부여 — Red/Blue 자기주장 아님.")
