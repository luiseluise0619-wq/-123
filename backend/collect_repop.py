#!/usr/bin/env python3
"""
서울 상권분석 상주인구(VwsmTrdarRepopQq) → 서울 전체 거주민(배후수요) 프로필.

상권별 상주인구(거주 인구) + 연령/성별 + 가구수(아파트/비아파트)를 서울 전체로 합산.
유동인구(생활인구)가 '그 시간 있는 사람'이라면, 상주인구는 '거기 사는 주민' = 배후수요.

출력: frontend/repop.json
  { quarter, updated, tot, m, f, age:[10,20,30,40,50,60+], hshld, apt, nonapt }

지어냄 없음: SEOUL_API_KEY 없으면 생략. 최신 분기 자동 탐색.

    python collect_repop.py            # 수집·집계·저장
    python collect_repop.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "repop.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarRepopQq"
BASE = "http://openapi.seoul.go.kr:8088"
AGE = ["AGRDE_10_REPOP_CO","AGRDE_20_REPOP_CO","AGRDE_30_REPOP_CO",
       "AGRDE_40_REPOP_CO","AGRDE_50_REPOP_CO","AGRDE_60_ABOVE_REPOP_CO"]

def fnum(x):
    try: return float(x)
    except: return 0.0

def fetch(start, end, qu=""):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/"
    if qu: url += f"{qu}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def latest_quarter():
    y = datetime.date.today().year
    for yy in (y, y-1, y-2):
        for q in (4,3,2,1):
            qu=f"{yy}{q}"
            try:
                rt=ET.fromstring(fetch(1,1,qu))
                if rt.findtext(".//RESULT/CODE")=="INFO-000" and int(rt.findtext(".//list_total_count") or 0)>0:
                    return qu, int(rt.findtext(".//list_total_count"))
            except Exception: continue
    return None, 0

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직)."); return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    qu, total = latest_quarter()
    if not qu:
        print("최신 분기 탐색 실패"); return 2
    print(f"최신 분기 {qu} · 총 {total:,}행")

    acc={"tot":0.0,"m":0.0,"f":0.0,"age":[0.0]*6,"hshld":0.0,"apt":0.0,"nonapt":0.0}
    step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            acc["tot"]+=fnum(row.findtext("TOT_REPOP_CO"))
            acc["m"]  +=fnum(row.findtext("ML_REPOP_CO"))
            acc["f"]  +=fnum(row.findtext("FML_REPOP_CO"))
            for i,k in enumerate(AGE): acc["age"][i]+=fnum(row.findtext(k))
            acc["hshld"] +=fnum(row.findtext("TOT_HSHLD_CO"))
            acc["apt"]   +=fnum(row.findtext("APT_HSHLD_CO"))
            acc["nonapt"]+=fnum(row.findtext("NON_APT_HSHLD_CO"))
        if (s//step)%5==0 or e==total: print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.12)

    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "tot":round(acc["tot"]),"m":round(acc["m"]),"f":round(acc["f"]),
         "age":[round(v) for v in acc["age"]],
         "hshld":round(acc["hshld"]),"apt":round(acc["apt"]),"nonapt":round(acc["nonapt"])}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 상주인구", out["tot"], "· 가구", out["hshld"])
    return 0

if __name__ == "__main__":
    sys.exit(main())
