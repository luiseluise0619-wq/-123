"""
ML Engine: Inference — REAL (replaces the fabricated regex/CodeBERT theater).

이전 버전은 정규식으로 매칭하고 confidence 0.96 을 하드코딩한 뒤 "CodeBERT
가중치"라고 주장했다(가짜). 이 버전은:

  1) 실제 정적분석기(Bandit)로 취약점을 탐지한다 — confidence/severity 는
     도구가 반환한 실제 값이다(지어낸 수치 아님).
  2) 학습된 분류기(models/vuln_clf.joblib)가 있으면 그 확률도 함께 낸다.
     없으면 정직하게 model_available=False 로 표기하고 Bandit 결과만 낸다.

주장하지 않는 것: "CodeBERT를 쓴다"거나 어떤 고정 정확도. 실제로 도구가
말하는 것만 보고한다.
"""

import os
from typing import Dict, Any, List, Optional

from pydantic import BaseModel

# 실제 탐지기 (Bandit 래퍼)
try:
    from security_engine.real_detector import scan_python_with_bandit
except Exception:  # 패키지 경로가 다를 때
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from security_engine.real_detector import scan_python_with_bandit


class Finding(BaseModel):
    rule_id: str
    cwe: Optional[str] = None
    severity: str
    confidence: str          # Bandit 이 준 실제 confidence (HIGH/MEDIUM/LOW)
    line: int
    message: str


class InferenceResponse(BaseModel):
    vulnerable: bool
    num_findings: int
    findings: List[Finding]
    model_available: bool          # 학습모델 로드 여부 (정직 표기)
    model_vuln_probability: Optional[float] = None  # 있으면 실제 확률
    engine: str = "bandit-static + optional-ml"


_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "models", "vuln_clf.joblib")


class ModelInferenceEngine:
    """실제 정적분석 + (있으면)학습모델 확률. 가짜 하드코딩 없음."""

    def __init__(self):
        self.model = None
        self.vectorizer = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(_MODEL_PATH):
            return
        try:
            import joblib
            bundle = joblib.load(_MODEL_PATH)
            self.model = bundle.get("model")
            self.vectorizer = bundle.get("vectorizer")
        except Exception:
            self.model = None  # 로드 실패 시 정직하게 없음 처리

    def predict(self, code_snippet: str) -> InferenceResponse:
        raw = scan_python_with_bandit(code_snippet)
        findings = [
            Finding(
                rule_id=f.get("rule_id", "?"),
                cwe=(f"CWE-{f['cwe']}" if f.get("cwe") else None),
                severity=str(f.get("severity", "")).upper(),
                confidence=str(f.get("confidence", "")).upper(),
                line=int(f.get("line", 0)),
                message=f.get("message", ""),
            )
            for f in raw
        ]

        prob = None
        if self.model is not None and self.vectorizer is not None:
            try:
                X = self.vectorizer.transform([code_snippet])
                prob = float(self.model.predict_proba(X)[0, 1])
            except Exception:
                prob = None

        return InferenceResponse(
            vulnerable=len(findings) > 0,
            num_findings=len(findings),
            findings=findings,
            model_available=self.model is not None,
            model_vuln_probability=prob,
        )


if __name__ == "__main__":
    engine = ModelInferenceEngine()
    demo = ("import hashlib, subprocess\n"
            "def digest(d):\n    return hashlib.md5(d).hexdigest()\n"
            "def run(c):\n    subprocess.call(c, shell=True)\n")
    print(engine.predict(demo).model_dump_json(indent=2))
