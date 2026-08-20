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
# build_seoul_dataset.py --build 가 만드는 API 원천(점포 STOR_CO 포함, 최신 분기).
DEFAULT_CSV  = os.path.join(HERE, "app", "data", "real_data", "seoul_trdar_dataset.csv")
# 상권→자치구 매핑(trdar_cd,signgu_cd_nm,adstrd_cd_nm) — area_to_gu 가 읽는 컬럼과 동일.
DEFAULT_AREA = os.path.join(HERE, "trdar_signgu.csv")

def fnum(x):
    try: return float(str(x).replace(",",""))
    except: return 0.0

def read_csv_any(path):
    # utf-8(heavy CSV) 우선. 헤더가 ASCII라 cp949로도 '성공'해 한글이 깨지므로
    # 전체를 강제 디코드(list())해 잘못된 인코딩은 예외로 걸러낸다.
    for enc in ("utf-8-sig","utf-8","cp949","euc-kr"):
        try:
            with open(path, encoding=enc) as fh:
                return list(csv.DictReader(fh))
        except (UnicodeDecodeError, LookupError):
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
    ap.add_argument("--stores", default=DEFAULT_CSV,   # 기본: heavy 원천(최신 분기)
                    help="점포-상권 CSV(기본: seoul_trdar_dataset.csv)")
    ap.add_argument("--area", default=DEFAULT_AREA,    # 기본: trdar_signgu.csv 매핑
                    help="상권→자치구 매핑 CSV(기본: trdar_signgu.csv)")
    a = ap.parse_args()
    if not os.path.exists(a.stores):
        json.dump({"available": False, "reason": f"점포 CSV 없음: {a.stores} (build_seoul_dataset.py --build 먼저)",
                   "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
        print("점포 CSV 없음:", a.stores); return 1

    srows = read_csv_any(a.stores)
    srows = [{k.lower():v for k,v in r.items()} for r in srows]
    # 컬럼 존재 가드 — 없으면 KeyError로 죽거나 조용히 0이 되므로 명확히 실패시킴
    cols = set(srows[0].keys()) if srows else set()
    miss = [c for c in ("stdr_yyqu_cd","trdar_cd","svc_induty_cd_nm","stor_co") if c not in cols]
    if not srows or miss:
        json.dump({"available":False,"reason":f"필수 컬럼 없음: {miss or '빈 파일'} (있는 컬럼 {sorted(cols)[:15]})",
                   "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        print("필수 컬럼 없음:", miss); return 1
    q = max(r["stdr_yyqu_cd"] for r in srows)          # 최신 분기
    srows = [r for r in srows if r["stdr_yyqu_cd"] == q]
    print(f"점포-상권 최신 분기 {q} · {len(srows):,}행")

    trdar_gu = {}
    if a.area and os.path.exists(a.area):
        arows = read_csv_any(a.area)
        trdar_gu = area_to_gu(arows)              # {trdar_cd: (자치구, 행정동)}
        print(f"영역-상권 매핑: 상권 {len(trdar_gu):,}개 → 자치구")
    else:
        print("⚠ 영역-상권 파일 없음 — 자치구 매핑 불가(영역-상권 CSV를 --area로 주세요).")
        json.dump({"available":False,"reason":"영역-상권 파일 필요(상권→자치구 매핑)","quarter":q,
                   "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        return 1

    gu = {}
    for r in srows:
        gd = trdar_gu.get(r.get("trdar_cd"))
        if not gd: continue
        g = gd[0]
        ind = r.get("svc_induty_cd_nm");
        if not ind: continue
        d = gu.setdefault(g, {"ind":{}, "total":0})
        e = d["ind"].setdefault(ind, {"stores":0,"closed":0,"fr":0})
        # stor_co=일반(비프랜차이즈) 점포수, frc_stor_co=프랜차이즈 점포수(서로 배타). 총점포=stores+fr.
        st = int(fnum(r.get("stor_co"))); frc = int(fnum(r.get("frc_stor_co")))
        e["stores"] += st; e["closed"] += int(fnum(r.get("clsbiz_stor_co")))
        e["fr"] += frc; d["total"] += st + frc

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
