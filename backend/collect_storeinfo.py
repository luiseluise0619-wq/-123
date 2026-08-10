#!/usr/bin/env python3
"""
소상공인시장진흥공단 상가(상권)정보 (공공데이터포털) → 자치구별 실측 상가 수.

localdata.go.kr 대신 공공데이터포털의 '소상공인 상가정보' API 사용.
자치구(시군구코드)별 총 상가 수를 응답 헤더의 totalCount로 '싸게' 집계(전 행 미수신).
→ 자치구별 실측 점포 밀도 → 경쟁강도(배후 생활인구 ÷ 점포수) 계산의 기반.

키: DATA_GO_KR_KEY (주차 수집과 동일 키 재사용 — 새 키 불필요).
정직: 키 없거나 응답 오류/전부 0이면 available:false. 지어낸 0 금지.
샌드박스 외부망 차단 → GitHub Action(개방망)에서 실행됨.

출력: frontend/storeinfo_gu.json
  { available, updated, source, gu:{ '강남구':{stores}, ... } }

    DATA_GO_KR_KEY=... python collect_storeinfo.py
    python collect_storeinfo.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "storeinfo_gu.json")
KEY  = os.environ.get("DATA_GO_KR_KEY", "").strip()
URL  = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong"

# 서울 25 자치구 시군구코드(공개 표준코드)
SIGUNGU = {
    "종로구":"11110","중구":"11140","용산구":"11170","성동구":"11200","광진구":"11215",
    "동대문구":"11230","중랑구":"11260","성북구":"11290","강북구":"11305","도봉구":"11320",
    "노원구":"11350","은평구":"11380","서대문구":"11410","마포구":"11440","양천구":"11470",
    "강서구":"11500","구로구":"11530","금천구":"11545","영등포구":"11560","동작구":"11590",
    "관악구":"11620","서초구":"11650","강남구":"11680","송파구":"11710","강동구":"11740",
}

def total_for(signgu):
    qs = urllib.parse.urlencode({
        "serviceKey":KEY, "divId":"signguCd", "key":signgu,
        "pageNo":1, "numOfRows":1, "type":"xml"}, safe="%")
    req = urllib.request.Request(URL+"?"+qs, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=40) as r:
        xml = r.read().decode("utf-8")
    root = ET.fromstring(xml)
    # 오류 응답(공공데이터포털 표준) 감지
    rc = root.findtext(".//resultCode") or root.findtext(".//returnReasonCode")
    if rc not in (None, "00", "0000"):
        raise RuntimeError(f"api resultCode {rc}: {root.findtext('.//resultMsg') or root.findtext('.//returnAuthMsg') or ''} | {xml[:160]}")
    return int(root.findtext(".//totalCount") or "0"), xml

def write_unavailable(reason):
    json.dump({"available":False,"reason":reason,
        "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
        open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)

def main():
    if not KEY:
        print("DATA_GO_KR_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv: write_unavailable("DATA_GO_KR_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("DATA_GO_KR_KEY 존재 — 수집 가능"); return 0

    gu = {}; grand = 0; last_xml = ""
    for name, code in SIGUNGU.items():
        n = 0
        for attempt in range(3):
            try:
                n, last_xml = total_for(code); break
            except Exception as e:
                if attempt == 2: print(f"  {name} 실패: {e}")
                else: time.sleep(2*(attempt+1))
        gu[name] = {"stores": n}
        grand += n
        print(f"  {name}: 상가 {n:,}")
        time.sleep(0.2)

    # 정직 가드: 전부 0이면 키/엔드포인트/파라미터 불일치 → 지어낸 0 금지.
    if grand <= 0:
        write_unavailable("전 자치구 상가수 0 — 키/엔드포인트/파라미터 불일치 가능 | " + last_xml[:200])
        return 3

    out = {"available":True, "source":"소상공인시장진흥공단 상가(상권)정보(공공데이터포털)",
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "note":"자치구별 전체 상가 수(전 업종). 업종·행정동 세분은 후속.",
           "gu":gu}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 서울 상가 총", grand)
    return 0

if __name__ == "__main__":
    sys.exit(main())
