#!/usr/bin/env python3
"""
지방행정 인허가데이터(localdata.go.kr) → 자치구별 '일반음식점' 실측 점포수·폐업 누적.

서울 25개 자치구 각각에 대해 일반음식점(opnSvcId=07_24_04_P)의
- 영업 중(state=01) 점포수
- 폐업(state=03) 누적수
를 API 응답 헤더의 totalCount로 '싸게' 집계(전 행을 받지 않음).

왜 중요:
- 자치구별 '실측 점포수'가 처음으로 생김 → 경쟁강도(점포당 배후 생활인구) 계산 가능
- 누적 폐업/(영업+폐업) = 자치구별 실측 폐업 비율
- 개별 점포 좌표·인허가일이 있어 향후 행정동 해상도로 내려갈 발판

정직:
- LOCALDATA_KEY(무료, localdata.go.kr 회원가입 후 발급) 없으면 available:false.
- 응답 오류/전부 0이면 available:false — 지어낸 0 금지.
- 누적 폐업은 수십 년 누적이라 '최근 체온'이 아님을 프론트에 명시할 것.

출력: frontend/localdata_gu.json
  { available, updated, opnSvc, gu:{ '강남구':{active,closed,rate}, ... } }

    LOCALDATA_KEY=... python collect_localdata.py
    python collect_localdata.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "localdata_gu.json")
KEY  = os.environ.get("LOCALDATA_KEY", "").strip()
BASE = "http://www.localdata.go.kr/platform/rest/GR0/openDataApi"
OPN  = "07_24_04_P"   # 일반음식점

# localdata는 5자리 시군구코드(localCode) 사용 — 서울 25 자치구(공개 표준코드)
SIGUNGU = {
    "종로구":"11110","중구":"11140","용산구":"11170","성동구":"11200","광진구":"11215",
    "동대문구":"11230","중랑구":"11260","성북구":"11290","강북구":"11305","도봉구":"11320",
    "노원구":"11350","은평구":"11380","서대문구":"11410","마포구":"11440","양천구":"11470",
    "강서구":"11500","구로구":"11530","금천구":"11545","영등포구":"11560","동작구":"11590",
    "관악구":"11620","서초구":"11650","강남구":"11680","송파구":"11710","강동구":"11740",
}

def total_count(localCode, state):
    q = urllib.parse.urlencode({
        "authKey":KEY, "opnSvcId":OPN, "localCode":localCode,
        "state":state, "pageIndex":1, "pageSize":1, "resultType":"json"})
    req = urllib.request.Request(BASE+"?"+q, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        d = json.loads(r.read().decode("utf-8"))
    res = d.get("result",{})
    proc = (res.get("header",{}).get("process",{}) or {})
    if proc.get("code") not in (None,"00"):  # 오류코드면 예외
        raise RuntimeError("localdata process code "+str(proc.get("code"))+": "+str(proc.get("message")))
    return int(res.get("header",{}).get("paging",{}).get("totalCount") or 0)

def write_unavailable(reason):
    json.dump({"available":False,"reason":reason,
        "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
        open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)

def main():
    if not KEY:
        print("LOCALDATA_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv: write_unavailable("LOCALDATA_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("LOCALDATA_KEY 존재 — 수집 가능"); return 0

    gu = {}
    grand = 0
    for name, code in SIGUNGU.items():
        try:
            active = total_count(code, "01")
            time.sleep(0.2)
            closed = total_count(code, "03")
            time.sleep(0.2)
        except Exception as e:
            print(f"  {name} 실패: {e}")
            active = closed = 0
        tot = active + closed
        gu[name] = {"active":active, "closed":closed,
                    "rate": round(closed/tot*100,1) if tot else 0.0}
        grand += active
        print(f"  {name}: 영업 {active:,} · 폐업누적 {closed:,}")

    # 정직 가드: 전부 0이면 키/파라미터/스키마 불일치 → 지어낸 0 금지.
    if grand <= 0:
        write_unavailable("전 자치구 영업 점포수 0 — 키/파라미터/스키마 불일치 가능")
        return 3

    out = {"available":True, "opnSvc":"일반음식점",
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "note":"폐업은 누적(최근 체온 아님). 영업 점포수는 실측 인허가 기준.",
           "gu":gu}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 서울 영업 음식점", grand)
    return 0

if __name__ == "__main__":
    sys.exit(main())
