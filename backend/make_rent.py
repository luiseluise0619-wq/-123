#!/usr/bin/env python3
"""
임대료·공실률 레이어 생산기 (창업 비용 차원).

원천: 한국부동산원 상업용부동산 임대동향조사(중대형 상가) — backend에 이미 있는
      seoul_rent.csv(임대료 만원/㎡) + seoul_vacancy.csv(공실률 %), 분기별 8개 시계열.
      두 CSV는 (gwon 권역, sanggwon 상권) 키가 완전히 일치.

이 데이터는 그동안 backend에만 있고 프론트에 배포되지 않았다 → 여기서 프론트용 JSON 으로.
API 키 불필요(정적 CSV 파생). 지어냄 없음: 값이 없으면 null.

출력: frontend/rent.json
  { available, updated, source, unit, quarters:[8개 분기 라벨],
    seoul:{rent, vacancy, rent_trend, vacancy_trend},
    gwons:[권역명...],
    zones:[ {nm, gwon, rent, vacancy, rent_trend[8], vacancy_trend[8]} ... ] }
  rent=최신분기 임대료(만원/㎡, 중대형), vacancy=최신 공실률(%).
"""
import os, sys, csv, json, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RENT = os.path.join(HERE, "app", "data", "real_data", "seoul_rent.csv")
VAC  = os.path.join(HERE, "app", "data", "real_data", "seoul_vacancy.csv")
OUT  = os.path.join(ROOT, "frontend", "rent.json")


def write_unavailable(reason):
    json.dump({"available": False, "reason": reason,
               "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d")},
              open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print("available=false:", reason)


def fnum(s):
    s = (s or "").strip().replace(",", "")
    if s in ("", "-", "nan", "N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load(path):
    """CSV → (분기라벨 리스트, {(gwon,sanggwon): [8개 값]})"""
    with open(path, encoding="utf-8-sig") as f:
        rows = list(csv.reader(f))
    header, body = rows[0], rows[1:]
    quarters = header[2:]                      # 앞 2열(gwon, sanggwon) 뒤부터가 분기
    data = {}
    for r in body:
        if len(r) < 3:
            continue
        gwon, sang = r[0].strip(), r[1].strip()
        data[(gwon, sang)] = [fnum(x) for x in r[2:]]
    return quarters, data


def main():
    for p in (RENT, VAC):
        if not os.path.exists(p):
            write_unavailable(f"CSV 없음: {p}")
            return 0

    q_rent, rent = load(RENT)
    q_vac,  vac  = load(VAC)
    quarters = q_rent
    if q_vac != q_rent:
        # 분기 라벨이 어긋나면 공통 개수만큼만 안전하게 사용
        n = min(len(q_rent), len(q_vac))
        quarters = q_rent[:n]

    zones = []
    seoul = None
    for key in rent:                            # rent/vacancy 키 집합은 동일(검증됨)
        gwon, sang = key
        rt = rent.get(key, [])
        vt = vac.get(key, [])
        rec = {
            "nm": sang, "gwon": gwon,
            "rent": rt[-1] if rt else None,
            "vacancy": vt[-1] if vt else None,
            "rent_trend": rt,
            "vacancy_trend": vt,
        }
        if sang == "서울" and gwon == "서울":
            seoul = {"rent": rec["rent"], "vacancy": rec["vacancy"],
                     "rent_trend": rt, "vacancy_trend": vt}
        else:
            zones.append(rec)

    if not zones:
        write_unavailable("유효한 상권 행이 없음")
        return 0

    # 임대료 높은 순 정렬(비쌀수록 위) — null 은 뒤로
    zones.sort(key=lambda z: (z["rent"] is None, -(z["rent"] or 0)))
    gwons = []
    for z in zones:
        if z["gwon"] not in gwons:
            gwons.append(z["gwon"])

    json.dump({
        "available": True,
        "updated": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
        "source": "한국부동산원 상업용부동산 임대동향조사(중대형 상가)",
        "unit": "임대료=만원/㎡(월), 공실률=%",
        "note": "권역·상권 단위(한국부동산원 30여개 상권). 서울시 상권분석 1564개 상권과는 다른 지리.",
        "quarters": quarters,
        "seoul": seoul,
        "gwons": gwons,
        "zones": zones,
    }, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"저장: {OUT} · 상권 {len(zones)}개 · 분기 {len(quarters)}개 · 권역 {gwons}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
