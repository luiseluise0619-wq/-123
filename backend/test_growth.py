#!/usr/bin/env python3
"""
변화율(성장률) 피처를 추가하면 신규 자리 예측(공간 홀드아웃) R² 가 오르나?
새 데이터 없이 기존 CSV에서 YoY(전년동기 대비) 성장률을 계산해 비교.

실행:
    export USE_REAL_DATA=true
    python test_growth.py
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

LEAK = "SELNG"
KEYS = {"STDR_YYQU_CD", "TRDAR_CD"}
NAMES = {"TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM",
         "SIGNGU_CD_NM", "ADSTRD_CD_NM", "TRDAR_CHNGE_IX_NM"}
TGT = {"target_monthly_revenue", "monthly_revenue_actual"}
CATS = {"SVC_INDUTY_CD", "TRDAR_SE_CD", "SIGNGU_CD", "ADSTRD_CD", "TRDAR_CHNGE_IX"}
SAMPLE_N = 80_000

ZONE_FEATS = ["TOT_FLPOP_CO", "EXPNDTR_TOTAMT", "TOT_REPOP_CO", "TOT_WRC_POPLTN_CO"]
STORE_FEATS = ["STOR_CO"]
GROWTH_COLS = [f + "_YOY" for f in ZONE_FEATS + STORE_FEATS]


def add_growth(df):
    """YoY(4분기 전 대비) 성장률 피처 추가."""
    df = df.copy()
    q = "STDR_YYQU_CD"
    # 병합키 dtype 통일 (int/str 혼재 방지)
    for k in ["STDR_YYQU_CD", "TRDAR_CD", "SVC_INDUTY_CD"]:
        if k in df.columns:
            df[k] = df[k].astype(str)
    # 상권 단위 피처: (상권,분기) 유니크로 성장률 계산 후 병합
    zcols = [c for c in ZONE_FEATS if c in df.columns]
    if zcols:
        z = df[["TRDAR_CD", q] + zcols].drop_duplicates(["TRDAR_CD", q]).copy()
        z = z.sort_values(["TRDAR_CD", q])
        for c in zcols:
            z[c] = pd.to_numeric(z[c], errors="coerce")
            z[c + "_YOY"] = z.groupby("TRDAR_CD")[c].pct_change(4, fill_method=None)
        df = df.merge(z[["TRDAR_CD", q] + [c + "_YOY" for c in zcols]], on=["TRDAR_CD", q], how="left")
    # 점포: (상권,업종,분기)
    if "STOR_CO" in df.columns:
        s = df[["TRDAR_CD", "SVC_INDUTY_CD", q, "STOR_CO"]].drop_duplicates(["TRDAR_CD", "SVC_INDUTY_CD", q]).copy()
        s = s.sort_values(["TRDAR_CD", "SVC_INDUTY_CD", q])
        s["STOR_CO"] = pd.to_numeric(s["STOR_CO"], errors="coerce")
        s["STOR_CO_YOY"] = s.groupby(["TRDAR_CD", "SVC_INDUTY_CD"])["STOR_CO"].pct_change(4, fill_method=None)
        df = df.merge(s[["TRDAR_CD", "SVC_INDUTY_CD", q, "STOR_CO_YOY"]],
                      on=["TRDAR_CD", "SVC_INDUTY_CD", q], how="left")
    return df


def build(df, include_growth):
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES:
            continue
        if LEAK in c.upper():
            continue
        if (not include_growth) and c in GROWTH_COLS:
            continue
        if c in CATS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    X = pd.DataFrame(cols, index=df.index)
    # 성장률 무한대/결측 정리
    X = X.replace([np.inf, -np.inf], np.nan).fillna(0)
    return X


def within(y, p, pct):
    return float((np.abs(np.asarray(p) - np.asarray(y)) <= pct * np.abs(np.asarray(y))).mean())


def spatial(X, y, groups):
    gkf = GroupKFold(n_splits=5)
    r2s, acc = [], []
    for tri, tei in gkf.split(X, y, groups=groups):
        m = LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3,
                          n_estimators=150, learning_rate=0.03, num_leaves=31,
                          random_state=42, verbose=-1)
        m.fit(X.iloc[tri], y.iloc[tri])
        p = m.predict(X.iloc[tei])
        r2s.append(r2_score(y.iloc[tei], p))
        acc.append(within(y.iloc[tei], p, 0.30))
    return float(np.mean(r2s)), float(np.std(r2s)), float(np.mean(acc))


def main():
    df = real_data_pipeline.load_real_dataset()
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    df = add_growth(df)  # 전체에서 성장률 계산 (시점 정보 필요)
    if len(df) > SAMPLE_N:
        df = df.sample(SAMPLE_N, random_state=42).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)
    groups = df["TRDAR_CD"].astype(str)

    have = [c for c in GROWTH_COLS if c in df.columns]
    print(f"\n{'='*56}\n성장률 피처 효과 (공간 홀드아웃 5-fold, n={len(df):,})\n{'='*56}")
    print(f"추가된 성장률 피처: {have}\n")

    r0, s0, a0 = spatial(build(df, False), y, groups)
    print(f"① 성장률 없이 : R²={r0:.4f} ± {s0:.3f} | ±30%={a0:.1%}")
    r1, s1, a1 = spatial(build(df, True), y, groups)
    print(f"② 성장률 포함 : R²={r1:.4f} ± {s1:.3f} | ±30%={a1:.1%}")
    print(f"\n→ 효과: R² {r1 - r0:+.4f}, ±30% {a1 - a0:+.1%}")
    if r1 - r0 >= 0.01:
        print("  ✅ 성장률이 도움! train.py 에 반영")
    else:
        print("  ⚠️ 성장률도 미미 → 공공데이터 천장 재확인")


if __name__ == "__main__":
    main()
