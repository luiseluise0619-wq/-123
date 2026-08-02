from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.ml.counterfactual_engine import CounterfactualEngine

router = APIRouter()

class SimulatorRecommendRequest(BaseModel):
    industry: str = "카페/디저트"
    budget: float = 100000000
    region: str = "서울"
    floor_area: float = 50

class CounterfactualRequest(BaseModel):
    industry: str = "카페/디저트"
    base_revenue: float = 34500000
    base_success_prob: float = 0.82
    base_closure_risk: str = "LOW"
    base_rent_m2: float = 55000
    base_growth: float = 0.15
    rent_change_pct: float = -0.20
    floor_area_change_pct: float = 0.20

@router.post("/recommend")
def recommend_top5_districts(req: SimulatorRecommendRequest):
    districts = [
        {
            "rank": 1,
            "district_name": "서울시 성동구 성수동2가",
            "decision_score": 88.5,
            "confidence_score": 91.2,
            "expected_revenue_krw": 38500000,
            "success_prob_pct": 86.4,
            "closure_risk": "LOW",
            "opportunity_type": "GREEN",
            "opportunity_label": "기회 지역 (수요 성장 대비 공급 부족)",
            "reasons": [
                "20~30대 젊은 유동인구 비율 상위 3%",
                "디저트/음료 소비 지출 3년 연속 상승세",
                "지하철 성수역 도보 5분 접근성"
            ],
            "risk_factors": [
                "주변 상가 평균 임대료 수준이 비교적 높음",
                "주말 경쟁 업체 방문객 분산 가능성"
            ]
        },
        {
            "rank": 2,
            "district_name": "서울시 마포구 망원동",
            "decision_score": 83.2,
            "confidence_score": 89.5,
            "expected_revenue_krw": 32000000,
            "success_prob_pct": 81.0,
            "closure_risk": "LOW",
            "opportunity_type": "GREEN",
            "opportunity_label": "기회 지역",
            "reasons": [
                "망원시장 인근 관광/방문 인구 지속 유입",
                "성수동 대비 상대적으로 안정적인 임대료"
            ],
            "risk_factors": [
                "주차 공간 부족으로 차량 방문객 제한"
            ]
        },
        {
            "rank": 3,
            "district_name": "서울시 마포구 연남동",
            "decision_score": 79.8,
            "confidence_score": 88.0,
            "expected_revenue_krw": 34000000,
            "success_prob_pct": 77.5,
            "closure_risk": "MEDIUM",
            "opportunity_type": "BLUE",
            "opportunity_label": "안정적 성숙 상권",
            "reasons": [
                "경의선 숲길 기반 꾸준한 주말 유동인구",
                "평균 결제 단가 높음"
            ],
            "risk_factors": [
                "동일 업종 카페 밀집도 레드오션 리스크"
            ]
        },
        {
            "rank": 4,
            "district_name": "서울시 용산구 한남동",
            "decision_score": 76.4,
            "confidence_score": 87.2,
            "expected_revenue_krw": 41000000,
            "success_prob_pct": 74.0,
            "closure_risk": "MEDIUM",
            "opportunity_type": "BLUE",
            "opportunity_label": "성숙 상권",
            "reasons": [
                "고객 평균 객단가 매우 높음"
            ],
            "risk_factors": [
                "높은 초기 권리금 및 임대 보증금 부담"
            ]
        },
        {
            "rank": 5,
            "district_name": "서울시 송파구 송리단길",
            "decision_score": 74.1,
            "confidence_score": 86.0,
            "expected_revenue_krw": 29500000,
            "success_prob_pct": 72.8,
            "closure_risk": "LOW",
            "opportunity_type": "GREEN",
            "opportunity_label": "기회 상권",
            "reasons": [
                "석촌호수 유동인구 수혜"
            ],
            "risk_factors": [
                "평일 주간 직장인 수요 상대적 부족"
            ]
        }
    ]
    return {"industry": req.industry, "top5_districts": districts}

@router.post("/counterfactual")
def run_counterfactual_simulation(req: CounterfactualRequest):
    res = CounterfactualEngine.simulate_what_if(
        req.industry, req.base_revenue, req.base_success_prob, req.base_closure_risk,
        req.base_rent_m2, req.base_growth, req.rent_change_pct, req.floor_area_change_pct
    )
    return res
