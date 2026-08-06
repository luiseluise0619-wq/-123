"""
분석 이력 API — 실제 저장소 연동 (하드코딩 이력 제거).

이전 버전은 '성수동 디저트 카페 1호점 88.5점' 같은 가짜 이력과 가짜 비교 결과를
하드코딩해 반환했다. 이력은 사용자가 실제로 실행한 분석을 저장해야 나오는 것이므로,
저장소(DB) 없이 지어내지 않는다. 여기서는 파일 기반 저장소(analysis_history.jsonl)를
읽어 반환하고, 없으면 빈 목록과 안내를 정직하게 반환한다.
"""

import json
import os
from fastapi import APIRouter

router = APIRouter()

HISTORY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "..", "..", "data", "analysis_history.jsonl")


def _load():
    if not os.path.exists(HISTORY_PATH):
        return []
    out = []
    with open(HISTORY_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except Exception:
                    pass
    return out


@router.get("/list")
def get_user_analysis_history():
    records = _load()
    if not records:
        return {"history": [], "available": False,
                "message": "저장된 분석 이력이 없습니다. /analysis/analyze 로 분석을 실행하면 "
                           "결과가 저장소에 쌓입니다. (가짜 이력을 반환하지 않습니다.)"}
    records.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    return {"history": records, "available": True, "count": len(records)}


@router.get("/compare")
def compare_time_shift(past_id: int = None, current_id: int = None):
    """실제 저장된 두 이력을 비교. 지어내지 않는다."""
    records = {r.get("id"): r for r in _load()}
    past, cur = records.get(past_id), records.get(current_id)
    if not past or not cur:
        return {"available": False,
                "message": "비교할 실제 이력이 부족합니다. 같은 위치를 다른 시점에 2번 이상 "
                           "분석해 저장하면 시점 비교가 가능합니다."}
    def d(k):
        try:
            return round(float(cur.get(k, 0)) - float(past.get(k, 0)), 2)
        except Exception:
            return None
    return {"available": True, "past_analysis": past, "current_analysis": cur,
            "delta": {"decision_score": d("decision_score"),
                      "expected_monthly_revenue": d("expected_monthly_revenue")}}
