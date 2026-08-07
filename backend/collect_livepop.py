#!/usr/bin/env python3
"""
서울 생활인구(유동인구) 수집기 → 자치구별 집계.

데이터: 서울 열린데이터광장 '집계구 단위 서울 생활인구(내국인)' ppsLocalResd
  - 집계구별·시간대별 총생활인구 + 연령/성별 세분
  - 행정동코드(ADSTRD_CODE_SE) 앞 5자리 = 자치구 코드 → 자치구로 집계

지어냄 없음: SEOUL_API_KEY 없으면 아무것도 쓰지 않고 종료(정직).
샌드박스에선 외부망이 막혀 실행 불가 — GitHub Action(러너)에서 실행됨.

출력: frontend/livepop_gu.json
  { quarter, hour, updated, gu:{ 강남구:{tot, m, f, a10..a60, ...}, ... } }

    python collect_livepop.py            # 수집·집계·저장
    python collect_livepop.py --check    # 키 존재만 확인
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "livepop_gu.json")

KEY = os.environ.get("SEOUL_API_KEY", "").strip()
SERVICE = "ppsLocalResd"
HOUR = os.environ.get("LIVEPOP_HOUR", "14")   # 대표 시간대(오후 2시). 유동인구 스냅샷.
BASE = "http://openapi.seoul.go.kr:8088"

# 자치구 코드(행정동코드 앞 5자리) → 자치구명. 지리 상수.
GU = {
 "11110":"종로구","11140":"중구","11170":"용산구","11200":"성동구","11215":"광진구",
 "11230":"동대문구","11260":"중랑구","11290":"성북구","11305":"강북구","11320":"도봉구",
 "11350":"노원구","11380":"은평구","11410":"서대문구","11440":"마포구","11470":"양천구",
 "11500":"강서구","11530":"구로구","11545":"금천구","11560":"영등포구","11590":"동작구",
 "11620":"관악구","11650":"서초구","11680":"강남구","11710":"송파구","11740":"강동구",
}
# 연령 버킷 합산용 접미(남/여 공통). 10대=0~19, 20대=20~24+25~29 ...
AGE = {
 "a10":["F0T9","F10T14","F15T19"], "a20":["F20T24","F25T29"],
 "a30":["F30T34","F35T39"], "a40":["F40T44","F45T49"],
 "a50":["F50T54","F55T59"], "a60":["F60T64","F65T69","F70T74"],
}

def fnum(x):
    try: return float(x)
    except: return 0.0   # '*'(비식별) 은 0 처리

def fetch(start, end, hour):
    # 경로형 옵션: /KEY/xml/SERVICE/START/END/TMZON_PD_SE
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/{hour}/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read().decode("utf-8")

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직). Action Secrets 에 등록 필요.")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    # 1차 호출로 총건수 파악
    first = fetch(1, 1, HOUR)
    root = ET.fromstring(first)
    code = root.findtext(".//RESULT/CODE") or "?"
    if code not in ("INFO-000",):
        print("API 오류:", code, root.findtext(".//RESULT/MESSAGE")); return 2
    total = int(root.findtext(".//list_total_count") or "0")
    print(f"총 {total:,}행 (시간대 {HOUR}시)")

    acc = {g: {"tot":0.0,"m":0.0,"f":0.0,"a10":0.0,"a20":0.0,"a30":0.0,"a40":0.0,"a50":0.0,"a60":0.0,"cells":0}
           for g in GU.values()}
    stdr = None
    step = 1000
    for s in range(1, total+1, step):
        e = min(s+step-1, total)
        for attempt in range(4):
            try:
                xml = fetch(s, e, HOUR); break
            except Exception as ex:
                if attempt==3: raise
                time.sleep(2*(attempt+1))
        rt = ET.fromstring(xml)
        for row in rt.findall(".//row"):
            adstrd = (row.findtext("ADSTRD_CODE_SE") or "")[:5]
            g = GU.get(adstrd)
            if not g: continue
            if stdr is None: stdr = row.findtext("STDR_DE_ID")
            tot = fnum(row.findtext("TOT_LVPOP_CO"))
            a = acc[g]; a["tot"]+=tot; a["cells"]+=1
            for pref in ("MALE","FEMALE"):
                for suf_list_key,sufs in AGE.items():
                    for suf in sufs:
                        v = fnum(row.findtext(f"{pref}_{suf}_LVPOP_CO"))
                        a[suf_list_key]+=v
                        a["m" if pref=="MALE" else "f"]+=v
        print(f"  {s:,}~{e:,} 처리")
        time.sleep(0.2)

    out = {
        "service": SERVICE, "hour": HOUR, "stdr_date": stdr,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "gu": {g:{k:round(v,1) for k,v in a.items()} for g,a in acc.items()},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    top = sorted(out["gu"].items(), key=lambda x:-x[1]["tot"])[:3]
    print("저장:", OUT)
    print("유동인구 상위:", [(g, int(d["tot"])) for g,d in top])
    return 0

if __name__ == "__main__":
    sys.exit(main())
