"""
식자재 가격 AI — 한국농수산식품유통공사 공판장 실가격으로 분석+예측.

데이터: backend/app/data/market/agmarket_prices.csv (공판장 일별 평균가격, 92k행).
품목별 시계열에서:
  - 최근 가격 / 전년대비 등락
  - 단기 추세(최근 N일 선형회귀 기울기)
  - 다음 기간 예측(이동평균 + 추세 반영, 단순·설명가능)
  - 가격 급등 시 같은 부류 내 대체 품목 추천
지어낸 수치 없음 — 전부 실데이터 계산. 파일 없으면 available=False.
"""

import os
import functools
from typing import Dict, Any, List

CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "data", "market", "agmarket_prices.csv")


@functools.lru_cache(maxsize=1)
def _load():
    if not os.path.exists(CSV):
        return None
    import pandas as pd
    df = pd.read_csv(CSV, encoding="utf-8-sig", low_memory=False)
    df["가격날짜"] = pd.to_datetime(df["가격날짜"], errors="coerce")
    df["평균가격"] = pd.to_numeric(df["평균가격"], errors="coerce")
    df = df[(df["평균가격"] > 0) & df["가격날짜"].notna()]
    return df


def items() -> List[str]:
    df = _load()
    return [] if df is None else sorted(df["품목명"].dropna().unique().tolist())


# ---------------------------------------------------------------- 라이브 자동갱신
AT_ENDPOINT = "https://apis.data.go.kr/B552845/perDay/price"
_CODES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "..", "data", "market", "at_item_codes.json")


@functools.lru_cache(maxsize=1)
def _item_codes():
    import json
    try:
        return json.load(open(_CODES_PATH, encoding="utf-8"))
    except Exception:
        return {}


def live_price(item: str = "배추", days: int = 7, se_cd: str = "01",
               start_day: str = None, end_day: str = None) -> Dict[str, Any]:
    """aT '일별 도,소매 가격정보' 실시간 조회 (자동갱신). 명세(B552845/perDay/price) 준수.
    필수 cond: 조사일자 범위(exmn_ymd GTE/LTE), 부류코드(ctgry_cd), 품목코드(item_cd).
    se_cd: 01 소매(기본) / 02 중도매. 키: 환경변수 DATA_GO_KR_KEY (코드에 안 넣음).
    """
    import os
    import datetime
    import urllib.parse
    import urllib.request
    import json as _json

    key = os.getenv("DATA_GO_KR_KEY") or os.getenv("KAMIS_CERT_KEY")
    if not key:
        return {"available": False,
                "message": "DATA_GO_KR_KEY 환경변수 없음. export DATA_GO_KR_KEY=발급키 후 사용."}
    codes = _item_codes()
    code = codes.get(item)
    if not code:
        return {"available": False, "item": item,
                "message": f"'{item}' 품목코드 없음. 예: 배추/양파/사과 등. (총 {len(codes)}품목)"}
    today = datetime.date.today()
    gte = start_day or (today - datetime.timedelta(days=days)).strftime("%Y%m%d")
    lte = end_day or today.strftime("%Y%m%d")
    # 명세 파라미터(cond[field::OP] 형식) — urlencode 가 대괄호/콜론 인코딩 처리
    params = {
        "serviceKey": key, "returnType": "json", "pageNo": 1, "numOfRows": 500,
        "cond[exmn_ymd::GTE]": gte, "cond[exmn_ymd::LTE]": lte,
        "cond[ctgry_cd::EQ]": code["ctgry"], "cond[item_cd::EQ]": code["item"],
        "cond[se_cd::EQ]": se_cd,
    }
    url = AT_ENDPOINT + "?" + urllib.parse.urlencode(params, safe="%")
    try:
        raw = urllib.request.urlopen(url, timeout=20).read().decode("utf-8", "ignore")
        try:
            data = _json.loads(raw)
        except Exception:
            return {"available": True, "format": "non_json", "raw": raw[:1500]}
        body = (data.get("response", {}) or data).get("body", data)
        return {"available": True, "source": "aT_perDay_price", "item": item,
                "codes": code, "se": "소매" if se_cd == "01" else "중도매",
                "period": f"{gte}~{lte}", "result": body}
    except Exception as e:
        return {"available": False, "endpoint": AT_ENDPOINT, "item": item,
                "message": f"호출 실패({str(e)[:90]}). (샌드박스는 data.go.kr 차단 — 네 PC에서 동작)"}


def analyze(item: str) -> Dict[str, Any]:
    df = _load()
    if df is None:
        return {"available": False,
                "message": "가격 데이터 없음(agmarket_prices.csv). 공공데이터포털 공판장 가격 CSV 를 "
                           "backend/app/data/market/ 에 두세요. 지어내지 않습니다."}
    import numpy as np
    sub = df[df["품목명"] == item]
    if sub.empty:
        return {"available": False, "item": item,
                "message": f"'{item}' 데이터 없음. /market/food-items 로 품목명 확인."}
    # 일자별 평균(등급 통합)
    ts = sub.groupby("가격날짜")["평균가격"].mean().sort_index()
    latest_date = ts.index[-1]
    latest = float(ts.iloc[-1])
    # 최근 30포인트 선형추세
    recent = ts.iloc[-30:]
    x = np.arange(len(recent)); y = recent.values
    slope = float(np.polyfit(x, y, 1)[0]) if len(recent) >= 3 else 0.0
    # 다음 기간 예측: 최근 이동평균 + 추세 5스텝
    ma = float(recent.mean())
    forecast = max(0.0, ma + slope * 5)
    change_pct = round((forecast - latest) / latest * 100, 1) if latest else 0.0
    # 전년대비(데이터 컬럼 활용)
    yoy = None
    if "전년대비등락율" in sub.columns:
        import pandas as pd
        yv = pd.to_numeric(sub["전년대비등락율"], errors="coerce").dropna()
        if len(yv):
            yoy = round(float(yv.tail(20).mean()), 1)
    direction = "상승" if change_pct > 2 else "하락" if change_pct < -2 else "보합"

    # 급등 시 같은 부류 대체품 추천(최근 가격 안정/저렴한 것)
    alt = []
    if change_pct > 5 and "부류구분" in df.columns:
        cat = sub["부류구분"].iloc[0]
        peers = df[(df["부류구분"] == cat) & (df["품목명"] != item)]
        cheap = (peers.groupby("품목명")["평균가격"].mean().sort_values().head(3))
        alt = list(cheap.index)

    return {"available": True, "item": item,
            "latest_price": int(latest), "latest_date": str(latest_date.date()),
            "trend_slope_won_per_day": round(slope, 1),
            "forecast_next": int(forecast), "forecast_change_pct": change_pct,
            "direction": direction, "yoy_change_pct": yoy,
            "alternatives": alt,
            "advice": (f"{item} 가격 {direction} 예상({change_pct:+}%). "
                       + (f"대체 검토: {', '.join(alt)}." if alt else "현 수급 유지 무난.")),
            "method": "공판장 실가격 이동평균+선형추세(설명가능). ML 고도화 시 Prophet/LGBM 확장.",
            "note": "예측은 확정이 아닌 가능성입니다."}
