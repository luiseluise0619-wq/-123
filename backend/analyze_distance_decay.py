#!/usr/bin/env python3
"""
지하철역까지의 거리와 상권 점포당 매출의 관계(거리-감쇠) 분석.

입력: seoul_trdar_dataset.csv (build_seoul_dataset.py 산출)
  - 상권 좌표 XCNTS_VALUE, YDNTS_VALUE (EPSG:5181)
  - 업종 SVC_INDUTY_CD_NM, 매출 THSMON_SELNG_AMT(또는 slice_selng_amt), 점포수 STOR_CO
역 좌표: 서울 역사마스터(subwayStationMaster) API (SEOUL_API_KEY) — collect_subway와 동일.

계산:
  1) 상권 좌표를 EPSG:5181 → WGS84로 변환(make_map.py와 동일 방식).
  2) 각 상권에서 가장 가까운 역까지 직선거리(하버사인, m).
  3) 100m 구간마다 업종별 '점포당 매출' 중위값 → 가장 가까운 구간=100 상대지수.
  4) 80 아래로 떨어진 뒤 회복하지 않는 첫 구간을 '꺾이는 지점'으로 표기.

출력: frontend/distance_decay.json
  { available, quarter, note, limits, ind:{업종:{curve:[{d,idx,n}], knee_m}} }

정직 한계(출력에 그대로 포함):
  - 역 근처는 임대료·유동인구도 높다 → '거리 효과'만 분리 못함.
    "역에서 멀면 매출↓"가 아니라 "역에서 먼 상권의 점포당 매출 중위값이 낮게 관측"까지만.
  - 상권 좌표는 대표점 1개(상권 크기만큼 오차), 직선거리(실제 도보는 더 김).
  → 단정 금지. 곡선을 그대로 보여주고 사용자가 읽게 한다.

    export SEOUL_API_KEY=...
    python build_seoul_dataset.py
    python analyze_distance_decay.py --csv app/data/real_data/seoul_trdar_dataset.csv
"""
import os, sys, csv, json, math, argparse, datetime, statistics, urllib.request, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "distance_decay.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
BASE = "http://openapi.seoul.go.kr:8088"

def fnum(x):
    try: return float(str(x).replace(",",""))
    except: return 0.0

def haversine(lat1, lon1, lat2, lon2):
    R=6371000.0; p=math.pi/180
    a=(math.sin((lat2-lat1)*p/2)**2 +
       math.cos(lat1*p)*math.cos(lat2*p)*math.sin((lon2-lon1)*p/2)**2)
    return 2*R*math.asin(math.sqrt(a))

def fetch(service, s, e):
    url=f"{BASE}/{urllib.parse.quote(KEY)}/xml/{service}/{s}/{e}/"
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent":"sk"}), timeout=45) as r:
        return r.read().decode("utf-8")

def stations():
    rt=ET.fromstring(fetch("subwayStationMaster",1,1))
    total=int(rt.findtext(".//list_total_count") or 0); out=[]
    for s in range(1,total+1,1000):
        for row in ET.fromstring(fetch("subwayStationMaster",s,min(s+999,total))).findall(".//row"):
            lat=fnum(row.findtext("LAT")); lon=fnum(row.findtext("LOT"))
            if lat and lon: out.append((lat,lon))
    return out

def to_wgs84(xs, ys):
    from pyproj import Transformer
    tf=Transformer.from_crs("EPSG:5181","EPSG:4326",always_xy=True)
    lon,lat=tf.transform(xs, ys)
    return lat, lon

def col(row, *names):
    for n in names:
        if n in row: return row[n]
    low={k.lower():v for k,v in row.items()}
    for n in names:
        if n.lower() in low: return low[n.lower()]
    return None

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    a=ap.parse_args()
    if not KEY:
        print("SEOUL_API_KEY 없음 — 역 좌표 수집 불가."); return 1
    rows=[]
    with open(a.csv, encoding="utf-8-sig") as fh:
        for r in csv.DictReader(fh): rows.append(r)
    if not rows: print("빈 CSV"); return 2
    q=max((col(r,"STDR_YYQU_CD") or "" for r in rows), default="")
    rows=[r for r in rows if (col(r,"STDR_YYQU_CD") or "")==q]
    print(f"최신 분기 {q} · {len(rows):,}행")

    xs=[fnum(col(r,"XCNTS_VALUE")) for r in rows]
    ys=[fnum(col(r,"YDNTS_VALUE")) for r in rows]
    lats,lons=to_wgs84(xs,ys)

    stn=stations(); print(f"역 {len(stn)}개")
    if not stn: print("역 좌표 0"); return 3

    # 상권별 최근접 역거리(같은 상권 여러 업종행이 반복 → 좌표 동일하니 상권코드로 캐시)
    dist_cache={}
    def nearest(lat,lon):
        best=1e18
        for slat,slon in stn:
            d=haversine(lat,lon,slat,slon)
            if d<best: best=d
        return best

    buckets={}  # ind -> {bin -> [점포당매출...]}
    for i,r in enumerate(rows):
        ind=col(r,"SVC_INDUTY_CD_NM");
        if not ind: continue
        sales=fnum(col(r,"THSMON_SELNG_AMT","slice_selng_amt","monthly_revenue_actual"))
        stco=fnum(col(r,"STOR_CO","stor_co"))
        if sales<=0 or stco<=0: continue
        tc=col(r,"TRDAR_CD") or i
        if tc in dist_cache: d=dist_cache[tc]
        else: d=dist_cache[tc]=nearest(lats[i],lons[i])
        b=int(d//100)*100
        buckets.setdefault(ind,{}).setdefault(b,[]).append(sales/stco)

    ind_out={}
    for ind,bins in buckets.items():
        pts=sorted(bins.items())
        pts=[(b,round(statistics.median(v)),len(v)) for b,v in pts if len(v)>=5]  # 표본 5+ 구간만
        if len(pts)<3: continue
        base=pts[0][1] or 1
        curve=[{"d":b,"idx":round(v/base*100),"n":n} for b,v,n in pts]
        knee=None
        for k in range(1,len(curve)):
            if curve[k]["idx"]<80 and all(c["idx"]<80 for c in curve[k:]):
                knee=curve[k]["d"]; break
        ind_out[ind]={"curve":curve,"knee_m":knee}
        print(f"  {ind}: 구간 {len(curve)}개" + (f" · {knee}m부터 꺾임" if knee else " · 뚜렷한 꺾임 없음"))

    if not ind_out:
        json.dump({"available":False,"reason":"유효 업종 곡선 0(표본 부족/컬럼 확인)","quarter":q,
                   "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d")},
                  open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
        return 4

    out={"available":True,"quarter":q,
         "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
         "note":"역까지 직선거리 100m 구간별 점포당 매출 중위값(가장 가까운 구간=100 상대지수).",
         "limits":["역 근처는 임대료·유동인구도 높아 '거리 효과'만 분리 못함 — 인과 아님(관측된 상관)",
                   "상권 좌표는 대표점 1개(상권 크기만큼 오차), 직선거리라 실제 도보는 더 김",
                   "'몇 m가 정답'으로 단정 말고 곡선을 그대로 읽을 것"],
         "ind":ind_out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print("저장:", OUT, "· 업종", len(ind_out))
    return 0

if __name__ == "__main__":
    sys.exit(main())
