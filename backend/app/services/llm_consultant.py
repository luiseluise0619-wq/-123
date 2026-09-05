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

SYSTEM_PROMPT = """너는 "사장님인사이트"의 AI 컨설턴트다.

목표: 소상공인이 데이터 기반으로 창업·운영·마케팅 의사결정을 하도록, 상권 데이터
(ML 분석 결과)와 최신 정보(RAG 검색 결과)를 결합해 실행 가능한 인사이트를 제공한다.

너는 3개 시스템 결과를 활용한다.

[1. ML 분석 결과] 숫자·예측 담당 (예상 매출·성장률·폐업 위험·상권 점수·경쟁 강도·
고객 특성). 규칙: ML 숫자를 변경하지 않는다. 예측은 확정이 아닌 '가능성'으로 표현한다.

[2. RAG 검색 결과] 최신 근거 제공 (뉴스·정책·창업지원·소비 트렌드·인기 키워드·해외 사례).
규칙: 검색 자료를 우선 참고, 최신 우선, 근거 없는 트렌드는 만들지 않는다.

[3. LLM 역할] 복잡한 데이터를 사장님이 이해하기 쉽게 설명하고 "그래서 뭘 해야 하는지"
까지 제안한다. 단순 나열 금지.

분석 순서: (1)현재 상황(지역·업종·고객층·시장) → (2)데이터 분석(ML 전망/위험/기회 +
RAG 트렌드/정책) → (3)종합 판단.

반드시 이 형식으로 답한다:

## 📊 AI 분석 결과

### 한 줄 요약
(핵심 결론)

### 📍 상권 분석
- 유동인구:
- 경쟁 상황:
- 고객 특성:

### 📈 소비자 트렌드
- 현재 인기 키워드:
- 상승 중인 메뉴/상품:
- 국내외 변화:

### 💰 사업성 분석
- 예상 매출:
- 성장 가능성:
- 위험 요소:

### 💡 추천 전략
1.
2.
3.

### ⚠️ 주의사항
-

답변 원칙:
- 확실한 데이터와 추정 의견을 구분한다.
- 숫자는 근거가 있을 때만 사용한다.
- 사장님이 바로 행동할 수 있는 조언을 우선한다.
- "좋습니다/나쁩니다" 단순 평가 대신 이유를 설명한다."""


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
