#!/usr/bin/env python3
"""
추정매출 다분기 이력 수집 → 업종별 매출 시계열 (예측 학습용).

VwsmTrdarSelngQq 를 여러 분기(2021~현재)에 대해 당월매출(THSMON_SELNG_AMT)을
업종(SVC_INDUTY_CD_NM)별로 합산 → 분기 시계열.

증분 수집: 기존 frontend/sales_history.json 에 이미 있는 분기는 건너뜀
(첫 실행만 전 분기, 이후엔 새 분기만 — API 콜 절약).

출력: frontend/sales_history.json
  { updated, quarters:[...정렬...], ind:{ 업종:{ "20211":금액, ... } } }

    python collect_sales_history.py           # 증분 수집
    python collect_sales_history.py --check
"""
import os, sys, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import load_json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "sales_history.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarSelngQq"
BASE = "http://openapi.seoul.go.kr:8088"

def fnum(x):
    try: return float(x)
    except: return 0.0

def all_quarters():
    y = datetime.date.today().year
    out=[]
    for yy in range(2021, y+1):
        for q in (1,2,3,4):
            out.append(f"{yy}{q}")
    return out

def fetch(start, end, qu):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/{qu}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def quarter_total(qu):
    """해당 분기가 존재하면 업종별 매출 dict, 없으면 None"""
    try:
        rt = ET.fromstring(fetch(1,1,qu))
    except Exception:
        return None
    if rt.findtext(".//RESULT/CODE") != "INFO-000":
        return None
    total = int(rt.findtext(".//list_total_count") or 0)
    if total == 0:
        return None
    agg={}
    step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            nm=row.findtext("SVC_INDUTY_CD_NM")
            if nm: agg[nm]=agg.get(nm,0.0)+fnum(row.findtext("THSMON_SELNG_AMT"))
        time.sleep(0.12)
    return {k:round(v) for k,v in agg.items()}

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직)."); return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    hist = load_json(OUT) or {"quarters":[], "ind":{}}
    have = set(hist.get("quarters", []))
    added=[]
    for qu in all_quarters():
        if qu in have: continue
        tot = quarter_total(qu)
        if tot is None:
            continue   # 아직 없는 미래 분기
        for nm,v in tot.items():
            hist["ind"].setdefault(nm, {})[qu]=v
        have.add(qu); added.append(qu)
        print(f"  분기 {qu} 수집 · 업종 {len(tot)}")
    hist["quarters"]=sorted(have)
    hist["updated"]=datetime.datetime.utcnow().strftime("%Y-%m-%d")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    import json; json.dump(hist, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 분기수", len(hist["quarters"]), "· 신규", added or "없음")
    return 0

if __name__ == "__main__":
    sys.exit(main())
