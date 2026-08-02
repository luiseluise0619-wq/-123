from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.ml.festival_engine import festival_impact_engine

router = APIRouter()

class FestivalRequest(BaseModel):
    location: str = "서울시 성동구 성수동2가"
    event_name: str = "성수 디저트 & 아티스트 팝업 페스티벌"
    event_duration_days: int = 3
    expected_visitors: int = 50000
    event_scale: Optional[str] = "REGIONAL"

@router.post("/analyze-event")
def analyze_festival_impact(req: FestivalRequest):
    res = festival_impact_engine.predict_impact(
        req.location, req.event_name, req.event_duration_days, req.expected_visitors, req.event_scale or "REGIONAL"
    )
    return res
