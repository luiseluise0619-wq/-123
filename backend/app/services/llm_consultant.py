"""
사장님인사이트 AI 분석가 — REAL Gemini API 연동 (템플릿 연극 제거).

이전 버전은 'GeminiConsultantService' 라는 이름만 달고 실제로는 f-string 으로
조언을 하드코딩했다("+9.1% 개선" 등). LLM 호출이 전혀 없었다(가짜).

이 버전은 실제 Google Gemini API 를 호출한다:
  - 시스템 프롬프트 = 사장님인사이트 AI 분석가 지침(데이터 근거 우선, 추측 금지).
  - 사용자 메시지 = 질문 + '실제 ML 예측 결과' 데이터 블록 + RAG 문서.
  - LLM 은 ML 수치를 바꾸지 않고 그 위에서 설명/추천만 생성한다.
키(GEMINI_API_KEY)가 없으면 조언을 지어내지 않고, 실제 ML 수치와 함께
'LLM 미연동' 을 정직하게 반환한다.

설치:  pip install google-generativeai
키:    export GEMINI_API_KEY="발급받은키"   (https://aistudio.google.com/apikey)
"""

import os
from typing import Dict, Any

from app.services.rag_engine import rag_engine

MODEL = os.getenv("SANGKWON_LLM_MODEL", "gemini-2.0-flash")

SYSTEM_PROMPT = """너는 "사장님인사이트"의 AI 창업·경영 분석 전문가다.

목표: 소상공인이 더 나은 의사결정을 하도록 상권 데이터·소비자 트렌드·시장·뉴스·해외
사례를 기반으로 실행 가능한 인사이트를 제공한다.

분석 원칙:
- 제공된 ML 예측 결과를 우선 활용한다. 예측값·점수·확률을 임의로 변경하지 않는다.
- RAG 검색 결과의 최신 정보와 결합한다. 근거 없는 추측은 하지 않는다.
- 데이터가 부족하면 부족하다고 말한다. 전문 금융·법률 조언처럼 단정하지 않는다.
- 사장님이 바로 행동할 수 있는 형태로 답한다.

출력 형식:
## 📊 AI 분석 결과
### 핵심 요약
(3줄 이내)
### 📍 데이터 분석
- 상권:
- 소비자:
- 시장 상황:
### 🔥 발견된 기회
-
### ⚠️ 주의할 점
-
### 💡 추천 실행 방법
1.
2.
3.
### AI 판단
성장 가능성:
위험도:
추천도:"""


def _ml_context(ml: Dict[str, Any]) -> str:
    """LLM 이 근거로 쓸 '실제 ML 예측' 블록. 여기 수치는 모델이 낸 값이다."""
    return (
        "[실제 ML 예측 결과 — 이 수치를 근거로만 쓰고 바꾸지 말 것]\n"
        f"- 위치: {ml.get('address')}\n"
        f"- 업종: {ml.get('industry')}\n"
        f"- 종합 점수: {ml.get('decision_score')} (신뢰도 {ml.get('confidence_score')})\n"
        f"- 예상 월매출: {ml.get('expected_monthly_revenue')}원\n"
        f"- 성공 확률: {ml.get('success_probability_pct')}%\n"
        f"- 폐업 리스크: {ml.get('closure_risk')}\n"
        f"- 상권 유형: {ml.get('opportunity', {}).get('zone_type')}\n"
        "※ 정직 고지: 예상 월매출(정확 수치)은 공개데이터 한계로 신뢰구간이 넓다"
        "(공간 R²≈0.25). 반면 등급·성공확률·폐업리스크(순위/분류)는 신뢰도 높다(AUC≈0.85)."
    )


class SangkwonAnalyst:
    """실제 Claude API 로 상권 분석 인사이트를 생성. 키 없으면 정직하게 미연동 표기."""

    def consult(self, question: str, ml_result: Dict[str, Any],
                persona: str = "founder") -> Dict[str, Any]:
        industry = ml_result.get("industry", "")
        docs = rag_engine.retrieve_relevant_context(query=question, industry=industry, top_k=2)
        doc_block = "\n".join(f"- {d['title']}: {d['summary'][:120]}" for d in docs) or "(관련 정책 문서 없음)"

        user_msg = (f"질문: {question}\n\n{_ml_context(ml_result)}\n\n"
                    f"[RAG 최신 정책/지식]\n{doc_block}")

        key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not key:
            return {
                "question": question, "persona": persona,
                "llm_connected": False,
                "answer": ("⚠️ LLM 미연동 (GEMINI_API_KEY 환경변수 없음). 조언을 지어내지 "
                           "않습니다. 아래는 실제 ML 예측 결과입니다:\n\n" + _ml_context(ml_result)),
                "data_evidence": ml_result, "retrieved_knowledge_docs": docs,
            }
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            model = genai.GenerativeModel(MODEL, system_instruction=SYSTEM_PROMPT)
            resp = model.generate_content(user_msg)
            return {"question": question, "persona": persona, "llm_connected": True,
                    "model": MODEL, "answer": resp.text,
                    "data_evidence": ml_result, "retrieved_knowledge_docs": docs}
        except Exception as e:
            return {"question": question, "persona": persona, "llm_connected": False,
                    "answer": f"⚠️ Gemini 호출 실패({str(e)[:80]}). 실제 ML 결과:\n\n{_ml_context(ml_result)}",
                    "data_evidence": ml_result, "retrieved_knowledge_docs": docs}


# 하위호환 별칭 (chat.py 가 import)
gemini_consultant = SangkwonAnalyst()
