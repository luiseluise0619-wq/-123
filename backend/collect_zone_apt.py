#!/usr/bin/env python3
"""
서울 상권분석 아파트-상권(InfoTrdarAptQq) → 상권별 배후 주거 규모·구매력.

상권당 여러 분기 행(연 1회 갱신) → 최신 분기만. 서비스명은 InfoTrdarAptQq(Vwsm 아님).
단지 수·총 세대·평균 시가로 "배후에 아파트 얼마나, 얼마짜리"를 상권별로.

정직: SEOUL_API_KEY 없으면 생략. 빈 태그는 0.
샌드박스 외부망 차단 → GitHub Action(개방망)에서 실행됨.

출력: frontend/zone_apt.json
  { available, quarter, updated, n_zones,
    zones:{ "<cd>":{ nm, danji, hshld, price_eok, area } } }
  danji=단지수, hshld=총세대, price_eok=평균시가(억), area=평균면적(㎡)

    SEOUL_API_KEY=... python collect_zone_apt.py
    python collect_zone_apt.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "zone_apt.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "InfoTrdarAptQq"
BASE = "http://openapi.seoul.go.kr:8088"

# 면적대별 세대수 태그(합 = 총 세대)
HSHLD = ["AE_66_SQMT_BELO_HSHLD_CO","AE_66_SQMT_HSHLD_CO","AE_99_SQMT_HSHLD_CO",
         "AE_132_SQMT_HSHLD_CO","AE_165_SQMT_HSHLD_CO"]

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
            hshld=sum(inum(row.findtext(t)) for t in HSHLD)
            mktc=inum(row.findtext("AVRG_MKTC"))
            zones[cd]={"nm":(row.findtext("TRDAR_CD_NM") or cd).strip(),
                       "danji":inum(row.findtext("APT_HSMP_CO")),
                       "hshld":hshld,
                       "price_eok":round(mktc/1e8,1) if mktc else 0,
                       "area":inum(row.findtext("AVRG_AE"))}
        time.sleep(0.12)

    if not zones:
        write_unavailable("응답 파싱 결과 0 — 필드/스키마 확인"); return 3

    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "note":"상권별 배후 아파트. danji=단지수, hshld=총세대, price_eok=평균시가(억), area=평균면적㎡.",
         "n_zones":len(zones),"zones":zones}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
