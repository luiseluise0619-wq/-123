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

# 파일마다 컬럼명이 영문코드(stor 파일) 또는 한글(매출 파일)이라 둘 다 지원.
TMZ = [("tmzon_00_06_selng_amt","시간대_00~06_매출_금액"),("tmzon_06_11_selng_amt","시간대_06~11_매출_금액"),
       ("tmzon_11_14_selng_amt","시간대_11~14_매출_금액"),("tmzon_14_17_selng_amt","시간대_14~17_매출_금액"),
       ("tmzon_17_21_selng_amt","시간대_17~21_매출_금액"),("tmzon_21_24_selng_amt","시간대_21~24_매출_금액")]
DOW = [("mon_selng_amt","월요일_매출_금액"),("tues_selng_amt","화요일_매출_금액"),("wed_selng_amt","수요일_매출_금액"),
       ("thur_selng_amt","목요일_매출_금액"),("fri_selng_amt","금요일_매출_금액"),("sat_selng_amt","토요일_매출_금액"),
       ("sun_selng_amt","일요일_매출_금액")]
AGE = [("agrde_10_selng_amt","연령대_10_매출_금액"),("agrde_20_selng_amt","연령대_20_매출_금액"),
       ("agrde_30_selng_amt","연령대_30_매출_금액"),("agrde_40_selng_amt","연령대_40_매출_금액"),
       ("agrde_50_selng_amt","연령대_50_매출_금액"),("agrde_60_above_selng_amt","연령대_60_이상_매출_금액")]
def gv(low,*names):
    for n in names:
        if n in low: return low[n]
    return None

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
    return {"amt":0.0,"cnt":0.0,"tmz":[0.0]*6,"dow":[0.0]*7,"ml":0.0,"fml":0.0,"age":[0.0]*6,"perstore":[]}

def load_store_by_trdar(path):
    """점포-상권 CSV → (trdar_cd, 업종) → 점포수, 최신 분기."""
    fh=open_csv(path); r=csv.DictReader(fh); per={}
    for row in r:
        low={k.lower():v for k,v in row.items()}
        q=gv(low,"stdr_yyqu_cd","기준_년분기_코드"); tc=(gv(low,"trdar_cd","상권_코드") or "").strip()
        ind=gv(low,"svc_induty_cd_nm","서비스_업종_코드_명"); st=fnum(gv(low,"stor_co","점포_수","일반_점포_수"))
        if q and tc and ind: per.setdefault(q,{})[(tc,ind)]=st
    fh.close()
    if not per: return {},None
    q=max(per.keys()); return per[q],q

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sales", required=True)
    ap.add_argument("--stores", default="")   # 점포-상권 CSV(있으면 상권별 점포당 매출 분위 계산)
    a = ap.parse_args()
    tmap = load_map()
    if not tmap:
        print("상권→자치구 매핑 로드 실패:", MAPF); return 1
    print(f"매핑 {len(tmap):,}개 상권")

    store_by_trdar,sq = ({},None)
    if a.stores and os.path.exists(a.stores):
        store_by_trdar,sq = load_store_by_trdar(a.stores)
        print(f"점포-상권 {sq}: 상권×업종 {len(store_by_trdar):,}건")

    acc = {}   # quarter -> gu -> ind -> blank
    fh = open_csv(a.sales); r = csv.DictReader(fh); n = 0
    for row in r:
        low = {k.lower():v for k,v in row.items()}
        q = gv(low,"stdr_yyqu_cd","기준_년분기_코드")
        tc = (gv(low,"trdar_cd","상권_코드") or "").strip()
        g = tmap.get(tc)
        ind = gv(low,"svc_induty_cd_nm","서비스_업종_코드_명")
        if not (q and g and ind): continue
        e = acc.setdefault(q,{}).setdefault(g,{}).setdefault(ind, blank())
        amt = fnum(gv(low,"thsmon_selng_amt","당월_매출_금액"))
        e["amt"] += amt; e["cnt"] += fnum(gv(low,"thsmon_selng_co","당월_매출_건수"))
        for i,k in enumerate(TMZ): e["tmz"][i] += fnum(gv(low,*k))
        for i,k in enumerate(DOW): e["dow"][i] += fnum(gv(low,*k))
        e["ml"] += fnum(gv(low,"ml_selng_amt","남성_매출_금액")); e["fml"] += fnum(gv(low,"fml_selng_amt","여성_매출_금액"))
        for i,k in enumerate(AGE): e["age"][i] += fnum(gv(low,*k))
        # 상권별 점포당 매출(만원) = 상권 매출 ÷ 상권 점포수 — 분위 계산용(평균이 아니라 분포)
        st = store_by_trdar.get((tc,ind),0)
        if st>0 and amt>0: e["perstore"].append(amt/10000/st)
        n += 1
    fh.close()
    if not acc:
        json.dump({"available":False,"reason":"매핑/컬럼 불일치로 집계 0","updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        print("집계 0"); return 2
    q = max(acc.keys()); guacc = acc[q]
    print(f"최신 분기 {q} · {n:,}행 처리")

    def pcts(arr):
        s = sum(arr) or 1
        return [round(v/s*100,1) for v in arr]
    def quart(vals):
        vs=sorted(vals)
        if len(vs)>=4:
            import statistics as st
            p=st.quantiles(vs,n=4)  # [p25,p50,p75]
            return [round(p[0]),round(p[1]),round(p[2])]
        if vs: m=round(vs[len(vs)//2]); return [m,m,m]
        return None

    gu = {}
    for g,inds in guacc.items():
        gu[g] = {}
        for ind,e in inds.items():
            gu[g][ind] = {
                "amt_man": round(e["amt"]/10000), "cnt": round(e["cnt"]),
                "unit": round(e["amt"]/e["cnt"]) if e["cnt"] else 0,   # 객단가(원) — robust
                "perstore_q": quart(e["perstore"]),   # [하위25,중위,상위25] 상권별 점포당 월매출(만원)
                "n_trdar": len(e["perstore"]),
                "tmz": pcts(e["tmz"]), "dow": pcts(e["dow"]),
                "ml": round(e["ml"]/((e["ml"]+e["fml"]) or 1)*100),
                "fml": round(e["fml"]/((e["ml"]+e["fml"]) or 1)*100),
                "age": pcts(e["age"]),
            }
    out = {"available":True, "quarter":q,
           "unit_note":"amt_man=만원, unit=객단가(원), perstore_q=상권별 점포당 월매출 [하위25/중위/상위25] 만원",
           "caveat":"추정매출은 과대추정 경향(카드사 귀속·본사매출). 점포당은 상권별 분위(평균 아님)로 완화.",
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "source":"서울 상권분석(추정매출-상권+점포-상권) 로컬 처리 + 영역-상권 매핑", "gu":gu}
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    tot = sum(v["amt_man"] for d in gu.values() for v in d.values())
    print(f"저장: {OUT} · 자치구 {len(gu)} · 총매출 {tot:,}만원")
    return 0

if __name__ == "__main__":
    sys.exit(main())
