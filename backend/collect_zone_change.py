#!/usr/bin/env python3
"""
서울 상권분석 상권변화지표(VwsmTrdarIxQq) → 상권별 '뜨는/지는' 등급 + 평균 생존기간.

상권 하나당 1행(업종 구분 없음). 표준단위구역 기준, 최신 분기 자동 탐색(미래 분기 차단).
등급(TRDAR_CHNGE_IX): LL 다이나믹 / LH 상권확장 / HL 상권축소 / HH 정체.
  - 운영영업개월 = 그 상권 생존 점포의 평균 영업기간(개월) = '평균 몇 개월 버티나'.
  - 서울 평균과 비교해 등급이 매겨짐(원본 정의).

정직: SEOUL_API_KEY 없으면 생략. 지어냄 없음.
샌드박스 외부망 차단 → GitHub Action(개방망)에서 실행됨.

출력: frontend/zone_change.json
  { available, quarter, updated, seoul:{opr,cls},
    grades:{LL,LH,HL,HH}(개수), n_zones,
    zones:{ "<cd>":{nm, ix, ix_nm, opr, cls} } }   opr=운영개월, cls=폐업개월

    SEOUL_API_KEY=... python collect_zone_change.py
    python collect_zone_change.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "zone_change.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarIxQq"
BASE = "http://openapi.seoul.go.kr:8088"

def fnum(x):
    try: return float(x)
    except (TypeError, ValueError): return 0.0

def fetch(start, end, qu=""):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/"
    if qu: url += f"{qu}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def latest_quarter():
    today = datetime.date.today()
    cur = today.year*10 + (today.month-1)//3 + 1   # 현재 캘린더 분기(YYYYQ)
    for yy in (today.year, today.year-1, today.year-2):
        for q in (4,3,2,1):
            qu=f"{yy}{q}"
            if int(qu) > cur:   # 미래 분기는 건너뜀
                continue
            try:
                rt=ET.fromstring(fetch(1,1,qu))
                if rt.findtext(".//RESULT/CODE")=="INFO-000" and int(rt.findtext(".//list_total_count") or 0)>0:
                    return qu, int(rt.findtext(".//list_total_count"))
            except Exception:
                continue
    return None, 0

def write_unavailable(reason):
    json.dump({"available":False,"reason":reason,
        "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
        open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv: write_unavailable("SEOUL_API_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    qu, total = latest_quarter()
    if not qu:
        write_unavailable("최신 분기 탐색 실패"); return 2
    print(f"최신 분기 {qu} · 총 {total:,}행")

    zones={}; grades={"LL":0,"LH":0,"HL":0,"HH":0}
    su_opr=0.0; su_cls=0.0; step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            cd=(row.findtext("TRDAR_CD") or "").strip()
            if not cd: continue
            ix=(row.findtext("TRDAR_CHNGE_IX") or "").strip()
            zones[cd]={
                "nm": (row.findtext("TRDAR_CD_NM") or cd).strip(),
                "ix": ix,
                "ix_nm": (row.findtext("TRDAR_CHNGE_IX_NM") or "").strip(),
                "opr": round(fnum(row.findtext("OPR_SALE_MT_AVRG"))),
                "cls": round(fnum(row.findtext("CLS_SALE_MT_AVRG"))),
            }
            if ix in grades: grades[ix]+=1
            su_opr=fnum(row.findtext("SU_OPR_SALE_MT_AVRG")) or su_opr
            su_cls=fnum(row.findtext("SU_CLS_SALE_MT_AVRG")) or su_cls
        time.sleep(0.12)

    if not zones:
        write_unavailable("응답 파싱 결과 0 — 필드/스키마 확인"); return 3

    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "note":"상권변화지표(상권당 1행). ix=등급(LL 다이나믹/LH 상권확장/HL 상권축소/HH 정체), opr=평균 운영개월(생존기간), cls=평균 폐업개월.",
         "seoul":{"opr":round(su_opr),"cls":round(su_cls)},
         "grades":grades,"n_zones":len(zones),"zones":zones}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)} · 등급 {grades} · 서울 운영/폐업 {out['seoul']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
