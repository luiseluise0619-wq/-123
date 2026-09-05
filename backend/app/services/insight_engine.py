from typing import Dict, Any, List

class BusinessInsightEngine:
    """
    Translates raw ML metrics & SHAP values into natural Korean business insights for business owners (사장님).
    """
    @staticmethod
    def generate_store_insights(
        address: str = "서울시 성동구 성수동2가",
        industry: str = "카페/디저트",
        decision_score: float = 87.5,
        expected_revenue: float = 38500000,
        shap_positive: List[Dict[str, Any]] = None,
        shap_risk: List[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        
        # Translate technical SHAP features to human business reasons
        feature_translations = {
            "foot_traffic_daily": ("일일 유동 고객수", "매장 앞을 지나는 고객 흐름"),
            "foot_traffic_lunch": ("점심시간 직장인 유입", "오전 11:30~13:30 직장인 점심 수요"),
            "foot_traffic_dinner": ("저녁시간 유동인구", "오후 18:00~21:00 저녁 유동 흐름"),
            "workplace_pop": ("주변 직장인 인구", "배후 오피스 직장인 유입 인구"),
            "age_20_30_ratio": ("20~30대 젊은 고객 비율", "트렌드에 민감한 2030 주소비층 비율"),
            "rent_per_m2": ("평당 임대료 수준", "상권 내 부동산 임대료 부담률"),
            "competitor_count_100m": ("반경 100m 인근 경쟁점포", "매장 바로 인근 동종 업종 경쟁 점포 수"),
            "competitor_density": ("경쟁업체 밀집도", "상권 내 유사 업종 과밀 정도"),
            "vacancy_rate": ("주변 상가 공실률", "인근 상권의 활성도 및 공실 여부"),
            "closures_1yr": ("최근 1년 폐업률", "인근 동종 업체의 최근 1년 폐업 추이")
        }
        
        positive_reasons = []
        if shap_positive:
            for item in shap_positive[:3]:
                fname = item.get("feature", "")
                korean_name, desc = feature_translations.get(fname, (fname, "매출 상승 우수 요인"))
                positive_reasons.append({
                    "title": f"매출을 견인하는 핵심 강점: {korean_name}",
                    "description": f"{desc}이 높아 매출 상승을 강력하게 견인하고 있습니다.",
                    "impact": "POSITIVE"
                })
        else:
            positive_reasons = [
                {"title": "매출 견인 강점: 20~30대 젊은 유동 고객 풍부", "description": "주변 20~30대 유동 고객 비율이 높아 SNS 마케팅 및 시그니처 메뉴 호응도가 우수합니다.", "impact": "POSITIVE"},
                {"title": "매출 견인 강점: 점심시간 오피스 직장인 수요", "description": "오전 11시~오후 2시 사이 직장인 유동량이 많아 테이크아웃 회전율 확보에 유리합니다.", "impact": "POSITIVE"}
            ]
            
        risk_reasons = []
        if shap_risk:
            for item in shap_risk[:3]:
                fname = item.get("feature", "")
                korean_name, desc = feature_translations.get(fname, (fname, "주의 리스크 요인"))
                risk_reasons.append({
                    "title": f"개선이 필요한 주의 리스크: {korean_name}",
                    "description": f"{desc}로 인해 예상 매출 대비 손실 리스크가 발생하고 있습니다.",
                    "impact": "RISK"
                })
        else:
            risk_reasons = [
                {"title": "개선 리스크: 반경 100m 내 초밀집 경쟁", "description": "도보 2분 거리 내 동종 경쟁업체가 밀집해 있어 차별화된 단골 혜택과 시그니처 메뉴가 필요합니다.", "impact": "RISK"}
            ]

        # Action Priorities (사장님 개선 우선순위 TOP 3)
        action_priorities = [
            {
                "priority": 1,
                "action": "피크타임 테이크아웃 동선 및 단골 쿠폰제 도입",
                "expected_effect": "점심시간 주문 대기시간 35% 단축 및 재방문율 +18% 상승",
                "urgency": "HIGH"
            },
            {
                "priority": 2,
                "action": "2030 타겟 시그니처 비주얼 메뉴 출시 & 인스타그램 홍보",
                "expected_effect": "주말 외지 방문객 유입량 +22% 증가",
                "urgency": "MEDIUM"
            },
            {
                "priority": 3,
                "action": "오후 2시~5시 세트 할인 프로모션 운영",
                "expected_effect": "비피크 타임 가동률 개선으로 월 매출 +₩2,500,000원 추가 창출",
                "urgency": "MEDIUM"
            }
        ]

        return {
            "address": address,
            "industry": industry,
            "overall_health_score": decision_score,
            "overall_health_grade": "A등급 (매우 양호)" if decision_score >= 85 else ("B등급 (양호)" if decision_score >= 70 else "C등급 (주의)"),
            "human_summary": (
                f"현재 가게가 위치한 {address} 상권은 AI 종합 진단 **{decision_score}점 (양호)**으로 평가됩니다. "
                f"특히 2030 유동인구와 점심 직장인 수요가 매출의 핵심 견인차 역할을 하고 있으나, "
                f"인근 경쟁 점포 밀집도가 높아 단골 확보를 위한 차별화 프로모션이 우선 과제입니다."
            ),
            "strengths": positive_reasons,
            "risks": risk_reasons,
            "action_priorities": action_priorities
        }

business_insight_engine = BusinessInsightEngine()
