"""
AI 상권 분석 보고서 API — 실 ML + 실 LLM (하드코딩 추천 제거).

이전 버전은 report_id/날짜를 고정하고, 추천(타깃고객·예산배분·운영전략)을
고정 문구로 하드코딩했다. 이 버전은 실제 ML 예측 + 실제 Gemini LLM 추천으로
보고서를 구성한다. LLM 키가 없으면 추천을 지어내지 않고 미연동으로 표기한다.
"""

import datetime
import hashlib
from fastapi import APIRouter
from pydantic import BaseModel

from app.ml.predict import inference_service
from app.services.llm_consultant import gemini_consultant

router = APIRouter()


class ReportRequest(BaseModel):
    address: str = "서울시 성동구 성수동2가"
    industry: str = "카페/디저트"
    budget: float = 100000000
    floor_area: float = 50


@router.post("/generate")
def generate_ai_report(req: ReportRequest):
    ml_res = inference_service.analyze_district({
        "address": req.address, "industry": req.industry,
        "budget": req.budget, "floor_area": req.floor_area,
    })

    # 추천은 실제 LLM(Gemini)이 ML 결과를 근거로 생성 (하드코딩 아님)
    llm = gemini_consultant.consult(
        question=f"{req.address}에서 {req.industry} 창업 보고서를 작성해줘. 예산 {int(req.budget):,}원.",
        ml_result=ml_res, persona="founder")

    now = datetime.datetime.now()
    rid = "REP-" + now.strftime("%Y%m%d") + "-" + \
          hashlib.md5(f"{req.address}{req.industry}{now}".encode()).hexdigest()[:6].upper()

    return {
        "report_id": rid,
        "title": f"AI 상권 분석 및 창업 의사결정 보고서 ({ml_res['address']})",
        "generated_at": now.isoformat(timespec="seconds"),
        "prediction_source": ml_res.get("prediction_source"),
        "summary": {
            "decision_score": ml_res["decision_score"],
            "confidence_score": ml_res["confidence_score"],
            "expected_monthly_revenue": ml_res["expected_monthly_revenue"],
            "success_probability_pct": ml_res["success_probability_pct"],
            "closure_risk": ml_res["closure_risk"],
            "opportunity_zone": ml_res["opportunity"].get("zone_label"),
        },
        "shap_evidence": ml_res["shap_explanation"],
        "what_if_simulation": ml_res["what_if_simulation"],
        "ai_recommendation": {
            "llm_connected": llm.get("llm_connected"),
            "text": llm.get("answer"),  # 실제 LLM 생성(또는 미연동 안내)
        },
    }
