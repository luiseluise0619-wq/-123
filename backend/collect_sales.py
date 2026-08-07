#!/usr/bin/env python3
"""
서울 상권분석 추정매출(VwsmTrdarSelngQq) → 업종별 매출 패턴 집계.

데이터: 서울 열린데이터광장 '서울시 상권분석서비스(추정매출-상권)'
  상권별·업종별·분기 추정매출 + 시간대/요일/성별/연령 세분 (카드 실적 기반)
집계 단위: 업종(SVC_INDUTY_CD_NM) — 상권→자치구 매핑 불필요, 서울 전체 패턴.

산출(업종별):
  amt   당월 총매출(원), cnt 총건수, unit 객단가(=amt/cnt, 실측)
  tmzon 시간대 6구간 매출 비중(%)  [00-06,06-11,11-14,14-17,17-21,21-24]
  dow   요일 7일 매출 비중(%)       [월,화,수,목,금,토,일]
  gender[남,여] 매출 비중(%)
  age   연령 6구간 매출 비중(%)     [10,20,30,40,50,60+]

지어냄 없음: SEOUL_API_KEY 없으면 생략. 최신 분기를 자동 탐색.
출력: frontend/sales_by_industry.json

    python collect_sales.py            # 수집·집계·저장
    python collect_sales.py --check    # 키 존재만 확인
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "sales_by_industry.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarSelngQq"
BASE = "http://openapi.seoul.go.kr:8088"

TMZ = ["TMZON_00_06_SELNG_AMT","TMZON_06_11_SELNG_AMT","TMZON_11_14_SELNG_AMT",
       "TMZON_14_17_SELNG_AMT","TMZON_17_21_SELNG_AMT","TMZON_21_24_SELNG_AMT"]
DOW = ["MON_SELNG_AMT","TUES_SELNG_AMT","WED_SELNG_AMT","THUR_SELNG_AMT",
       "FRI_SELNG_AMT","SAT_SELNG_AMT","SUN_SELNG_AMT"]
AGE = ["AGRDE_10_SELNG_AMT","AGRDE_20_SELNG_AMT","AGRDE_30_SELNG_AMT",
       "AGRDE_40_SELNG_AMT","AGRDE_50_SELNG_AMT","AGRDE_60_ABOVE_SELNG_AMT"]

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
    # 최근 분기부터 역순 탐색 (올해~작년)
    y = datetime.date.today().year
    cands = []
    for yy in (y, y-1, y-2):
        for q in (4,3,2,1):
            cands.append(f"{yy}{q}")
    for qu in cands:
        try:
            xml = fetch(1,1,qu); rt = ET.fromstring(xml)
            if rt.findtext(".//RESULT/CODE")=="INFO-000" and int(rt.findtext(".//list_total_count") or 0)>0:
                return qu, int(rt.findtext(".//list_total_count"))
        except Exception:
            continue
    return None, 0

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직)."); return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    qu, total = latest_quarter()
    if not qu:
        print("최신 분기 탐색 실패 (API 응답 이상)"); return 2
    print(f"최신 분기 {qu} · 총 {total:,}행")

    acc = {}  # 업종명 -> dict
    step = 1000
    for s in range(1, total+1, step):
        e = min(s+step-1, total)
        for attempt in range(4):
            try: xml = fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        rt = ET.fromstring(xml)
        for row in rt.findall(".//row"):
            nm = row.findtext("SVC_INDUTY_CD_NM")
            if not nm: continue
            a = acc.setdefault(nm, {"amt":0.0,"cnt":0.0,"tmz":[0.0]*6,"dow":[0.0]*7,
                                    "ml":0.0,"fml":0.0,"age":[0.0]*6})
            a["amt"] += fnum(row.findtext("THSMON_SELNG_AMT"))
            a["cnt"] += fnum(row.findtext("THSMON_SELNG_CO"))
            for i,k in enumerate(TMZ): a["tmz"][i] += fnum(row.findtext(k))
            for i,k in enumerate(DOW): a["dow"][i] += fnum(row.findtext(k))
            a["ml"]  += fnum(row.findtext("ML_SELNG_AMT"))
            a["fml"] += fnum(row.findtext("FML_SELNG_AMT"))
            for i,k in enumerate(AGE): a["age"][i] += fnum(row.findtext(k))
        if (s//step) % 5 == 0 or e==total: print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.15)

    def pct(arr):
        t=sum(arr) or 1; return [round(x/t*100,1) for x in arr]
    ind={}
    for nm,a in acc.items():
        if a["amt"]<=0 or a["cnt"]<=0: continue
        ind[nm]={
            "amt":round(a["amt"]),
            "cnt":round(a["cnt"]),
            "unit":round(a["amt"]/a["cnt"]),            # 실측 객단가(원)
            "tmzon":pct(a["tmz"]), "dow":pct(a["dow"]),
            "gender":pct([a["ml"],a["fml"]]), "age":pct(a["age"]),
        }
    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "ind":dict(sorted(ind.items(), key=lambda x:-x[1]["amt"]))}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    top=list(out["ind"].items())[:3]
    print("저장:", OUT, "· 업종", len(ind), "개")
    print("매출 상위:", [(k, round(v["amt"]/1e8), "억", "객단가", v["unit"], "원") for k,v in top])
    return 0

if __name__ == "__main__":
    sys.exit(main())
