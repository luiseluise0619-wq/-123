#!/usr/bin/env python3
"""
서울 상권분석 소득소비(VwsmTrdarIncmCnsmpQq) → 서울 상권 평균 소득 + 소비 구성.

상권별 '월 평균 소득금액'과 '지출 카테고리별 금액'을 서울 전체로 요약.
- 소득: 상권 평균소득의 (단순)평균 → '서울 상권 평균 월소득' (평균이라 겹침에 강함)
- 소비: 카테고리 지출을 합산 후 '구성비(%)'로 정규화 → 어디에 돈을 쓰나 (비율이라 겹침에 강함)

정직: 지출 '절대 합계'는 상권 겹침으로 과다집계되므로 저장하지 않고 비율만 쓴다.
      SEOUL_API_KEY 없거나 필드 불일치(전부 0)면 available=false.

출력: frontend/income.json
  { service, quarter, updated, available, income_avg, spend:[{name,pct}, ...] }

    python collect_income.py           # 수집·집계·저장
    python collect_income.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "income.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarIncmCnsmpQq"
BASE = "http://openapi.seoul.go.kr:8088"
# 지출 카테고리(한글명, 서울 상권분석 표준 필드)
SPEND = [
    ("식료품",   "FDSTFFS_EXPNDTR_TOTAMT"),
    ("의류·신발", "CLTHS_FTWR_EXPNDTR_TOTAMT"),
    ("생활용품", "LVSPL_EXPNDTR_TOTAMT"),
    ("의료비",   "MCP_EXPNDTR_TOTAMT"),
    ("교통",     "TRNSPORT_EXPNDTR_TOTAMT"),
    ("여가",     "LSR_EXPNDTR_TOTAMT"),
    ("문화",     "CLTUR_EXPNDTR_TOTAMT"),
    ("교육",     "EDC_EXPNDTR_TOTAMT"),
    ("유흥",     "PLESR_EXPNDTR_TOTAMT"),
]

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

    inc_sum=0.0; inc_n=0
    spend=[0.0]*len(SPEND)
    step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            v=fnum(row.findtext("MT_AVRG_INCOME_AMT"))
            if v>0: inc_sum+=v; inc_n+=1
            for i,(_,k) in enumerate(SPEND): spend[i]+=fnum(row.findtext(k))
        if (s//step)%5==0 or e==total: print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.12)

    tot_spend=sum(spend)
    # 정직 가드: 소득·지출 둘 다 0이면 필드 불일치 → 지어낸 0 금지.
    if inc_n==0 and tot_spend<=0:
        write_unavailable("응답 파싱 결과 소득/지출 0 — 필드명/스키마 불일치 가능")
        return 3

    spend_out=[{"name":n,"pct":round(100*spend[i]/tot_spend,1) if tot_spend>0 else 0.0}
               for i,(n,_) in enumerate(SPEND)]
    out={"service":SERVICE,"quarter":qu,"available":True,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "income_avg":round(inc_sum/inc_n) if inc_n else None,
         "spend":spend_out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 평균 월소득", out["income_avg"], "· 지출 카테고리", len(spend_out))
    return 0

if __name__ == "__main__":
    sys.exit(main())
