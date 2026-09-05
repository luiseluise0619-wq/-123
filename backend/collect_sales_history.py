#!/usr/bin/env python3
"""
추정매출 다분기 이력 수집 → 시계열 3종 (변화 탐지·예측용).

VwsmTrdarSelngQq 원천 1행 = (분기 × 상권 × 업종) 의 당월매출.
같은 원천을 **한 번만 내려받아 세 방향으로 합산**한다(API 콜 낭비 없음):

  1) 업종별(서울 전체)     → sales_history.json   … 업종 전체 추세·예측
  2) 상권별 총매출          → zone_history.json    … "이 상권에서 무슨 일이 일어났나"
  3) 자치구 × 업종          → zone_history.json    … 지역별 업종 전망

  ※ 2·3 이 없으면 "서울 전체 업종 추세"밖에 못 보여준다. 사용자가 알고 싶은 건
    자기가 볼 상권의 변화지 서울 평균이 아니다. 그래서 상권 축을 버리지 않는다.

증분 수집: 파일마다 이미 가진 분기를 따로 기억한다.
  (업종 이력은 이미 2021~ 전 분기를 갖고 있으므로, 상권 이력만 처음 1회 백필된다)

출력
  frontend/sales_history.json  { updated, quarters, ind:{ 업종:{분기:금액} } }
  frontend/zone_history.json   { updated, quarters, zone:{ 상권코드:[분기순 금액] },
                                 gu_ind:{ 자치구:{ 업종:[분기순 금액] } } }

    python collect_sales_history.py           # 증분 수집
    python collect_sales_history.py --check
"""
import os, sys, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import load_json

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "sales_history.json")
ZOUT = os.path.join(ROOT, "frontend", "zone_history.json")
INTEL = os.path.join(ROOT, "frontend", "zone_intel.json")
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

def quarter_total(qu, gu_of):
    """해당 분기를 1회 순회하며 (업종 / 상권 / 자치구×업종) 세 방향으로 합산.
    분기가 아직 없으면 None. gu_of = {상권코드: 자치구명} (zone_intel.json 에서)."""
    try:
        rt = ET.fromstring(fetch(1,1,qu))
    except Exception:
        return None
    if rt.findtext(".//RESULT/CODE") != "INFO-000":
        return None
    total = int(rt.findtext(".//list_total_count") or 0)
    if total == 0:
        return None
    agg={}; zagg={}; gagg={}; unmapped=set()
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
            if not nm: continue
            amt=fnum(row.findtext("THSMON_SELNG_AMT"))
            agg[nm]=agg.get(nm,0.0)+amt                      # 1) 업종 전체
            cd=(row.findtext("TRDAR_CD") or "").strip()
            if not cd: continue
            zagg[cd]=zagg.get(cd,0.0)+amt                    # 2) 상권 총매출
            gu=gu_of.get(cd)
            if gu: gagg.setdefault(gu,{})[nm]=gagg.setdefault(gu,{}).get(nm,0.0)+amt   # 3) 구×업종
            else: unmapped.add(cd)
        time.sleep(0.12)
    if unmapped:
        # 지어내지 않는다: 매핑 못 한 상권은 구 집계에서 빠졌다는 사실을 그대로 알린다.
        print(f"    (자치구 미매핑 상권 {len(unmapped)}개 — 구×업종 집계에서 제외)")
    return ({k:round(v) for k,v in agg.items()},
            {k:round(v) for k,v in zagg.items()},
            {g:{k:round(v) for k,v in d.items()} for g,d in gagg.items()})

def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직)."); return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    import json
    hist = load_json(OUT) or {"quarters":[], "ind":{}}
    have = set(hist.get("quarters", []))
    # 상권 이력은 분기별 dict 로 모았다가 마지막에 "분기 순서 배열"로 바꾼다(파일 크기 절감).
    zh = load_json(ZOUT) or {"quarters":[], "zone":{}, "gu_ind":{}}
    zq = list(zh.get("quarters", []))
    zbuf = {q: {} for q in zq}; gbuf = {q: {} for q in zq}
    for cd, arr in (zh.get("zone") or {}).items():
        for i, q in enumerate(zq):
            if i < len(arr) and arr[i]: zbuf[q][cd] = arr[i]
    for gu, inds in (zh.get("gu_ind") or {}).items():
        for nm, arr in inds.items():
            for i, q in enumerate(zq):
                if i < len(arr) and arr[i]: gbuf[q].setdefault(gu, {})[nm] = arr[i]

    # 상권코드 → 자치구 (build_zone_intel.py 산출물). 없으면 구×업종 집계만 생략된다.
    intel = load_json(INTEL) or {}
    gu_of = {cd: o.get("gu") for cd, o in (intel.get("zones") or {}).items() if o.get("gu")}
    if not gu_of:
        print("  ! zone_intel.json 없음 — 구×업종 집계 생략(build_zone_intel.py 를 먼저 실행).")

    added=[]
    for qu in all_quarters():
        # 업종 이력과 상권 이력을 따로 본다. 업종만 있는 옛 분기는 상권 백필 대상이다.
        if qu in have and qu in zq: continue
        got = quarter_total(qu, gu_of)
        if got is None:
            continue   # 아직 없는 미래 분기
        tot, ztot, gtot = got
        if qu not in have:
            for nm,v in tot.items():
                hist["ind"].setdefault(nm, {})[qu]=v
            have.add(qu)
        if qu not in zq:
            zq.append(qu); zbuf[qu]=ztot; gbuf[qu]=gtot
        added.append(qu)
        print(f"  분기 {qu} 수집 · 업종 {len(tot)} · 상권 {len(ztot)} · 자치구 {len(gtot)}")

    hist["quarters"]=sorted(have)
    hist["updated"]=datetime.datetime.utcnow().strftime("%Y-%m-%d")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(hist, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 분기수", len(hist["quarters"]), "· 신규", added or "없음")

    if zq:
        zq = sorted(zq)
        allz = sorted({cd for q in zq for cd in zbuf.get(q, {})})
        allg = sorted({g for q in zq for g in gbuf.get(q, {})})
        # 결측 분기는 0 이 아니라 null. 0 으로 채우면 "매출이 0이었다"는 거짓말이 된다.
        zout = {cd: [zbuf.get(q, {}).get(cd) for q in zq] for cd in allz}
        gout = {}
        for g in allg:
            names = sorted({nm for q in zq for nm in gbuf.get(q, {}).get(g, {})})
            gout[g] = {nm: [gbuf.get(q, {}).get(g, {}).get(nm) for q in zq] for nm in names}
        json.dump({"updated": hist["updated"], "quarters": zq,
                   "note": "상권 총매출·자치구×업종 매출의 분기 시계열(원). null=해당 분기 데이터 없음.",
                   "zone": zout, "gu_ind": gout},
                  open(ZOUT,"w",encoding="utf-8"), ensure_ascii=False, separators=(",",":"))
        print("저장:", ZOUT, f"· 분기 {len(zq)} · 상권 {len(allz)} · 자치구 {len(allg)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
