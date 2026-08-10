#!/usr/bin/env python3
"""
서울 상권분석 직장인구(VwsmTrdarWrcPopltnQq) → 서울 전체 직장인구 프로필.

상권별 직장인구(그 지역으로 '출근'하는 사람) + 성별/연령을 서울 전체로 집계.
상주인구가 '거기 사는 주민'이라면, 직장인구는 '거기로 일하러 오는 사람' = 점심·퇴근 수요.

중요(정직): 상권 영역이 서로 겹쳐서 '절대 인원 합계'는 과다 집계된다.
그래서 절대값은 참고로만 저장하고, 프론트는 성별·연령 '구성비(%)'만 쓴다(겹침에 강함).

출력: frontend/workpop.json
  { service, quarter, updated, available, tot, m, f, age:[10,20,30,40,50,60+] }
  - available=false 이면 (키 없음 또는 필드 불일치) 데이터 없음 — 지어내지 않음.

    python collect_workpop.py            # 수집·집계·저장
    python collect_workpop.py --check    # 키 존재 여부만
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "workpop.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarWrcPopltnQq"
BASE = "http://openapi.seoul.go.kr:8088"
AGE = ["AGRDE_10_WRC_POPLTN_CO","AGRDE_20_WRC_POPLTN_CO","AGRDE_30_WRC_POPLTN_CO",
       "AGRDE_40_WRC_POPLTN_CO","AGRDE_50_WRC_POPLTN_CO","AGRDE_60_ABOVE_WRC_POPLTN_CO"]

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

def write_unavailable(reason):
    out={"service":SERVICE,"available":False,"reason":reason,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("available=false 저장:", reason)

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

    acc={"tot":0.0,"m":0.0,"f":0.0,"age":[0.0]*6}
    step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            acc["tot"]+=fnum(row.findtext("TOT_WRC_POPLTN_CO"))
            acc["m"]  +=fnum(row.findtext("ML_WRC_POPLTN_CO"))
            acc["f"]  +=fnum(row.findtext("FML_WRC_POPLTN_CO"))
            for i,k in enumerate(AGE): acc["age"][i]+=fnum(row.findtext(k))
        if (s//step)%5==0 or e==total: print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.12)

    # 정직 가드: 필드명이 실제 스키마와 다르면 전부 0 → 지어낸 0을 내보내지 않는다.
    if acc["tot"]<=0:
        write_unavailable("응답 파싱 결과 총계 0 — 필드명/스키마 불일치 가능")
        return 3

    out={"service":SERVICE,"quarter":qu,"available":True,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "tot":round(acc["tot"]),"m":round(acc["m"]),"f":round(acc["f"]),
         "age":[round(v) for v in acc["age"]]}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 직장인구(과다집계 절대값, 참고)", out["tot"])
    return 0

if __name__ == "__main__":
    sys.exit(main())
