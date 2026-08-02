from fastapi import APIRouter

router = APIRouter()

@router.get("/opportunity-map")
def get_opportunity_map_layers(region: str = "서울"):
    zones = [
        {
            "id": "z1",
            "name": "성수동 카페거리 상권",
            "lat": 37.5445,
            "lng": 127.0560,
            "opportunity_score": 88.5,
            "zone_color": "#10b981", # Green (Opportunity)
            "zone_type": "GREEN",
            "description": "수요 성장 대비 공급 부족 (기회 지역)",
            "avg_monthly_sales": "3,850만원",
            "foot_traffic_daily": 34000
        },
        {
            "id": "z2",
            "name": "강남역 메인 상권",
            "lat": 37.4979,
            "lng": 127.0276,
            "opportunity_score": 42.0,
            "zone_color": "#ef4444", # Red (Red Ocean)
            "zone_type": "RED",
            "description": "동일 업종 과밀집 (레드오션 리스크)",
            "avg_monthly_sales": "4,200만원",
            "foot_traffic_daily": 89000
        },
        {
            "id": "z3",
            "name": "망원동 포은로 상권",
            "lat": 37.5562,
            "lng": 126.9015,
            "opportunity_score": 82.0,
            "zone_color": "#10b981", # Green (Opportunity)
            "zone_type": "GREEN",
            "description": "관광 유동인구 증가 및 기회 상권",
            "avg_monthly_sales": "3,200만원",
            "foot_traffic_daily": 21000
        },
        {
            "id": "z4",
            "name": "홍대입구역 메인 상권",
            "lat": 37.5565,
            "lng": 126.9244,
            "opportunity_score": 58.5,
            "zone_color": "#3b82f6", # Blue (Stable)
            "zone_type": "BLUE",
            "description": "안정적 성숙 상권",
            "avg_monthly_sales": "3,900만원",
            "foot_traffic_daily": 65000
        }
    ]
    return {"region": region, "zones": zones}
