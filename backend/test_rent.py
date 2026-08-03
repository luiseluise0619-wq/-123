#!/usr/bin/env python3
"""
최종 테스트 — 전월세(임대료/보증금/건축년도) 를 자치구 단위로 붙여 R² 효과 확인.

서울 전월세가(tbLnOpendataRentV, 같은 서울 키)를 수집 → 자치구 중앙값 집계 →
우리 상권 데이터에 자치구(SIGNGU_CD_NM)로 조인 → 공간 홀드아웃 R² 비교.

주거용 임대료라 '동네 임대료 수준(부유함) 프록시'이며 자치구(25개) 단위라 거침.
사장님 중단 규칙: 여기서도 ~0 이면 "타겟이 무료 Feature를 더는 흡수 못 함" 확정.

실행:
    export USE_REAL_DATA=true
    export SEOUL_OPENDATA_API_KEY="키"
    python test_rent.py
"""

import os
import sys

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import GroupKFold

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.real_data_pipeline import real_data_pipeline  # noqa: E402
from app.data.collectors.seoul_trdar_client import fetch_service, get_api_key  # noqa: E402

LEAK = "SELNG"
KEYS = {"STDR_YYQU_CD", "TRDAR_CD"}
NAMES = {"TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM",
         "SIGNGU_CD_NM", "ADSTRD_CD_NM", "TRDAR_CHNGE_IX_NM"}
TGT = {"target_monthly_revenue", "monthly_revenue_actual"}
CATS = {"SVC_INDUTY_CD", "TRDAR_SE_CD", "SIGNGU_CD", "ADSTRD_CD", "TRDAR_CHNGE_IX"}
RENT_COLS = ["RENT_med", "DEPOSIT_med", "ARCH_med", "AREA_med"]
SAMPLE_N = 80_000


def collect_rent_by_gu(key):
    """전월세 수집 후 자치구 중앙값 집계 (25행)."""
    print("전월세(tbLnOpendataRentV) 수집 중... (자치구 집계용 10만건)")
    r = fetch_service("tbLnOpendataRentV", key, max_rows=100_000)
    if r.empty or "CGG_NM" not in r.columns:
        return pd.DataFrame()
    for c in ["RTFE", "GRFE", "ARCH_YR", "RENT_AREA"]:
        if c in r.columns:
            r[c] = pd.to_numeric(r[c], errors="coerce")
    rent_only = r[r["RTFE"] > 0] if "RTFE" in r.columns else r
    g = r.groupby("CGG_NM").agg(
        DEPOSIT_med=("GRFE", "median"),
        ARCH_med=("ARCH_YR", "median"),
        AREA_med=("RENT_AREA", "median"),
    )
    g["RENT_med"] = rent_only.groupby("CGG_NM")["RTFE"].median()
    return g.reset_index().rename(columns={"CGG_NM": "SIGNGU_CD_NM"})


def build(df, include_rent):
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES or (LEAK in c.upper()):
            continue
        if (not include_rent) and c in RENT_COLS:
            continue
        if c in CATS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    return pd.DataFrame(cols, index=df.index).replace([np.inf, -np.inf], np.nan).fillna(0)


def within(y, p, pct=0.30):
    return float((np.abs(np.asarray(p) - np.asarray(y)) <= pct * np.abs(np.asarray(y))).mean())


def spatial(X, y, groups):
    gkf = GroupKFold(n_splits=5)
    r2s, acc = [], []
    for tri, tei in gkf.split(X, y, groups=groups):
        m = LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3, n_estimators=150,
                          learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
        m.fit(X.iloc[tri], y.iloc[tri]); p = m.predict(X.iloc[tei])
        r2s.append(r2_score(y.iloc[tei], p)); acc.append(within(y.iloc[tei], p))
    return float(np.mean(r2s)), float(np.std(r2s)), float(np.mean(acc))


def main():
    key = get_api_key()
    gu = collect_rent_by_gu(key)
    if gu.empty:
        print("전월세 데이터 수집 실패."); sys.exit(1)
    print(f"자치구 집계 완료: {len(gu)}개 구\n{gu.round(0).to_string(index=False)}\n")

    df = real_data_pipeline.load_real_dataset()
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    df = df.merge(gu, on="SIGNGU_CD_NM", how="left")
    if len(df) > SAMPLE_N:
        df = df.sample(SAMPLE_N, random_state=42).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)
    groups = df["TRDAR_CD"].astype(str)

    print(f"{'='*56}\n전월세(임대료/건축년도) 효과 · 자치구 조인 (n={len(df):,})\n{'='*56}")
    r0, s0, a0 = spatial(build(df, False), y, groups)
    print(f"① 없이 : R²={r0:.4f} ± {s0:.3f} | ±30%={a0:.1%}")
    r1, s1, a1 = spatial(build(df, True), y, groups)
    print(f"② 포함 : R²={r1:.4f} ± {s1:.3f} | ±30%={a1:.1%}")
    print(f"\n→ 효과: R² {r1 - r0:+.4f}")
    print("  ✅ 도움" if r1 - r0 >= 0.01 else "  ⚠️ ~0 → 사장님 중단 규칙 발동: 무료 Feature 흡수 한계 확정")


if __name__ == "__main__":
    main()
