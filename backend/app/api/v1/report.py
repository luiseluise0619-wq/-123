from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.ml.predict import inference_service

router = APIRouter()

class ReportRequest(BaseModel):
    address: str = "서울시 성동구 성수동2가"
    industry: str = "카페/디저트"
    budget: float = 100000000
    floor_area: float = 50

@router.post("/generate")
def generate_ai_report(req: ReportRequest):
    ml_res = inference_service.analyze_district({
        "address": req.address,
        "industry": req.industry,
        "budget": req.budget,
        "floor_area": req.floor_area
    })
    
    return {
        "report_id": "REP-20260731-885",
        "title": f"AI 상권 분석 및 창업 의사결정 보고서 ({ml_res['address']})",
        "generated_at": "2026-07-31",
        "summary": {
            "decision_score": ml_res["decision_score"],
            "confidence_score": ml_res["confidence_score"],
            "expected_monthly_revenue": ml_res["expected_monthly_revenue"],
            "success_probability_pct": ml_res["success_probability_pct"],
            "closure_risk": ml_res["closure_risk"],
            "opportunity_zone": ml_res["opportunity"]["zone_label"]
        },
        "shap_evidence": ml_res["shap_explanation"],
        "what_if_simulation": ml_res["what_if_simulation"],
        "recommendation": {
            "target_customer": "20~30대 젊은 유동인구 및 점심 직장인",
            "recommended_budget_allocation": {
                "interior_design": "4,500만원 (피크타임 테이크아웃 회전율 특화)",
                "deposit_rent": "3,000만원",
                "equipment": "2,000만원",
                "reserve_capital": "500만원"
            },
            "operational_strategy": "오전 8시~10시 직장인 대상 특화 세트 메뉴 운영 및 주말 20대 타겟 시그니처 디저트 라이브 프로모션 진행"
        }
    }
