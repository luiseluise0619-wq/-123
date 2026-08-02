from fastapi import APIRouter
from typing import List, Dict, Any

router = APIRouter()

@router.get("/list")
def get_user_analysis_history():
    records = [
        {
            "id": 1,
            "project_name": "성수동 디저트 카페 1호점",
            "address": "서울시 성동구 성수동2가 300-1",
            "industry": "카페/디저트",
            "budget": 100000000,
            "decision_score": 88.5,
            "confidence_score": 91.2,
            "expected_monthly_revenue": 38500000,
            "created_at": "2026-07-31"
        },
        {
            "id": 2,
            "project_name": "망원동 테이크아웃 전용점",
            "address": "서울시 마포구 망원동 412",
            "industry": "카페/디저트",
            "budget": 70000000,
            "decision_score": 83.2,
            "confidence_score": 89.5,
            "expected_monthly_revenue": 32000000,
            "created_at": "2026-06-15"
        }
    ]
    return {"history": records}

@router.get("/compare")
def compare_time_shift(past_id: int = 2, current_id: int = 1):
    return {
        "past_analysis": {
            "period": "3개월 전 (2026-04)",
            "district": "성수동2가",
            "competitor_count": 12,
            "avg_rent_m2": 52000,
            "decision_score": 84.0
        },
        "current_analysis": {
            "period": "현재 (2026-07)",
            "district": "성수동2가",
            "competitor_count": 14, # +2 stores
            "avg_rent_m2": 55000, # +5.7% rent
            "decision_score": 88.5 # +4.5 score due to foot traffic boost
        },
        "time_shift_delta": {
            "competitor_change": "+2개 점포 증가",
            "rent_change": "+5.7% 임대료 인상",
            "traffic_change": "+14.2% 유동인구 증가",
            "key_takeaway": "경쟁점포 증가 및 임대료 상승에도 불구하고 20대 유동량 가속화로 종합 Decision Score 4.5점 상승"
        }
    }
