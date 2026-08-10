#!/usr/bin/env python3
"""
서울 상권분석 추정매출-상권 CSV(로컬) + 상권→자치구 매핑 → 자치구×업종 매출.

표준단위구역(2024~)은 상권이 겹치지 않으므로 자치구 내 상권 매출 합산이 정당(인구와 달리 과다집계 아님).
점포수(store_gu_ind.json)가 있으면 점포당 매출도 계산.

입력:
  --sales  서울시 상권분석서비스(추정매출-상권)_YYYY년.csv  (CP949)
           컬럼: stdr_yyqu_cd, trdar_cd, svc_induty_cd_nm, thsmon_selng_amt(원), thsmon_selng_co(건),
                 tmzon_*_selng_amt, mon..sun_selng_amt, ml/fml_selng_amt, agrde_*_selng_amt
  --map    backend/trdar_signgu.csv (기본값 — 영역-상권 매핑)

출력: frontend/sales_gu_ind.json
  { available, quarter, gu:{ 자치구:{ ind:{업종:{amt_man, cnt, unit, per_store_man,
      tmz:[6]%, dow:[7]%, ml%, fml%, age:[6]%}} } } }

    python build_sales_local.py --sales 추정매출.csv
"""
import os, sys, csv, json, datetime, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "sales_gu_ind.json")
MAPF = os.path.join(HERE, "trdar_signgu.csv")
STORE = os.path.join(ROOT, "frontend", "store_gu_ind.json")

TMZ = ["tmzon_00_06_selng_amt","tmzon_06_11_selng_amt","tmzon_11_14_selng_amt",
       "tmzon_14_17_selng_amt","tmzon_17_21_selng_amt","tmzon_21_24_selng_amt"]
DOW = ["mon_selng_amt","tues_selng_amt","wed_selng_amt","thur_selng_amt","fri_selng_amt","sat_selng_amt","sun_selng_amt"]
AGE = ["agrde_10_selng_amt","agrde_20_selng_amt","agrde_30_selng_amt","agrde_40_selng_amt","agrde_50_selng_amt","agrde_60_above_selng_amt"]

def fnum(x):
    try: return float(str(x).replace(",",""))
    except: return 0.0

def load_map():
    m = {}
    for enc in ("utf-8-sig","cp949","utf-8"):
        try:
            with open(MAPF, encoding=enc) as fh:
                for r in csv.DictReader(fh):
                    low = {k.lower().lstrip("﻿"):v for k,v in r.items()}
                    c = (low.get("trdar_cd") or "").strip()
                    g = (low.get("signgu_cd_nm") or "").strip()
                    if c and g: m[c] = g
            if m: return m
        except Exception: continue
    return m

def open_csv(path):
    for enc in ("cp949","utf-8-sig","euc-kr","utf-8"):
        try:
            fh = open(path, encoding=enc)
            fh.readline(); fh.seek(0)
            return fh
        except Exception: continue
    raise RuntimeError("인코딩 판별 실패")

def blank():
    return {"amt":0.0,"cnt":0.0,"tmz":[0.0]*6,"dow":[0.0]*7,"ml":0.0,"fml":0.0,"age":[0.0]*6}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sales", required=True)
    a = ap.parse_args()
    tmap = load_map()
    if not tmap:
        print("상권→자치구 매핑 로드 실패:", MAPF); return 1
    print(f"매핑 {len(tmap):,}개 상권")

    # 분기별 누적(메모리 작음: 4분기 × 25구 × 100업종)
    acc = {}   # quarter -> gu -> ind -> blank
    fh = open_csv(a.sales); r = csv.DictReader(fh); n = 0
    for row in r:
        low = {k.lower():v for k,v in row.items()}
        q = low.get("stdr_yyqu_cd"); g = tmap.get((low.get("trdar_cd") or "").strip())
        ind = low.get("svc_induty_cd_nm")
        if not (q and g and ind): continue
        e = acc.setdefault(q,{}).setdefault(g,{}).setdefault(ind, blank())
        e["amt"] += fnum(low.get("thsmon_selng_amt")); e["cnt"] += fnum(low.get("thsmon_selng_co"))
        for i,k in enumerate(TMZ): e["tmz"][i] += fnum(low.get(k))
        for i,k in enumerate(DOW): e["dow"][i] += fnum(low.get(k))
        e["ml"] += fnum(low.get("ml_selng_amt")); e["fml"] += fnum(low.get("fml_selng_amt"))
        for i,k in enumerate(AGE): e["age"][i] += fnum(low.get(k))
        n += 1
    fh.close()
    if not acc:
        json.dump({"available":False,"reason":"매핑/컬럼 불일치로 집계 0","updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        print("집계 0"); return 2
    q = max(acc.keys()); guacc = acc[q]
    print(f"최신 분기 {q} · {n:,}행 처리")

    stores = {}
    if os.path.exists(STORE):
        sd = json.load(open(STORE, encoding="utf-8"))
        if sd.get("available"):
            for gg,dd in sd.get("gu",{}).items():
                for ind,v in dd.get("ind",{}).items():
                    stores[(gg,ind)] = v.get("stores",0)

    def pcts(arr):
        s = sum(arr) or 1
        return [round(v/s*100,1) for v in arr]

    gu = {}
    for g,inds in guacc.items():
        gu[g] = {}
        for ind,e in inds.items():
            amt_man = round(e["amt"]/10000)          # 원 → 만원
            cnt = round(e["cnt"])
            unit = round(e["amt"]/e["cnt"]) if e["cnt"] else 0   # 객단가(원)
            st = stores.get((g,ind),0)
            gu[g][ind] = {
                "amt_man": amt_man, "cnt": cnt, "unit": unit,
                "per_store_man": round(amt_man/st) if st else None,
                "tmz": pcts(e["tmz"]), "dow": pcts(e["dow"]),
                "ml": round(e["ml"]/((e["ml"]+e["fml"]) or 1)*100),
                "fml": round(e["fml"]/((e["ml"]+e["fml"]) or 1)*100),
                "age": pcts(e["age"]),
            }
    out = {"available":True, "quarter":q, "unit_note":"amt_man=만원, unit=객단가(원)",
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "source":"서울 상권분석(추정매출-상권) 로컬 처리 + 영역-상권 매핑", "gu":gu}
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    tot = sum(v["amt_man"] for d in gu.values() for v in d.values())
    print(f"저장: {OUT} · 자치구 {len(gu)} · 총매출 {tot:,}만원")
    return 0

if __name__ == "__main__":
    sys.exit(main())
