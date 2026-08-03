"""
Security Patch Generator — REAL unified diff (no fabricated PR / fake CI).

이전 버전은 PR 번호/URL 을 지어내고 ci_status="PASSED", checks_passed=12 를
하드코딩한 채 아무것도 실제로 하지 않았다(가짜).

이 버전은 실제로 유용한 산출물을 만든다:
  - 취약 코드 → 패치 코드의 진짜 unified diff(git apply 가능)를 생성한다.
  - 원한다면 .patch 파일로 저장한다.
  - GitHub PR 은 실제 토큰/저장소가 연결됐을 때만 별도 도구로 생성한다.
    여기서 CI 통과를 주장하지 않는다(검증은 실행해봐야 아는 것).
"""

import difflib
import os
from typing import Optional

from pydantic import BaseModel


class PatchArtifact(BaseModel):
    file_path: str
    unified_diff: str
    changed: bool
    applies_cleanly_hint: str
    saved_to: Optional[str] = None


class SecurityPatchGenerator:
    """취약→패치 코드의 진짜 unified diff 생성. 가짜 PR/CI 주장 없음."""

    def make_patch(self, file_path: str, vulnerable_code: str, fixed_code: str,
                   save_dir: Optional[str] = None) -> PatchArtifact:
        before = vulnerable_code.splitlines(keepends=True)
        after = fixed_code.splitlines(keepends=True)
        diff = "".join(difflib.unified_diff(
            before, after, fromfile=f"a/{file_path}", tofile=f"b/{file_path}"))
        changed = bool(diff.strip())

        saved = None
        if changed and save_dir:
            os.makedirs(save_dir, exist_ok=True)
            saved = os.path.join(save_dir, os.path.basename(file_path) + ".patch")
            with open(saved, "w", encoding="utf-8") as f:
                f.write(diff)

        return PatchArtifact(
            file_path=file_path,
            unified_diff=diff,
            changed=changed,
            applies_cleanly_hint=("git apply <patch> 로 적용 후 테스트 실행 필요 "
                                  "(CI 통과 여부는 실행 전 알 수 없음)"),
            saved_to=saved,
        )


if __name__ == "__main__":
    gen = SecurityPatchGenerator()
    art = gen.make_patch(
        "app.py",
        "import hashlib\ndef d(x):\n    return hashlib.md5(x).hexdigest()\n",
        "import hashlib\ndef d(x):\n    return hashlib.sha256(x).hexdigest()\n",
    )
    print(art.unified_diff or "(no change)")
    print("changed:", art.changed)
