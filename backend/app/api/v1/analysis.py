from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.ml.predict import inference_service

router = APIRouter()

class AnalysisRequest(BaseModel):
    address: str = "서울시 성동구 성수동2가"
    industry: str = "카페/디저트"
    budget: float = 100000000
    floor_area: float = 50
    user_persona: Optional[str] = "founder"

@router.post("/analyze")
def analyze_commercial_district(req: AnalysisRequest):
    res = inference_service.analyze_district({
        "address": req.address,
        "industry": req.industry,
        "budget": req.budget,
        "floor_area": req.floor_area
    })
    res["user_persona"] = req.user_persona
    return res
