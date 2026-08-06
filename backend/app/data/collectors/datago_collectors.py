"""
data.go.kr 승인 API 수집기 — 공정위 가맹 개폐점률 + 소진공 상가업소.

키는 코드에 하드코딩하지 않는다. 환경변수 DATA_GO_KR_KEY 로만 받는다.
    export DATA_GO_KR_KEY="발급받은 일반 인증키"
샌드박스(claude)는 data.go.kr 차단 — 네 PC/서버에서 동작. 키 없거나 실패 시
available=False 로 정직하게 알리고 지어낸 값을 반환하지 않는다.

■ 공정위 가맹정보 개폐점률 (업종별 '폐점률' = 실제 폐업 근거)
  End: https://apis.data.go.kr/1130000/FftcIndutyFrcsCntOpclStatsService
  op : /getIndutyFrcsCntOpclStats  (가맹사업기준년도 필수, 업종대분류코드 선택)
  필드: 전체가맹점수 / 신규가맹점률 / 종료해지가맹점수 / 종료해지율(=폐점률) 등
  용도: 손익분기 판정의 '기준선(50/75%)·신규점 85%' 가정을 업종별 실측 폐점률로 교체.

■ 소진공 상가(상권)정보 (전국 점포 — 포화도·개폐업)
  End: https://apis.data.go.kr/B553077/api/open/sdsc2
  op : /storeListInUpjong (업종별) · /storeListInDong (행정동) · /storeListByDate (개폐업)
  용도: 전국 점포수·밀도(포화도), /storeListByDate 로 개·폐업 추적. (매출은 없음)
"""
import os
import json
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

FRANCHISE_ENDPOINT = "https://apis.data.go.kr/1130000/FftcIndutyFrcsCntOpclStatsService"
SDSC_ENDPOINT = "https://apis.data.go.kr/B553077/api/open/sdsc2"


def _key() -> Optional[str]:
    return os.getenv("DATA_GO_KR_KEY") or os.getenv("SERVICE_KEY")


def _call(url: str, timeout: int = 20) -> Dict[str, Any]:
    try:
        raw = urllib.request.urlopen(url, timeout=timeout).read().decode("utf-8", "ignore")
        try:
            return {"ok": True, "data": json.loads(raw)}
        except Exception:
            return {"ok": True, "format": "xml_or_text", "raw": raw[:2000]}
    except Exception as e:  # 샌드박스 차단 포함
        return {"ok": False, "error": str(e)[:120]}


# ---------------------------------------------------------------- 공정위 개폐점률
def franchise_openclose(base_year: int, large_code: str = "", rows: int = 500) -> Dict[str, Any]:
    """업종대분류별 가맹점수·신규가맹점률·종료해지율(폐점률). base_year=가맹사업기준년도."""
    key = _key()
    if not key:
        return {"available": False,
                "message": "DATA_GO_KR_KEY 없음. export DATA_GO_KR_KEY=키 후 사용(공정위 활용신청 승인 필요)."}
    params = {"serviceKey": key, "resultType": "json",
              "pageNo": 1, "numOfRows": rows, "yr": base_year}
    if large_code:
        params["indutyLclasCd"] = large_code
    url = f"{FRANCHISE_ENDPOINT}/getIndutyFrcsCntOpclStats?" + urllib.parse.urlencode(params, safe="%")
    r = _call(url)
    if not r["ok"]:
        return {"available": False, "endpoint": FRANCHISE_ENDPOINT, "year": base_year,
                "message": f"호출 실패({r['error']}). 샌드박스는 data.go.kr 차단 — 네 PC에서 실행."}
    return {"available": True, "source": "FTC_franchise_openclose", "year": base_year,
            "note": "종료해지율 = 업종 폐점률. 손익분기 판정 기준 교체에 사용.", "result": r.get("data", r)}


def franchise_close_rates(base_year: int) -> Dict[str, float]:
    """업종대분류 → 폐점률(종료해지율) dict 로 정리(판정 캘리브레이션용). 실패 시 빈 dict."""
    res = franchise_openclose(base_year)
    out: Dict[str, float] = {}
    if not res.get("available"):
        return out
    try:
        items = res["result"]["response"]["body"]["items"]["item"]
        items = items if isinstance(items, list) else [items]
        for it in items:
            nm = it.get("indutyLclasNm") or it.get("업종대분류명")
            rate = it.get("trmntCtrtRt") or it.get("종료해지율")
            if nm and rate is not None:
                out[str(nm)] = float(rate)
    except Exception:
        pass
    return out


# ---------------------------------------------------------------- 소진공 상가업소
def stores_by_upjong(induty_code: str, rows: int = 1000, page: int = 1) -> Dict[str, Any]:
    """업종코드별 전국 상가업소 목록(포화도·점포수). induty_code=상권정보 업종코드."""
    key = _key()
    if not key:
        return {"available": False, "message": "DATA_GO_KR_KEY 없음."}
    params = {"serviceKey": key, "type": "json", "numOfRows": rows, "pageNo": page,
              "indsLclsCd": induty_code}
    url = f"{SDSC_ENDPOINT}/storeListInUpjong?" + urllib.parse.urlencode(params, safe="%")
    r = _call(url)
    if not r["ok"]:
        return {"available": False, "endpoint": SDSC_ENDPOINT,
                "message": f"호출 실패({r['error']}). 네 PC에서 실행."}
    return {"available": True, "source": "SDSC_storeListInUpjong", "result": r.get("data", r)}


def stores_changed_since(ymd: str, rows: int = 1000, page: int = 1) -> Dict[str, Any]:
    """입력 일자 기준 수정/삭제(=폐업 포함) 업소 목록 — 개·폐업 추적용. ymd=YYYYMMDD."""
    key = _key()
    if not key:
        return {"available": False, "message": "DATA_GO_KR_KEY 없음."}
    params = {"serviceKey": key, "type": "json", "numOfRows": rows, "pageNo": page, "date": ymd}
    url = f"{SDSC_ENDPOINT}/storeListByDate?" + urllib.parse.urlencode(params, safe="%")
    r = _call(url)
    if not r["ok"]:
        return {"available": False, "message": f"호출 실패({r['error']}). 네 PC에서 실행."}
    return {"available": True, "source": "SDSC_storeListByDate",
            "note": "삭제 플래그 업소 = 폐업. 개·폐업 순증감 산출에 사용.", "result": r.get("data", r)}


if __name__ == "__main__":
    import sys
    yr = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
    print("공정위 개폐점률:", json.dumps(franchise_openclose(yr), ensure_ascii=False)[:300])
    print("업종별 폐점률:", franchise_close_rates(yr))
