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
def google_trending_now(geo: str = "KR") -> Dict[str, Any]:
    """Google Trends 실시간 급상승 검색어 RSS — 완전 무료·키 불필요·의존성 없음.
    실시간 인기 키워드 + 관련 뉴스 반환. (pytrends 보다 안정적)"""
    import urllib.request
    import xml.etree.ElementTree as ET
    url = f"https://trends.google.com/trending/rss?geo={geo}"
    ns = {"ht": "https://trends.google.com/trending/rss"}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        xml = urllib.request.urlopen(req, timeout=15).read()
        root = ET.fromstring(xml)
    except Exception as e:
        return {"available": False, "source": "google_trends_rss",
                "message": f"조회 실패({str(e)[:60]}). 서버 네트워크 확인. (로컬 PC에선 보통 됨)"}
    trends = []
    for it in root.findall(".//item"):
        title = it.findtext("title", "")
        traffic = it.findtext("ht:approx_traffic", "", ns)
        news = [{"title": n.findtext("ht:news_item_title", "", ns),
                 "url": n.findtext("ht:news_item_url", "", ns),
                 "source": n.findtext("ht:news_item_source", "", ns)}
                for n in it.findall("ht:news_item", ns)][:3]
        trends.append({"keyword": title, "traffic": traffic, "news": news})
    return {"available": True, "source": "google_trends_rss", "geo": geo,
            "count": len(trends), "trends": trends}


def business_relevant_trends(geo: str = "KR") -> Dict[str, Any]:
    """실시간 트렌드 중 소상공인/외식/소비 관련만 필터 + (Gemini 있으면) 실행 제안."""
    raw = google_trending_now(geo)
    if not raw.get("available"):
        return raw
    kw = ("맛집 카페 디저트 음식 메뉴 배달 창업 프랜차이즈 커피 빵 치킨 술 축제 "
          "복날 명절 다이어트 건강 제로 저당 비건 소비 트렌드 아침 점심 편의점").split()
    rel = [t for t in raw["trends"]
           if any(k in (t["keyword"] + " " + " ".join(n["title"] for n in t["news"])) for k in kw)]
    result = {"available": True, "source": "google_trends_rss", "geo": geo,
              "relevant_trends": rel, "all_count": raw["count"], "relevant_count": len(rel)}
    # Gemini 있으면 사장님용 실행 제안 생성(근거=실제 트렌드/뉴스)
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key and rel:
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            model = genai.GenerativeModel(os.getenv("SANGKWON_LLM_MODEL", "gemini-2.0-flash"))
            ctx = "\n".join(f"- {t['keyword']} ({t['traffic']}): "
                            + "; ".join(n["title"] for n in t["news"]) for t in rel)
            prompt = ("아래는 지금 한국 실시간 인기 검색어와 뉴스다. 소상공인(외식/카페/소매)이 "
                      "이 중 활용할 만한 트렌드 3개를 골라, 왜 뜨는지와 '이번 주 실행 아이디어'를 "
                      "간단히 제안하라. 근거 없는 추측 금지.\n\n" + ctx)
            result["ai_suggestion"] = model.generate_content(prompt).text
        except Exception as e:
            result["ai_suggestion_error"] = str(e)[:80]
    return result


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
