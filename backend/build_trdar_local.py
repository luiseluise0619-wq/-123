#!/usr/bin/env python3
"""
공공데이터포털에서 내려받은 서울 상권분석 CSV(로컬 파일)를 처리해
자치구×업종 점포 데이터(경쟁강도 계산용)를 만든다.

샌드박스 외부망이 막혀 API로 못 받으므로, 사용자가 직접 내려받은 CSV를 처리한다.

필요 파일(공공데이터포털):
  --stores  서울시 상권분석서비스(점포-상권)_YYYY년.csv  (CP949)
             컬럼: stdr_yyqu_cd, trdar_cd, svc_induty_cd_nm, stor_co, clsbiz_rt, clsbiz_stor_co, frc_stor_co ...
  --area    서울시 상권분석서비스(영역-상권).csv          (상권→좌표/행정동, 자치구 매핑용)
             (없으면 상권 단위까지만, 자치구 매핑 불가)

출력: frontend/store_gu_ind.json
  { available, quarter, gu:{ '강남구':{ ind:{업종:{stores,closed,fr}}, total } } }

    python build_trdar_local.py --stores 점포.csv --area 영역.csv
"""
import os, sys, csv, json, glob, datetime, argparse

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "store_gu_ind.json")
GEOJSON = os.path.join(ROOT, "frontend", "seoul_gu.geojson")

def fnum(x):
    try: return float(str(x).replace(",",""))
    except: return 0.0

def read_csv_any(path):
    for enc in ("cp949","utf-8-sig","euc-kr","utf-8"):
        try:
            with open(path, encoding=enc) as fh:
                return list(csv.DictReader(fh))
        except Exception:
            continue
    raise RuntimeError("인코딩 판별 실패: "+path)

def area_to_gu(area_rows):
    """trdar_cd -> (자치구명, 행정동명). 영역-상권에 SIGNGU_CD_NM이 직접 있어 좌표 불필요."""
    m = {}
    for row in area_rows:
        low = {k.lower():v for k,v in row.items()}
        code = (low.get("trdar_cd") or low.get("상권_코드") or "").strip()
        gu = (low.get("signgu_cd_nm") or low.get("자치구_코드_명") or "").strip()
        dong = (low.get("adstrd_cd_nm") or low.get("행정동_코드_명") or "").strip()
        if code and gu: m[code] = (gu, dong)
    return m

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stores", required=True)
    ap.add_argument("--area", default="")
    a = ap.parse_args()

    srows = read_csv_any(a.stores)
    srows = [{k.lower():v for k,v in r.items()} for r in srows]
    q = max(r["stdr_yyqu_cd"] for r in srows)          # 최신 분기
    srows = [r for r in srows if r["stdr_yyqu_cd"] == q]
    print(f"점포-상권 최신 분기 {q} · {len(srows):,}행")

    gus = load_gu_rings()
    trdar_gu = {}
    if a.area and os.path.exists(a.area):
        arows = read_csv_any(a.area)
        trdar_gu = area_to_gu(arows, gus)
        print(f"영역-상권 매핑: 상권 {len(trdar_gu):,}개 → 자치구")
    else:
        print("⚠ 영역-상권 파일 없음 — 자치구 매핑 불가(영역-상권 CSV를 --area로 주세요).")
        json.dump({"available":False,"reason":"영역-상권 파일 필요(상권→자치구 매핑)","quarter":q,
                   "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        return 1

    gu = {}
    for r in srows:
        g = trdar_gu.get(r.get("trdar_cd"))
        if not g: continue
        ind = r.get("svc_induty_cd_nm");
        if not ind: continue
        d = gu.setdefault(g, {"ind":{}, "total":0})
        e = d["ind"].setdefault(ind, {"stores":0,"closed":0,"fr":0})
        st = int(fnum(r.get("stor_co")))
        e["stores"] += st; e["closed"] += int(fnum(r.get("clsbiz_stor_co")))
        e["fr"] += int(fnum(r.get("frc_stor_co"))); d["total"] += st

    if not gu:
        json.dump({"available":False,"reason":"상권→자치구 매핑 결과 0(좌표계/컬럼 확인)","quarter":q,
                   "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        print("매핑 0 — 좌표/컬럼 확인 필요"); return 2

    out = {"available":True, "quarter":q, "source":"서울 상권분석(점포-상권)+영역-상권 로컬 처리",
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"), "gu":gu}
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    tot=sum(d["total"] for d in gu.values())
    print(f"저장: {OUT} · 자치구 {len(gu)} · 총 점포 {tot:,}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
