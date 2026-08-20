#!/usr/bin/env python3
"""
서울 상권분석 집객시설(VwsmTrdarFcltyQq) → 상권별 배후 수요 앵커.

상권 하나당 여러 분기 행(연 1회 갱신, 같은 해 1~3분기 동일) → 최신 분기만.
대학·병원·지하철·버스·백화점·숙박 등 '사람을 끌어오는 시설' 수를 상권별로.

정직: SEOUL_API_KEY 없으면 생략. 빈 태그(<UNIV_CO/>)는 0으로.
샌드박스 외부망 차단 → GitHub Action(개방망)에서 실행됨.

출력: frontend/zone_facility.json
  { available, quarter, updated, n_zones,
    zones:{ "<cd>":{ nm, total, fac:{앵커명:수, ...(0 제외)} } } }

    SEOUL_API_KEY=... python collect_zone_facility.py
    python collect_zone_facility.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "zone_facility.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarFcltyQq"
BASE = "http://openapi.seoul.go.kr:8088"

# 수요 앵커(사람을 끌어오는 시설) — 태그 → 짧은 라벨. 0인 항목은 출력에서 제외.
FAC = [("UNIV_CO","대학"),("GEHSPT_CO","종합병원"),("GNRL_HSPTL_CO","병원"),
       ("SUBWAY_STATN_CO","지하철역"),("BUS_STTN_CO","버스정거장"),("DRTS_CO","백화점"),
       ("THEAT_CO","극장"),("STAYNG_FCLTY_CO","숙박"),("PBLOFC_CO","관공서"),
       ("BANK_CO","은행"),("PARMACY_CO","약국"),("SUPMK_CO","슈퍼마켓"),
       ("ELESCH_CO","초등학교"),("MSKUL_CO","중학교"),("HGSCHL_CO","고등학교"),
       ("KNDRGR_CO","유치원"),("RLROAD_STATN_CO","철도역"),("BUS_TRMINL_CO","버스터미널")]

def inum(x):
    try: return int(float(x))
    except (TypeError, ValueError): return 0

def fetch(start, end, qu=""):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/"
    if qu: url += f"{qu}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def latest_quarter():
    today = datetime.date.today()
    cur = today.year*10 + (today.month-1)//3 + 1
    for yy in (today.year, today.year-1, today.year-2):
        for q in (4,3,2,1):
            qu=f"{yy}{q}"
            if int(qu) > cur: continue
            try:
                rt=ET.fromstring(fetch(1,1,qu))
                if rt.findtext(".//RESULT/CODE")=="INFO-000" and int(rt.findtext(".//list_total_count") or 0)>0:
                    return qu, int(rt.findtext(".//list_total_count"))
            except Exception: continue
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

    zones={}; step=1000
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
            fac={lab:inum(row.findtext(tag)) for tag,lab in FAC}
            fac={k:v for k,v in fac.items() if v>0}   # 0 제외
            zones[cd]={"nm":(row.findtext("TRDAR_CD_NM") or cd).strip(),
                       "total":inum(row.findtext("VIATR_FCLTY_CO")),"fac":fac}
        time.sleep(0.12)

    if not zones:
        write_unavailable("응답 파싱 결과 0 — 필드/스키마 확인"); return 3

    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "note":"상권별 집객시설(수요 앵커). total=집객시설 총수, fac=시설별 수(0 제외).",
         "n_zones":len(zones),"zones":zones}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
