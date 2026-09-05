"""
상권 지도 API — 실데이터 서빙 (하드코딩 제거).

이전 버전은 성수/강남 4개 상권을 opportunity_score 까지 지어내 반환했다(가짜).
이 버전은 수집한 seoul_trdar_dataset.csv 에서 실제 상권·좌표·매출을 읽어
등급(A~F)·기회점수를 계산해 반환한다. 데이터가 없으면 지어내지 않고
available=False 로 정직하게 알린다.
"""

import os
import functools
from fastapi import APIRouter

router = APIRouter()

CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "..", "data", "real_data", "seoul_trdar_dataset.csv")
GRADE_COLOR = {"A+": "#16a34a", "A": "#22c55e", "B": "#38bdf8",
               "C": "#f59e0b", "D": "#fb7185", "F": "#dc2626"}


def _grade(p):
    return ("A+" if p >= .95 else "A" if p >= .85 else "B" if p >= .65
            else "C" if p >= .4 else "D" if p >= .2 else "F")


@functools.lru_cache(maxsize=8)
def load_zones(industry: str = "", crs: str = "EPSG:5181"):
    """CSV → 상권별 (좌표·매출·등급·경쟁·기회점수). 캐시. 실패 시 None."""
    if not os.path.exists(CSV):
        return None
    try:
        import pandas as pd
        from pyproj import Transformer
    except Exception:
        return None
    df = pd.read_csv(CSV, low_memory=False)
    need = {"XCNTS_VALUE", "YDNTS_VALUE", "TRDAR_CD", "THSMON_SELNG_AMT"}
    if not need.issubset(df.columns):
        return None
    if industry and "SVC_INDUTY_CD_NM" in df.columns:
        df = df[df["SVC_INDUTY_CD_NM"].astype(str).str.contains(industry, na=False)]
    name_col = "TRDAR_CD_NM" if "TRDAR_CD_NM" in df.columns else "TRDAR_CD"
    df["rev"] = pd.to_numeric(df["THSMON_SELNG_AMT"], errors="coerce")
    agg = {"x": ("XCNTS_VALUE", "first"), "y": ("YDNTS_VALUE", "first"),
           "name": (name_col, "first"), "rev": ("rev", "sum")}
    if "STOR_CO" in df.columns:
        df["stor"] = pd.to_numeric(df["STOR_CO"], errors="coerce"); agg["stores"] = ("stor", "mean")
    if "SIMILR_INDUTY_STOR_CO" in df.columns:
        df["sim"] = pd.to_numeric(df["SIMILR_INDUTY_STOR_CO"], errors="coerce"); agg["comp"] = ("sim", "mean")
    if "TOT_FLPOP_CO" in df.columns:
        df["fp"] = pd.to_numeric(df["TOT_FLPOP_CO"], errors="coerce"); agg["foot"] = ("fp", "mean")
    if "SIGNGU_CD_NM" in df.columns:
        agg["gu"] = ("SIGNGU_CD_NM", "first")          # 자치구
    if "ADSTRD_CD_NM" in df.columns:
        agg["dong"] = ("ADSTRD_CD_NM", "first")        # 행정동
    g = df.groupby("TRDAR_CD").agg(**agg).reset_index()
    g = g[(g["rev"] > 0) & g["x"].notna() & g["y"].notna()]
    if g.empty:
        return None
    g["p"] = g["rev"].rank(pct=True)
    tf = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    lon, lat = tf.transform(g["x"].astype(float).values, g["y"].astype(float).values)
    g["lat"], g["lon"] = lat, lon
    g = g[(g["lat"].between(37.3, 37.75)) & (g["lon"].between(126.7, 127.3))]

    zones = []
    for _, r in g.iterrows():
        grade = _grade(r["p"])
        demand = r["p"] * 100
        comp = float(r.get("comp") or 0)
        opp = round(min(100, demand * 0.7 + max(0, 30 - comp)), 1)
        ztype = "GREEN" if opp >= 70 else "RED" if opp <= 45 else "BLUE"
        zones.append({
            "id": str(r["TRDAR_CD"]), "name": str(r["name"]),
            "gu": str(r.get("gu") or ""), "dong": str(r.get("dong") or ""),
            "lat": round(float(r["lat"]), 5), "lng": round(float(r["lon"]), 5),
            "grade": grade, "percentile_top": round((1 - r["p"]) * 100, 1),
            "monthly_sales_won": int(r["rev"]),
            "opportunity_score": opp, "zone_color": GRADE_COLOR[grade], "zone_type": ztype,
            "avg_monthly_sales": f"{r['rev']/1e8:.1f}억",
            "foot_traffic_daily": int(r["foot"]) if r.get("foot") == r.get("foot") else None,
            "stores": int(r["stores"]) if r.get("stores") == r.get("stores") else None,
        })
    zones.sort(key=lambda z: -z["opportunity_score"])
    return zones


@router.get("/regions")
def get_regions(industry: str = ""):
    """자치구 → 행정동 목록 + 각 지역 자리 수 (지역별 드릴다운용)."""
    zones = load_zones(industry)
    if zones is None:
        return {"available": False, "message": "실데이터 없음. build_seoul_dataset.py --build 후 사용."}
    from collections import defaultdict
    gu = defaultdict(lambda: defaultdict(int))
    for z in zones:
        if z["gu"]:
            gu[z["gu"]][z["dong"] or "-"] += 1
    return {"available": True,
            "regions": [{"gu": g, "count": sum(d.values()),
                         "dongs": [{"dong": k, "count": v} for k, v in sorted(d.items())]}
                        for g, d in sorted(gu.items())]}


@router.get("/opportunity-map")
def get_opportunity_map_layers(region: str = "서울", industry: str = "", gu: str = "",
                               dong: str = "", grade: str = "", price_tier: str = "",
                               limit: int = 800):
    """지역별(gu/dong) + 가격대별(price_tier: high/mid/low) + 등급 필터.
    price_tier: high=상위30%, mid=중간40%, low=하위30% (매출 기준)."""
    zones = load_zones(industry)
    if zones is None:
        return {"region": region, "available": False, "zones": [],
                "message": "실데이터(seoul_trdar_dataset.csv) 없음. build_seoul_dataset.py --build "
                           "로 수집 후 사용. 가짜 데이터를 반환하지 않습니다."}
    if gu:
        zones = [z for z in zones if z["gu"] == gu]
    if dong:
        zones = [z for z in zones if z["dong"] == dong]
    if grade:
        zones = [z for z in zones if z["grade"] == grade]
    if price_tier and zones:
        revs = sorted(z["monthly_sales_won"] for z in zones)
        lo, hi = revs[int(len(revs) * .3)], revs[int(len(revs) * .7)]
        zones = [z for z in zones if
                 (price_tier == "low" and z["monthly_sales_won"] <= lo) or
                 (price_tier == "mid" and lo < z["monthly_sales_won"] <= hi) or
                 (price_tier == "high" and z["monthly_sales_won"] > hi)]
    return {"region": region, "available": True, "industry": industry or "전체",
            "filters": {"gu": gu, "dong": dong, "grade": grade, "price_tier": price_tier},
            "count": len(zones), "zones": zones[:limit]}
