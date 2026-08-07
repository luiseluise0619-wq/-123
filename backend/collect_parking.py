#!/usr/bin/env python3
"""
전국주차장 표준데이터 → 서울 자치구별 주차장 집계(입지 '주차 접근성').

데이터: 공공데이터포털 전국주차장정보표준데이터
  API: https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api
  필드: prkplceNm, lnmadr(지번주소), rdnmadr(도로명주소),
        prkcmprt(주차구획수), latitude, longitude

자치구 배정: 주소 문자열에서 '○○구'를 파싱(서울만). 좌표 불필요.
지어냄 없음: DATA_GO_KR_KEY 없으면 생략. 샌드박스 외부망 차단 → Action에서 실행.

출력: frontend/parking_gu.json
  { updated, source, gu:{ 강남구:{lots, slots}, ... }, total_lots, total_slots }

    python collect_parking.py            # 수집·집계·저장
    python collect_parking.py --check    # 키 존재만 확인
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "parking_gu.json")

KEY = os.environ.get("DATA_GO_KR_KEY", "").strip()
URL = "https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api"
GU_SET = {"종로구","중구","용산구","성동구","광진구","동대문구","중랑구","성북구","강북구",
 "도봉구","노원구","은평구","서대문구","마포구","양천구","강서구","구로구","금천구",
 "영등포구","동작구","관악구","서초구","강남구","송파구","강동구"}

def gu_of(addr):
    if not addr or "서울" not in addr: return None
    for g in GU_SET:
        if g in addr: return g
    return None

def fetch(page, rows=1000):
    qs = urllib.parse.urlencode({
        "serviceKey": KEY, "pageNo": page, "numOfRows": rows, "type": "xml"}, safe="%")
    req = urllib.request.Request(URL+"?"+qs, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8")

def main():
    if not KEY:
        print("DATA_GO_KR_KEY 없음 — 수집 생략(정직). Action Secrets 에 등록 필요.")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("DATA_GO_KR_KEY 존재 — 수집 가능"); return 0

    first = fetch(1, 1)
    root = ET.fromstring(first)
    total = int(root.findtext(".//totalCount") or "0")
    if total == 0:
        # 에러 응답 진단
        print("totalCount=0 / 응답:", first[:300]); return 2
    print(f"전국 주차장 총 {total:,}건 → 서울만 집계")

    acc = {g: {"lots":0, "slots":0} for g in GU_SET}
    rows = 1000
    pages = (total + rows - 1)//rows
    for p in range(1, pages+1):
        for attempt in range(4):
            try:
                xml = fetch(p, rows); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        rt = ET.fromstring(xml)
        for it in rt.findall(".//item"):
            g = gu_of(it.findtext("lnmadr")) or gu_of(it.findtext("rdnmadr"))
            if not g: continue
            acc[g]["lots"] += 1
            try: acc[g]["slots"] += int(float(it.findtext("prkcmprt") or 0))
            except: pass
        if p % 10 == 0 or p == pages: print(f"  {p}/{pages} 페이지")
        time.sleep(0.1)

    out = {
        "source": "전국주차장정보표준데이터(data.go.kr)",
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "gu": {g: acc[g] for g in sorted(acc)},
        "total_lots": sum(a["lots"] for a in acc.values()),
        "total_slots": sum(a["slots"] for a in acc.values()),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    top = sorted(out["gu"].items(), key=lambda x:-x[1]["lots"])[:3]
    print("저장:", OUT, "· 서울 주차장", out["total_lots"], "곳")
    print("상위:", [(g, d["lots"]) for g,d in top])
    return 0

if __name__ == "__main__":
    sys.exit(main())
