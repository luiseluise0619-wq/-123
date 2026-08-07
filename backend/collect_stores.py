#!/usr/bin/env python3
"""
서울 상권분석 점포-상권(VwsmTrdarStorQq) → 업종별 점포수·개폐업률·프랜차이즈 집계.

데이터: 서울 열린데이터광장 '서울시 상권분석서비스(점포-상권)'
  상권별·업종별 점포수 + 개업률/폐업률 + 프랜차이즈 점포수
집계 단위: 업종(SVC_INDUTY_CD_NM) — 서울 전체, 상권→자치구 매핑 불필요.

산출(업종별):
  stores 전체 점포수, franchise 프랜차이즈 점포수, fr_share 프랜차이즈 비중(%)
  opened 개업, closed 폐업, open_rate 개업률(%), close_rate 폐업률(%)
  ※ 개폐업률은 점포수 가중(전체 개업/폐업 ÷ 전체 점포수) — 정직한 서울 전체값

지어냄 없음: SEOUL_API_KEY 없으면 생략. 최신 분기 자동 탐색.
출력: frontend/stores_by_industry.json

    python collect_stores.py            # 수집·집계·저장
    python collect_stores.py --check    # 키 존재만 확인
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import load_json, apply_quarter_diff, push_update

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "stores_by_industry.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "VwsmTrdarStorQq"
BASE = "http://openapi.seoul.go.kr:8088"

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

    acc={}
    step=1000
    for s in range(1, total+1, step):
        e=min(s+step-1, total)
        for attempt in range(4):
            try: xml=fetch(s,e,qu); break
            except Exception:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        rt=ET.fromstring(xml)
        for row in rt.findall(".//row"):
            nm=row.findtext("SVC_INDUTY_CD_NM")
            if not nm: continue
            a=acc.setdefault(nm, {"stores":0.0,"fr":0.0,"op":0.0,"cl":0.0})
            a["stores"]+=fnum(row.findtext("SIMILR_INDUTY_STOR_CO"))
            a["fr"]    +=fnum(row.findtext("FRC_STOR_CO"))
            a["op"]    +=fnum(row.findtext("OPBIZ_STOR_CO"))
            a["cl"]    +=fnum(row.findtext("CLSBIZ_STOR_CO"))
        if (s//step)%10==0 or e==total: print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.12)

    ind={}
    for nm,a in acc.items():
        st=a["stores"]
        if st<=0: continue
        ind[nm]={
            "stores":round(st), "franchise":round(a["fr"]),
            "fr_share":round(a["fr"]/st*100,1),
            "opened":round(a["op"]), "closed":round(a["cl"]),
            "open_rate":round(a["op"]/st*100,1),
            "close_rate":round(a["cl"]/st*100,1),
        }
    out={"service":SERVICE,"quarter":qu,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "ind":dict(sorted(ind.items(), key=lambda x:-x[1]["stores"]))}
    old=load_json(OUT)
    changes=apply_quarter_diff(old, out, ["close_rate","stores"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    risky=sorted(ind.items(), key=lambda x:-x[1]["close_rate"])[:3]
    print("저장:", OUT, "· 업종", len(ind), "개")
    print("폐업률 상위:", [(k, v["close_rate"], "%") for k,v in risky])
    if changes:
        big=[c for c in changes if c[1]>0][:3]   # 폐업률 상승 큰 업종
        note="폐업률 변화("+out.get("prev_quarter","")+"→"+qu+"): "+", ".join(
            f"{n} {'+' if d>=0 else ''}{round(d,1)}%p" for n,d,_,_ in big)
        push_update(ROOT, "점포·폐업", qu, note)
        print("변경 기록:", note)
    return 0

if __name__ == "__main__":
    sys.exit(main())
