#!/usr/bin/env python3
"""
지방행정인허가(LOCALDATA) → '내 가게 주변에 요즘 뭐가 열리고 닫혔나' (상권 1,564곳 × 반경 500m)

왜 필요한가
  지금 앱의 자료는 전부 '분기' 단위라 '요즘'이 없다. 창업하고 나서도 들어올 이유가 되려면
  '이번 달 내 반경 500m 에 새로 연 경쟁점 3곳 · 닫은 곳 1곳' 같은 **매주 바뀌는 숫자**가 필요하다.
  지방행정인허가 개방자료는 음식점·카페 등의 인허가(개업)·폐업이 **주소 단위로 매일** 올라온다.

어떻게 만드나
  ① LOCALDATA 오픈API 에서 최근 N일(기본 30일) 사이에 바뀐 행을 업종(서비스 ID)마다 받는다.
  ② 서울 주소만 남기고, 인허가일이 창 안이면 '열림', 폐업일이 창 안이면 '닫음'으로 분류한다.
  ③ 좌표(TM 중부원점)를 경위도로 바꾸고, zone_index.json 의 상권 좌표와 대조해
     반경 RADIUS_M(기본 500m) 안에 드는 상권마다 개수와 최근 항목 몇 개를 적는다.
  → 화면은 좌표 계산을 하나도 안 한다(런타임은 가볍게).

정직
  LOCALDATA_KEY 없으면 수집을 생략하고 available:false 로 둔다(지어내지 않는다).
  서비스 ID·필드명·좌표계는 문서에서 찾은 값이다. 이 작업 환경은 외부망이 막혀 있어
  **실제 응답으로 검증하지 못했다** → 환경변수로 전부 덮어쓸 수 있게 뒀고,
  좌표계는 변환 결과가 서울 안에 떨어지는지 스스로 확인해 둘(5174/2097) 중 맞는 쪽을 고른다.
  인허가·폐업 '신고 날짜'라 실제 개업일과 며칠 다를 수 있다 — 화면 안내문에 그대로 적을 것.

출력: frontend/data/v3/openings.json
  { available, source, updated, since, until, days, radius_m, svcs, epsg,
    n_records, n_open, n_close, note,
    zones:{ "<상권코드>": { o:열린 수, c:닫힌 수,
                          items:[[이름, 업태, "o"|"c", "YYYY-MM-DD", 거리m], ...최근 5개] } } }
  활동이 하나도 없는 상권은 zones 에 없다(빈 항목을 만들지 않는다).

    LOCALDATA_KEY=... python collect_openings.py
    python collect_openings.py --check
"""
import os, sys, json, math, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import mark_unavailable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "data", "v3", "openings.json")
ZIDX = os.path.join(ROOT, "frontend", "zone_index.json")

KEY = os.environ.get("LOCALDATA_KEY", "").strip()
BASE = os.environ.get("LOCALDATA_BASE", "https://www.localdata.go.kr/platform/rest/TO0/openDataApi").strip()
# 개방서비스 ID — 문서 기준. 실제 목록은 localdata.go.kr '개방자료 목록'에서 확인할 것.
#   07_24_04_P 일반음식점 · 07_24_05_P 휴게음식점(카페·분식 등) · 07_24_03_P 제과점영업
SVCS = [s.strip() for s in os.environ.get("LOCALDATA_SVCS", "07_24_04_P,07_24_05_P,07_24_03_P").split(",") if s.strip()]
# 서울만 받으려면 개방자치단체코드를 넣는다(쉼표 구분). 비우면 전국을 받아 주소로 거른다(느리지만 안전).
LOCALCODES = [s.strip() for s in os.environ.get("LOCALDATA_LOCALCODES", "").split(",") if s.strip()]
DAYS = int(os.environ.get("OPENINGS_DAYS", "30"))
RADIUS_M = int(os.environ.get("OPENINGS_RADIUS_M", "500"))
EPSG_PREF = os.environ.get("LOCALDATA_EPSG", "").strip()      # 비우면 5174·2097 중 자동 판별
PAGE = 500
MAX_ITEMS = 5          # 상권마다 남길 최근 항목 수(파일 크기 상한 — 1,564곳 × 5개)
NAME_MAX = 16

SEOUL_BOX = (126.70, 37.40, 127.30, 37.72)   # lon_min, lat_min, lon_max, lat_max


def fetch(svc, bgn, end, page):
    q = {"authKey": KEY, "opnSvcId": svc, "lastModTsBgn": bgn, "lastModTsEnd": end,
         "pageIndex": page, "pageSize": PAGE}
    if LOCALCODES:
        q["localCode"] = LOCALCODES[0] if len(LOCALCODES) == 1 else ",".join(LOCALCODES)
    url = BASE + "?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def text(row, *tags):
    for t in tags:
        v = row.findtext(t)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def ymd(s):
    """'20260901' · '2026-09-01' · '2026-09-01 12:00' → date, 못 읽으면 None"""
    s = (s or "").strip().replace("-", "").replace(".", "")[:8]
    if len(s) != 8 or not s.isdigit():
        return None
    try:
        return datetime.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except ValueError:
        return None


def make_transformer(epsg):
    from pyproj import Transformer
    return Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)


def to_lonlat(tr, x, y):
    lon, lat = tr.transform(x, y)
    if not (math.isfinite(lon) and math.isfinite(lat)):
        return None
    return lon, lat


def in_seoul(p):
    return p and SEOUL_BOX[0] <= p[0] <= SEOUL_BOX[2] and SEOUL_BOX[1] <= p[1] <= SEOUL_BOX[3]


def pick_epsg(samples):
    """좌표계를 문서만 믿지 않는다 — 표본을 두 좌표계로 바꿔 서울 안에 더 많이 떨어지는 쪽을 쓴다."""
    if EPSG_PREF:
        return EPSG_PREF, make_transformer(EPSG_PREF)
    best = None
    for epsg in ("5174", "2097"):
        try:
            tr = make_transformer(epsg)
        except Exception:
            continue
        hit = sum(1 for x, y in samples if in_seoul(to_lonlat(tr, x, y)))
        print(f"  좌표계 EPSG:{epsg} → 표본 {len(samples)}개 중 서울 안 {hit}개")
        if best is None or hit > best[2]:
            best = (epsg, tr, hit)
    if not best or best[2] == 0:
        return None, None
    return best[0], best[1]


def haversine_m(lon1, lat1, lon2, lat2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def load_zones():
    d = json.load(open(ZIDX, encoding="utf-8"))
    cols = d["cols"]
    ic, ilon, ilat = cols.index("cd"), cols.index("lon"), cols.index("lat")
    zones = []
    for r in d["rows"]:
        try:
            lon, lat = float(r[ilon]), float(r[ilat])
        except (TypeError, ValueError):
            continue
        if math.isfinite(lon) and math.isfinite(lat):
            zones.append((str(r[ic]), lon, lat))
    return zones


def main():
    if not KEY:
        print("LOCALDATA_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv:
            mark_unavailable(OUT, "LOCALDATA_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print(f"LOCALDATA_KEY 존재 · svcs={SVCS} · days={DAYS} · radius={RADIUS_M}m — 수집 가능")
        return 0

    until = datetime.date.today()
    since = until - datetime.timedelta(days=DAYS)
    bgn, end = since.strftime("%Y%m%d"), until.strftime("%Y%m%d")
    print(f"창 {since} ~ {until} · 서비스 {SVCS} · 반경 {RADIUS_M}m")

    # ① 받기
    raw = []            # (name, cat, kind, date, x, y)
    for svc in SVCS:
        page, got = 1, 0
        while True:
            xml = None
            for attempt in range(4):
                try:
                    xml = fetch(svc, bgn, end, page)
                    break
                except Exception as e:
                    if attempt == 3:
                        print(f"  {svc} p{page} 실패: {e}")
                    else:
                        time.sleep(2 * (attempt + 1))
            if xml is None:
                break
            try:
                rt = ET.fromstring(xml)
            except ET.ParseError:
                print(f"  {svc} p{page}: XML 아님 — 응답 앞부분: {xml[:160]!r}")
                break
            rows = rt.findall(".//row")
            if page == 1:
                code = rt.findtext(".//process/code") or rt.findtext(".//header/process/code") or ""
                total = rt.findtext(".//paging/totalCount") or "?"
                print(f"  {svc}: code={code or '-'} · 총 {total}행")
            for row in rows:
                addr = text(row, "rdnWhlAddr", "siteWhlAddr")
                if not addr.startswith("서울"):
                    continue
                name = text(row, "bplcNm")
                cat = text(row, "uptaeNm", "opnSvcNm")
                state = text(row, "trdStateGbn", "trdStateNm")
                d_open = ymd(text(row, "apvPermYmd"))
                d_close = ymd(text(row, "dcbYmd"))
                try:
                    x, y = float(text(row, "x")), float(text(row, "y"))
                except ValueError:
                    continue
                # 창 안의 폐업일이 있으면 '닫음', 창 안의 인허가일이 있고 영업 상태면 '열림'.
                if d_close and since <= d_close <= until:
                    raw.append((name, cat, "c", d_close, x, y))
                elif d_open and since <= d_open <= until and state in ("01", "영업/정상", "영업", ""):
                    raw.append((name, cat, "o", d_open, x, y))
            got += len(rows)
            if len(rows) < PAGE:
                break
            page += 1
            time.sleep(0.2)
        print(f"  {svc}: 받은 행 {got:,} · 지금까지 서울 개·폐업 {len(raw):,}")

    if not raw:
        mark_unavailable(OUT, "응답은 왔지만 창 안의 서울 개·폐업 행이 0 — 서비스 ID·필드명 확인 필요")
        return 3

    # ② 좌표계 판별 + 변환
    epsg, tr = pick_epsg([(r[4], r[5]) for r in raw[:300]])
    if not tr:
        mark_unavailable(OUT, "좌표 변환 결과가 서울 안에 떨어지지 않음 — LOCALDATA_EPSG 확인 필요")
        return 4
    recs = []
    for name, cat, kind, d, x, y in raw:
        p = to_lonlat(tr, x, y)
        if in_seoul(p):
            recs.append((name[:NAME_MAX], cat, kind, d, p[0], p[1]))
    print(f"좌표계 EPSG:{epsg} · 서울 안 좌표 {len(recs):,}/{len(raw):,}")

    # ③ 상권과 대조 — 위도 1도≈111km, 경도 1도≈88.5km(서울). bbox 로 먼저 거르고 정확한 거리를 잰다.
    zones = load_zones()
    dlat = RADIUS_M / 111000.0
    dlon = RADIUS_M / 88500.0
    out_zones = {}
    n_open = n_close = 0
    for name, cat, kind, d, lon, lat in recs:
        if kind == "o": n_open += 1
        else: n_close += 1
        for cd, zlon, zlat in zones:
            if abs(zlat - lat) > dlat or abs(zlon - lon) > dlon:
                continue
            dist = haversine_m(lon, lat, zlon, zlat)
            if dist > RADIUS_M:
                continue
            z = out_zones.setdefault(cd, {"o": 0, "c": 0, "items": []})
            z["o" if kind == "o" else "c"] += 1
            z["items"].append([name, cat, kind, d.isoformat(), int(round(dist))])
    for z in out_zones.values():
        z["items"].sort(key=lambda it: it[3], reverse=True)   # 최근 것부터
        z["items"] = z["items"][:MAX_ITEMS]

    out = {
        "available": True,
        "source": "지방행정인허가 개방자료(LOCALDATA)",
        "updated": until.isoformat(),
        "since": since.isoformat(), "until": until.isoformat(), "days": DAYS,
        "radius_m": RADIUS_M, "svcs": SVCS, "epsg": epsg,
        "n_records": len(recs), "n_open": n_open, "n_close": n_close,
        "n_zones": len(out_zones),
        "note": ("인허가·폐업 '신고 날짜' 기준이라 실제 개업·폐업일과 며칠 다를 수 있다. "
                 "거리는 상권 중심점까지의 직선거리. 음식점·카페·제과점만 본다(LOCALDATA_SVCS)."),
        "zones": out_zones,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(OUT) / 1024
    print(f"저장: {OUT} · 열림 {n_open:,} · 닫음 {n_close:,} · 상권 {len(out_zones):,} · {kb:.0f}KB")
    if kb > 700:
        print("경고: 700KB 를 넘었다 — MAX_ITEMS 나 NAME_MAX 를 줄일 것")
    return 0


if __name__ == "__main__":
    sys.exit(main())
