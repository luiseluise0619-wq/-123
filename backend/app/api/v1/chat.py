from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.services.llm_consultant import gemini_consultant
from app.ml.predict import inference_service

router = APIRouter()

class ChatRequest(BaseModel):
    message: str = "성수동 카페 창업 성공 가능성이랑 매출 분석해줘"
    address: Optional[str] = "서울시 성동구 성수동2가"
    industry: Optional[str] = "카페/디저트"
    user_persona: Optional[str] = "founder"

@router.post("/consult")
def consult_ai(req: ChatRequest):
    # Perform district prediction to pass to LLM
    ml_res = inference_service.analyze_district({
        "address": req.address or "서울시 성동구 성수동2가",
        "industry": req.industry or "카페/디저트"
    })
    
    chat_res = gemini_consultant.consult(
        question=req.message,
        ml_result=ml_res,
        persona=req.user_persona or "founder"
    )
    
    # Attach ML Score Card for inline frontend rendering
    chat_res["score_card"] = {
        "address": ml_res["address"],
        "industry": ml_res["industry"],
        "decision_score": ml_res["decision_score"],
        "confidence_score": ml_res["confidence_score"],
        "expected_monthly_revenue": ml_res["expected_monthly_revenue"],
        "success_probability_pct": ml_res["success_probability_pct"],
        "closure_risk": ml_res["closure_risk"],
        "opportunity_type": ml_res["opportunity"]["zone_type"]
    }
    
    return chat_res
