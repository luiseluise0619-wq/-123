from typing import Dict, Any, Optional
from pydantic import BaseModel

class StoreProfile(BaseModel):
    store_name: str = "성수 카페 앤 디저트"
    industry: str = "카페/디저트"
    address: str = "서울시 성동구 성수동2가 300-1"
    store_area_m2: float = 49.5 # 15평
    monthly_rent_krw: float = 3500000 # 350만원
    target_customer: str = "2030 직장인 및 주말 방문객"
    business_goal: str = "월 매출 4,000만원 달성 및 손익분기점 조기 달성"

class StoreIntelligenceEngine:
    """
    Generates personalized store health score, growth potential, risk factors, and action priorities.
    """
    @staticmethod
    def get_store_diagnosis(profile: StoreProfile, base_score: float = 87.5, expected_revenue: float = 38500000) -> Dict[str, Any]:
        rent_ratio = round((profile.monthly_rent_krw / expected_revenue) * 100, 1)
        
        health_score = round(np.clip(base_score - (5.0 if rent_ratio > 12.0 else 0.0), 0.0, 100.0), 1)
        
        return {
            "profile": profile.dict(),
            "store_health_metrics": {
                "health_score": health_score,
                "growth_potential_pct": 18.5,
                "rent_to_revenue_ratio_pct": rent_ratio,
                "rent_status": "적정 (10% 이하)" if rent_ratio <= 10.0 else "주의 (10% 초과)",
                "risk_level": "LOW" if health_score >= 80 else "MEDIUM"
            },
            "personalized_recommendations": [
                {
                    "category": "매출 증대",
                    "title": f"매장 면적({profile.store_area_m2}m²) 대비 테이크아웃 비중 확장",
                    "action_plan": "점심시간 전용 스마트오더 미니 키오스크 배치로 회전율 +25% 개선",
                    "expected_monthly_boost_krw": 2800000
                },
                {
                    "category": "비용 절감",
                    "title": "원자재 공동 구매 및 고정비 관리",
                    "action_plan": "원두 및 가공 재료 공동 공급망 활용으로 원가율 3% 절감",
                    "expected_monthly_boost_krw": 1150000
                }
            ]
        }

import numpy as np
store_intel_engine = StoreIntelligenceEngine()
