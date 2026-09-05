#!/usr/bin/env python3
"""
서울 지하철 역별 승하차(CardSubwayStatsNew) + 역사마스터 좌표(subwayStationMaster)
 → 자치구별 지하철 승하차 인원(접근성 지표).

정류소 '개수'보다 강한 접근성 신호. 역 좌표를 seoul_gu.geojson 경계에 점-in-폴리곤으로
넣어 자치구로 귀속시키고, 최근 평일 하루 승차+하차를 자치구별로 합산.

키: SEOUL_API_KEY (다른 서울 수집기와 동일 키).
정직: 키 없거나 매핑/데이터 0이면 available:false. 지어낸 0 금지. 외부망은 Action에서만.

출력: frontend/subway_gu.json
  { available, date, mapped, gu:{ '강남구':{stations,on,off,total}, ... } }

    SEOUL_API_KEY=... python collect_subway.py
    python collect_subway.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import mark_unavailable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "subway_gu.json")
STATIONS_OUT = os.path.join(ROOT, "frontend", "subway_stations.json")
GEOJSON = os.path.join(ROOT, "frontend", "seoul_gu.geojson")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
BASE = "http://openapi.seoul.go.kr:8088"

def fnum(x):
    try: return float(x)
    except: return 0.0

def fetch(service, start, end, *segs):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{service}/{start}/{end}/"
    if segs: url += "/".join(str(s) for s in segs) + "/"
    req = urllib.request.Request(url, headers={"User-Agent":"sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")

def station_master():
    """역명 → (lon, lat). 페이징."""
    coords = {}
    rt = ET.fromstring(fetch("subwayStationMaster", 1, 1))
    total = int(rt.findtext(".//list_total_count") or 0)
    for s in range(1, total+1, 1000):
        e = min(s+999, total)
        for attempt in range(4):
            try: xml = fetch("subwayStationMaster", s, e); break
            except Exception:
                if attempt == 3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            nm = (row.findtext("BLDN_NM") or "").strip()
            lat = fnum(row.findtext("LAT")); lon = fnum(row.findtext("LOT"))
            if nm and lat and lon: coords.setdefault(nm, (lon, lat))
        time.sleep(0.1)
    return coords

def pip(x, y, ring):
    inside = False; n = len(ring); j = n-1
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi):
            inside = not inside
        j = i
    return inside

def gu_of(lon, lat, gus):
    for name, rings in gus.items():
        for ring in rings:
            if pip(lon, lat, ring): return name
    return None

def latest_date():
    """최근 평일부터 역순으로 데이터 있는 날 탐색(갱신은 3일 지연)."""
    d = datetime.date.today() - datetime.timedelta(days=3)
    for _ in range(12):
        if d.weekday() < 5:  # 평일 우선
            yield d.strftime("%Y%m%d")
        d -= datetime.timedelta(days=1)

def write_unavailable(reason):
    # 일시적 실패(키 만료·API 장애)로 멀쩡한 데이터를 지우지 않는다 — collect_util 참조.
    mark_unavailable(OUT, reason)


def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv: write_unavailable("SEOUL_API_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print("SEOUL_API_KEY 존재 — 수집 가능"); return 0

    # 자치구 경계 로드
    try:
        gj = json.load(open(GEOJSON, encoding="utf-8"))
    except Exception as e:
        write_unavailable(f"seoul_gu.geojson 로드 실패: {e}"); return 2
    gus = {}
    for f in gj["features"]:
        name = f["properties"].get("name")
        geom = f["geometry"]
        rings = [p[0] for p in geom["coordinates"]] if geom["type"] == "MultiPolygon" else [geom["coordinates"][0]]
        gus[name] = rings

    coords = station_master()
    print(f"역사마스터 {len(coords)}개 역 좌표")

    # 승하차: 데이터 있는 최근 날짜 하나
    use_ymd = None; rows = []
    for ymd in latest_date():
        try:
            rt = ET.fromstring(fetch("CardSubwayStatsNew", 1, 1, ymd))
            if rt.findtext(".//RESULT/CODE") == "INFO-000" and int(rt.findtext(".//list_total_count") or 0) > 0:
                use_ymd = ymd; break
        except Exception: continue
    if not use_ymd:
        write_unavailable("최근 승하차 데이터 날짜 탐색 실패"); return 3

    total = int(ET.fromstring(fetch("CardSubwayStatsNew", 1, 1, use_ymd)).findtext(".//list_total_count") or 0)
    for s in range(1, total+1, 1000):
        e = min(s+999, total)
        for attempt in range(4):
            try: xml = fetch("CardSubwayStatsNew", s, e, use_ymd); break
            except Exception:
                if attempt == 3: raise
                time.sleep(2*(attempt+1))
        for row in ET.fromstring(xml).findall(".//row"):
            rows.append((
                (row.findtext("SBWY_STNS_NM") or "").strip(),
                fnum(row.findtext("GTON_TNOPE")), fnum(row.findtext("GTOFF_TNOPE"))))
        time.sleep(0.1)

    acc = {}; mapped = 0; st_acc = {}
    for nm, on, off in rows:
        c = coords.get(nm)
        if not c: continue
        g = gu_of(c[0], c[1], gus)
        if not g: continue
        mapped += 1
        a = acc.setdefault(g, {"stations":0, "on":0.0, "off":0.0})
        a["stations"] += 1; a["on"] += on; a["off"] += off
        # 역 단위(고해상도 SVG 오버레이용): 같은 역명은 노선 합산
        s = st_acc.setdefault(nm, {"lon":c[0], "lat":c[1], "gu":g, "on":0.0, "off":0.0})
        s["on"] += on; s["off"] += off

    # 정직 가드: 매핑된 역이 없으면 실패.
    if mapped == 0 or not acc:
        write_unavailable("역→자치구 매핑 0 — 역명 불일치/좌표/경계 문제 가능")
        return 4

    gu_out = {g: {"stations":v["stations"], "on":round(v["on"]), "off":round(v["off"]),
                  "total":round(v["on"]+v["off"])} for g, v in acc.items()}
    out = {"available":True, "date":use_ymd,
           "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
           "mapped_stations":mapped,
           "note":"최근 평일 하루 승차+하차 합. 역 좌표를 자치구 경계에 귀속.",
           "gu":gu_out}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · {use_ymd} · 매핑역 {mapped} · 자치구 {len(gu_out)}")

    # 역 단위 산출물(SVG 오버레이용). 자치구 롤업 이전의 실측을 그대로 보존.
    st_list = [{"nm":nm, "lon":round(v["lon"],6), "lat":round(v["lat"],6), "gu":v["gu"],
                "on":round(v["on"]), "off":round(v["off"]), "total":round(v["on"]+v["off"])}
               for nm, v in st_acc.items()]
    st_list.sort(key=lambda r: r["total"], reverse=True)
    st_out = {"available":True, "date":use_ymd,
              "updated":datetime.datetime.utcnow().strftime("%Y-%m-%d"),
              "n_stations":len(st_list),
              "note":"역별 최근 평일 하루 승차+하차(같은 역명은 노선 합산). "
                     "좌표는 역사마스터 WGS84. 프론트의 검증된 project(lon,lat)로 지도에 투영.",
              "stations":st_list}
    json.dump(st_out, open(STATIONS_OUT,"w",encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {STATIONS_OUT} · 역 {len(st_list)}개")
    return 0

if __name__ == "__main__":
    sys.exit(main())
