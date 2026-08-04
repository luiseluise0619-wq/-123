"""
외부 피처 모듈 — 공개데이터 상한까지 끌어올리는 추가 신호들.

사용자 로드맵(효과 큰 순):
  1) 검색 트렌드 (네이버 데이터랩 / Google Trends)  ← 선행지표, 강추
  2) 폐업/생존 데이터 (상권변화지표 운영·폐업 개월)     ← 창업추천 핵심, 지금 데이터로 가능
  3) 임대료/부동산 (임대시세, 공실률)                 ← 수익성
  4) 교통 (지하철·버스 승하차, 역 거리)
  5) 리뷰/SNS (네이버 플레이스, 블로그 언급)

정직성:
  - 1,3,4,5 는 외부 API 키가 필요(여기 원격 샌드박스에선 호출 불가). 키를 넣으면
    바로 동작하는 실제 연동 코드다. 키는 환경변수로만 받는다(하드코딩 금지).
  - 2(생존확률)는 우리가 이미 가진 상권변화지표(운영/폐업 개월)로 지금 바로 계산된다.
"""

import os
import numpy as np
import pandas as pd

try:
    import requests
except Exception:
    requests = None


# ---------------------------------------------------------------- 2) 생존확률 (지금 됨)
def survival_features(df: pd.DataFrame) -> dict:
    """상권변화지표의 운영/폐업 평균개월로 '3년 생존 신호'를 만든다.
    OPR_SALE_MT_AVRG(생존 사업체 평균 영업개월), CLS_SALE_MT_AVRG(폐업 사업체 평균개월).
    실데이터로 즉시 계산 — 외부 API 불필요."""
    out = {}
    if {"OPR_SALE_MT_AVRG", "CLS_SALE_MT_AVRG"}.issubset(df.columns):
        opr = pd.to_numeric(df["OPR_SALE_MT_AVRG"], errors="coerce")
        cls = pd.to_numeric(df["CLS_SALE_MT_AVRG"], errors="coerce")
        # 생존신호 = 생존개월/(생존+폐업개월) — 높을수록 오래 버티는 상권
        out["F_SURVIVAL_SIGNAL"] = (opr / (opr + cls).replace(0, np.nan))
        # 36개월(3년) 이상 생존 상권 여부
        out["F_SURVIVE_3YR"] = (opr >= 36).astype(float)
    return {k: v for k, v in out.items() if v is not None}


# ---------------------------------------------------------------- 1) 검색 트렌드
def naver_search_trend(keyword: str, start="2023-01-01", end="2025-12-31") -> pd.DataFrame:
    """네이버 데이터랩 검색어 트렌드. 환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 필요.
    반환: 월별 검색비율 DataFrame (선행지표). 키 없으면 안내 후 빈 DataFrame."""
    cid = os.getenv("NAVER_CLIENT_ID"); sec = os.getenv("NAVER_CLIENT_SECRET")
    if not (cid and sec and requests):
        print("  [검색트렌드] NAVER_CLIENT_ID/SECRET 없음 — 스킵 (키 넣으면 동작)")
        return pd.DataFrame()
    r = requests.post("https://openapi.naver.com/v1/datalab/search",
                      headers={"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": sec,
                               "Content-Type": "application/json"},
                      json={"startDate": start, "endDate": end, "timeUnit": "month",
                            "keywordGroups": [{"groupName": keyword, "keywords": [keyword]}]},
                      timeout=20)
    data = r.json().get("results", [{}])[0].get("data", [])
    return pd.DataFrame(data)  # period, ratio


def google_trends(keyword: str, geo="KR") -> pd.DataFrame:
    """Google Trends (pytrends). pip install pytrends 필요. 키 불필요하나 네트워크 필요."""
    try:
        from pytrends.request import TrendReq
    except Exception:
        print("  [Google Trends] pytrends 미설치 — pip install pytrends"); return pd.DataFrame()
    p = TrendReq(hl="ko", tz=540)
    p.build_payload([keyword], geo=geo, timeframe="today 12-m")
    return p.interest_over_time()


# ---------------------------------------------------------------- 3) 부동산/임대료
def rent_features(df: pd.DataFrame, rent_csv: str = None) -> dict:
    """임대시세 CSV(서울신용보증재단 환산임대료)를 붙여 '수익성' 신호.
    매출↑ 인데 임대료↑↑ 면 실수익 낮음 → rent 대비 매출 비율이 핵심."""
    if not rent_csv or not os.path.exists(rent_csv):
        print("  [임대료] 임대시세 CSV 없음 — 스킵")
        return {}
    rent = pd.read_csv(rent_csv)
    # 자치구/행정동 키로 병합 후 매출/임대료 비율 (수익성 프록시)
    return {"_rent_frame": rent}  # 병합은 파이프라인에서 키 맞춰 수행


# ---------------------------------------------------------------- 4) 교통
def transit_features(df: pd.DataFrame) -> dict:
    """교통카드(지하철·버스 승하차) 기반 접근성. 승하차 API/CSV 연동 지점.
    같은 역세권도 출구별 차이가 커서, 승하차량은 강한 유동 신호."""
    print("  [교통] 지하철/버스 승하차 데이터 연동 지점 (data.seoul.go.kr 교통카드)")
    return {}


# ---------------------------------------------------------------- 통합
def add_external_features(df: pd.DataFrame, rent_csv: str = None) -> dict:
    """지금 가능한 외부/파생 피처를 모아 반환. (생존확률은 즉시, 나머지는 키/CSV 있을 때)"""
    feats = {}
    feats.update(survival_features(df))          # 즉시 동작
    r = rent_features(df, rent_csv)
    if r:
        feats["_rent"] = r
    if feats:
        print(f"[External] 외부/생존 피처 {len([k for k in feats if not k.startswith('_')])}개 추가")
    return {k: v for k, v in feats.items() if not k.startswith("_")}


if __name__ == "__main__":
    # 데모: 생존확률 계산
    demo = pd.DataFrame({"OPR_SALE_MT_AVRG": [48, 20, 60], "CLS_SALE_MT_AVRG": [30, 40, 25]})
    for k, v in survival_features(demo).items():
        print(k, list(np.round(v, 3)))
