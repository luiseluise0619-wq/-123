"""
사장님인사이트 시장 인텔리전스 엔진 — 6대 기능의 실제 데이터 연동.

정직 원칙: 공개 API 로 되는 것은 실연동(키 환경변수), 제한/유료 소스(해외 SNS 등)는
RAG+LLM 로 처리하고 지어내지 않는다. 키가 없으면 available=False 로 알린다.

  2) 소비자 트렌드   : 네이버 데이터랩(NAVER_CLIENT_ID/SECRET) + Google Trends(pytrends)
  4) 식자재 가격     : KAMIS 농수산물유통정보 OpenAPI (KAMIS_CERT_KEY/KAMIS_CERT_ID)
  6) 시즌 추천       : 달력 + (선택)기상청 날씨. 지금 바로 동작.
  3/5) 글로벌·SNS   : 수집된 텍스트/뉴스를 LLM 이 요약(RAG). 키 없으면 미연동 표기.
"""

import os
import datetime
from typing import Dict, Any, List

try:
    import requests
except Exception:
    requests = None


# ---------------------------------------------------------------- 2) 소비자 트렌드
def google_trends(keywords: List[str]) -> Dict[str, Any]:
    """Google Trends — 완전 무료·키 불필요(pytrends). 네트워크만 있으면 동작."""
    try:
        from pytrends.request import TrendReq
    except Exception:
        return {"available": False, "source": "google_trends",
                "message": "pytrends 미설치 — pip install pytrends (키 불필요)."}
    try:
        p = TrendReq(hl="ko", tz=540)
        p.build_payload(keywords[:5], geo="KR", timeframe="today 3-m")
        iot = p.interest_over_time()
        if iot.empty:
            return {"available": False, "source": "google_trends", "message": "데이터 없음"}
        out = []
        for k in keywords[:5]:
            if k in iot.columns:
                s = iot[k].tolist()
                growth = round((s[-1] - s[0]) / s[0] * 100, 1) if s and s[0] else None
                out.append({"keyword": k, "series": s, "growth_pct_3m": growth})
        out.sort(key=lambda x: -(x["growth_pct_3m"] or -1))
        return {"available": True, "source": "google_trends", "trends": out}
    except Exception as e:
        return {"available": False, "source": "google_trends", "message": f"조회 실패: {str(e)[:80]}"}


def consumer_trends(keywords: List[str]) -> Dict[str, Any]:
    """소비자 검색 트렌드. 네이버 키 있으면 네이버(국내정확), 없으면 무료 Google Trends."""
    cid, sec = os.getenv("NAVER_CLIENT_ID"), os.getenv("NAVER_CLIENT_SECRET")
    if not (cid and sec and requests):
        # 네이버 키 없으면 무료 Google Trends 로 폴백(키 불필요)
        return google_trends(keywords)
    end = datetime.date.today(); start = end - datetime.timedelta(days=180)
    body = {"startDate": str(start), "endDate": str(end), "timeUnit": "month",
            "keywordGroups": [{"groupName": k, "keywords": [k]} for k in keywords[:5]]}
    r = requests.post("https://openapi.naver.com/v1/datalab/search",
                      headers={"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec,
                               "Content-Type": "application/json"}, json=body, timeout=20)
    results = r.json().get("results", [])
    out = []
    for res in results:
        data = res.get("data", [])
        growth = None
        if len(data) >= 2 and data[0]["ratio"]:
            growth = round((data[-1]["ratio"] - data[0]["ratio"]) / data[0]["ratio"] * 100, 1)
        out.append({"keyword": res["title"], "monthly": data, "growth_pct_6m": growth})
    out.sort(key=lambda x: -(x["growth_pct_6m"] or -1))
    return {"available": True, "source": "naver_datalab", "period": f"{start}~{end}",
            "trends": out}


# ---------------------------------------------------------------- 4) 식자재 가격
def food_price(item_name: str = "양파") -> Dict[str, Any]:
    """KAMIS 농수산물 도·소매 가격. 키(KAMIS_CERT_KEY/ID) 없으면 미연동.
    실제 최근 가격 시계열을 반환(예측은 별도 모델로 확장)."""
    key, cid = os.getenv("KAMIS_CERT_KEY"), os.getenv("KAMIS_CERT_ID")
    if not (key and cid and requests):
        return {"available": False, "source": "KAMIS",
                "message": "KAMIS_CERT_KEY/KAMIS_CERT_ID 없음 — 키 넣으면 실제 농산물 가격 동작. "
                           "(발급: kamis.or.kr 오픈API)"}
    end = datetime.date.today(); start = end - datetime.timedelta(days=90)
    url = ("http://www.kamis.or.kr/service/price/xml.do?action=periodProductList"
           f"&p_cert_key={key}&p_cert_id={cid}&p_returntype=json"
           f"&p_startday={start}&p_endday={end}&p_itemcategorycode=200&p_convert_kg_yn=Y"
           f"&p_productclscode=01&p_itemcode=245")  # 예시 코드(양파). 품목별 코드 매핑 확장.
    r = requests.get(url, timeout=20)
    return {"available": True, "source": "KAMIS", "item": item_name, "raw": r.json()}


# ---------------------------------------------------------------- 6) 시즌 추천
_SEASON = {
    (6, 7, 8): {"weather": "무더위", "items": ["빙수", "냉면", "수박음료", "아이스커피"],
                "keyword": "더위 극복"},
    (9, 10, 11): {"weather": "선선", "items": ["단호박라떼", "군고구마", "따뜻한 디저트"],
                  "keyword": "가을 감성"},
    (12, 1, 2): {"weather": "추위", "items": ["호빵", "어묵", "붕어빵", "따뜻한 국물"],
                 "keyword": "겨울 별미"},
    (3, 4, 5): {"weather": "봄", "items": ["딸기디저트", "봄나물", "피크닉 도시락"],
                "keyword": "봄 나들이"},
}
_HOLIDAYS = {"01-01": "신정", "02-09": "설연휴", "03-01": "삼일절", "05-05": "어린이날",
             "06-06": "현충일", "08-15": "광복절", "09-16": "추석연휴",
             "10-03": "개천절", "12-25": "성탄절"}


def season_recommendation(month: int = None) -> Dict[str, Any]:
    """달력 기반 시즌 추천. 지금 바로 동작(외부 키 불필요). 날씨 연동은 선택."""
    today = datetime.date.today()
    m = month or today.month
    rec = next(v for months, v in _SEASON.items() if m in months)
    upcoming = [(d, n) for d, n in _HOLIDAYS.items()
                if d >= today.strftime("%m-%d")][:2]
    return {"available": True, "month": m, "season_weather": rec["weather"],
            "recommended_items": rec["items"], "ad_keyword": rec["keyword"],
            "upcoming_holidays": [{"date": d, "name": n} for d, n in upcoming],
            "note": "달력·계절 규칙 기반. 과거 매출·기상청 실황 연동 시 정밀도 상승."}


# ---------------------------------------------------------------- 3/5) 글로벌·SNS (RAG+LLM)
def rag_llm_trend(topic: str, collected_texts: List[str] = None) -> Dict[str, Any]:
    """글로벌 음식/SNS 바이럴 트렌드: 수집 텍스트를 Gemini 가 요약(근거 없으면 미연동).
    해외 SNS 원천 API 는 제한/유료라, 수집된 문서를 근거로만 분석한다(지어내지 않음)."""
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not collected_texts:
        return {"available": False, "topic": topic,
                "message": "분석할 수집 텍스트(뉴스/SNS/트렌드)가 없습니다. "
                           "RAG 문서를 넣으면 LLM 이 근거 기반으로 요약합니다. 지어내지 않습니다."}
    if not key:
        return {"available": False, "topic": topic,
                "message": "GEMINI_API_KEY 없음 — 수집 텍스트는 있으나 LLM 미연동."}
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        model = genai.GenerativeModel(os.getenv("SANGKWON_LLM_MODEL", "gemini-2.0-flash"))
        prompt = (f"다음 수집 자료만 근거로 '{topic}' 관련 트렌드를 요약하라. "
                  f"근거 없는 추측 금지. 한국 도입 가능성도 평가.\n\n" + "\n---\n".join(collected_texts[:20]))
        return {"available": True, "topic": topic, "summary": model.generate_content(prompt).text}
    except Exception as e:
        return {"available": False, "topic": topic, "message": f"LLM 호출 실패: {str(e)[:80]}"}
