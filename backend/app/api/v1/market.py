"""
시장 인텔리전스 API — 소비자 트렌드 / 식자재 가격 / 시즌 / 글로벌·SNS 트렌드.
실연동 가능한 것은 실데이터, 제한 소스는 RAG+LLM. 지어내지 않는다.
"""

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

from app.services import market_engines as M

router = APIRouter()


class TrendReq(BaseModel):
    keywords: List[str] = ["말차", "저당 디저트", "제로슈거"]


@router.post("/consumer-trends")
def consumer_trends(req: TrendReq):
    return M.consumer_trends(req.keywords)


@router.get("/trending-now")
def trending_now(geo: str = "KR"):
    """실시간 급상승 검색어(무료 RSS, 키 불필요)."""
    return M.google_trending_now(geo)


@router.get("/trending-for-business")
def trending_for_business(geo: str = "KR"):
    """소상공인 관련 실시간 트렌드 + (키 있으면)AI 실행 제안."""
    return M.business_relevant_trends(geo)


@router.get("/food-price")
def food_price(item: str = "양파"):
    return M.food_price(item)


@router.get("/season")
def season(month: Optional[int] = None):
    return M.season_recommendation(month)


class GlobalReq(BaseModel):
    topic: str = "미국 Dirty Soda"
    collected_texts: List[str] = []


@router.post("/global-trend")
def global_trend(req: GlobalReq):
    return M.rag_llm_trend(req.topic, req.collected_texts)
