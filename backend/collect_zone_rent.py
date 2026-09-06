#!/usr/bin/env python3
"""
서울 상권분석 점포·임대시세(환산임대료) → 상권 1,564곳 단위 임대료.

왜 필요한가
  지금 앱의 임대료는 한국부동산원 임대동향조사(서울 63개 상권 + 권역)뿐이라,
  이 앱이 쓰는 상권 1,564곳 단위 값이 없다. 그래서 대부분의 상권에서
  '서울 평균'만 보여 주고 있다. 서울시 상권분석서비스는 같은 상권 코드 체계로
  환산임대료를 제공하므로, 들어오면 상권별 실제 값을 쓸 수 있다.

환산임대료란
  서울시 설명 기준 `보증금 × 12% ÷ 12 + 월세` 로 환산한 월 임대료다.
  최근 1년 서울신용보증재단 보증 고객 통계 기반 추정치라 실제 시세와 다를 수 있다.
  → 화면에서 '추정'으로 표시해야 한다. 실측 계약가가 아니다.

정직
  SEOUL_API_KEY 없으면 수집을 생략하고 available:false 로 둔다(지어내지 않는다).
  서비스명(오퍼레이션)은 포털에서 확인해야 한다. 이 작업 환경은 외부망이 막혀 있어
  실제 응답으로 검증하지 못했다 → 환경변수 ZONE_RENT_SERVICE 로 덮어쓸 수 있게 뒀다.
  샌드박스 외부망 차단 → GitHub Action(개방망)에서 실행된다.

출력: frontend/zone_rent.json
  { available, service, quarter, updated, unit, note, n_zones,
    zones:{ "<상권코드>": { nm, rent, deposit, monthly } } }
      rent    = 환산임대료(만원/㎡, 월)
      deposit = 보증금(만원/㎡)  · monthly = 월세(만원/㎡)  ← 응답에 있을 때만

    SEOUL_API_KEY=... python collect_zone_rent.py
    python collect_zone_rent.py --check
"""
import os, sys, json, time, datetime, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from collect_util import mark_unavailable

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT  = os.path.join(ROOT, "frontend", "zone_rent.json")
KEY  = os.environ.get("SEOUL_API_KEY", "").strip()
# 포털에서 확인한 오퍼레이션명으로 덮어쓸 수 있게 둔다.
SERVICE = os.environ.get("ZONE_RENT_SERVICE", "VwsmTrdarStorQq").strip()
BASE = "http://openapi.seoul.go.kr:8088"

# 기관마다 태그 이름이 다르다. 흔한 이름들을 훑고, 못 찾으면 정직하게 비운다.
RENT_TAGS    = ("CNVRSN_RENT_FEE", "CNVR_RENT_FEE", "RENT_FEE", "CNVRSN_RENT")
DEPOSIT_TAGS = ("GUARANTEE_MNY", "DPSTG", "DEPOSIT_AMT", "GRNTE_AMT")
MONTHLY_TAGS = ("MT_RENT_FEE", "MNTHLY_RENT", "MONTH_RENT_FEE")
NAME_TAGS    = ("TRDAR_CD_NM", "TRDAR_NM")


def pick(row, tags):
    """여러 후보 태그 중 처음 발견되는 숫자를 돌려준다. 없으면 None."""
    for t in tags:
        v = row.findtext(t)
        if v is None or not str(v).strip():
            continue
        try:
            f = float(str(v).strip().replace(",", ""))
        except ValueError:
            continue
        if f > 0:
            return f
    return None


def fetch(start, end, qu=""):
    url = f"{BASE}/{urllib.parse.quote(KEY)}/xml/{SERVICE}/{start}/{end}/"
    if qu:
        url += f"{qu}/"
    req = urllib.request.Request(url, headers={"User-Agent": "sangkwon-collector"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8")


def latest_quarter():
    today = datetime.date.today()
    cur = today.year * 10 + (today.month - 1) // 3 + 1
    for yy in (today.year, today.year - 1, today.year - 2):
        for q in (4, 3, 2, 1):
            qu = f"{yy}{q}"
            if int(qu) > cur:
                continue
            try:
                rt = ET.fromstring(fetch(1, 1, qu))
                if rt.findtext(".//RESULT/CODE") == "INFO-000" and int(rt.findtext(".//list_total_count") or 0) > 0:
                    return qu, int(rt.findtext(".//list_total_count"))
            except Exception:
                continue
    return None, 0


def main():
    if not KEY:
        print("SEOUL_API_KEY 없음 — 수집 생략(정직).")
        if "--check" not in sys.argv:
            mark_unavailable(OUT, "SEOUL_API_KEY 없음")
        return 0 if "--check" in sys.argv else 1
    if "--check" in sys.argv:
        print(f"SEOUL_API_KEY 존재 · service={SERVICE} — 수집 가능")
        return 0

    qu, total = latest_quarter()
    if not qu:
        mark_unavailable(OUT, f"최신 분기 탐색 실패 (service={SERVICE})")
        return 2
    print(f"최신 분기 {qu} · 총 {total:,}행 · service={SERVICE}")

    zones, step = {}, 1000
    for s in range(1, total + 1, step):
        e = min(s + step - 1, total)
        for attempt in range(4):
            try:
                xml = fetch(s, e, qu)
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        for row in ET.fromstring(xml).findall(".//row"):
            cd = (row.findtext("TRDAR_CD") or "").strip()
            if not cd:
                continue
            rent = pick(row, RENT_TAGS)
            if rent is None:
                continue
            nm = ""
            for t in NAME_TAGS:
                nm = (row.findtext(t) or "").strip()
                if nm:
                    break
            rec = {"nm": nm or cd, "rent": round(rent / 10000.0, 2) if rent > 1000 else round(rent, 2)}
            dep = pick(row, DEPOSIT_TAGS)
            mon = pick(row, MONTHLY_TAGS)
            if dep is not None:
                rec["deposit"] = round(dep / 10000.0, 2) if dep > 1000 else round(dep, 2)
            if mon is not None:
                rec["monthly"] = round(mon / 10000.0, 2) if mon > 1000 else round(mon, 2)
            zones[cd] = rec
        time.sleep(0.12)

    if not zones:
        # 응답은 왔는데 임대료 태그를 못 찾은 경우 — 태그 이름을 사람이 확인해야 한다.
        mark_unavailable(OUT, f"임대료 필드를 찾지 못함 — RENT_TAGS 확인 필요 (service={SERVICE})")
        return 3

    out = {
        "available": True,
        "service": SERVICE,
        "quarter": qu,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "unit": "환산임대료=만원/㎡(월)",
        "note": ("서울시 상권분석서비스 환산임대료. 보증금×12%÷12+월세로 환산한 추정값이며 "
                 "최근 1년 서울신용보증재단 보증 고객 통계 기반이라 실제 시세와 차이가 있을 수 있다. "
                 "화면에서는 '추정'으로 표시할 것."),
        "n_zones": len(zones),
        "zones": zones,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
