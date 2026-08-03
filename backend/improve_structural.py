#!/usr/bin/env python3
"""
구조 모델(신규 자리 예측) R² 끌어올리기 실험 — 재수집 없이 공짜 개선만.

기준 지표 = 공간 홀드아웃 R² (처음 보는 상권, GroupKFold=5). 현재 baseline ≈ 0.28.
각 개선을 켜가며 이 지표가 오르는지 비교한다.

실행:
    export USE_REAL_DATA=true
    python improve_structural.py
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
NAMES = {"TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM"}
TGT = {"target_monthly_revenue", "monthly_revenue_actual"}
CATS = {"SVC_INDUTY_CD", "TRDAR_SE_CD"}
SAMPLE_N = 150_000  # 실험 속도용 표본


def num(df, c):
    return pd.to_numeric(df[c], errors="coerce") if c in df.columns else None


def build(df, engineered=False, native_cat=False):
    cols = {}
    cat_cols = []
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES:
            continue
        if LEAK in c.upper():
            continue
        if c in CATS:
            if native_cat and c == "SVC_INDUTY_CD":
                cols[c] = df[c].astype("category")
                cat_cols.append(c)
            else:
                cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    X = pd.DataFrame(cols, index=df.index)

    if engineered:
        stor = num(df, "STOR_CO"); rep = num(df, "TOT_REPOP_CO")
        sim = num(df, "SIMILR_INDUTY_STOR_CO"); frc = num(df, "FRC_STOR_CO")
        opb = num(df, "OPBIZ_RT"); cls = num(df, "CLSBIZ_RT")
        exp = num(df, "EXPNDTR_TOTAMT"); flp = num(df, "TOT_FLPOP_CO")
        wrc = num(df, "TOT_WRC_POPLTN_CO")
        if stor is not None and rep is not None:
            X["ENG_comp_density"] = stor / (rep + 1)
        if sim is not None and stor is not None:
            X["ENG_similar_ratio"] = sim / (stor + 1)
        if frc is not None and stor is not None:
            X["ENG_franchise_ratio"] = frc / (stor + 1)
        if opb is not None and cls is not None:
            X["ENG_net_open"] = opb - cls
        if exp is not None and rep is not None:
            X["ENG_spend_per_capita"] = exp / (rep + 1)
        if flp is not None and rep is not None:
            X["ENG_flow_per_resident"] = flp / (rep + 1)
        if wrc is not None and rep is not None:
            X["ENG_worker_ratio"] = wrc / (rep + 1)

    for c in X.columns:
        if c not in cat_cols:
            X[c] = X[c].fillna(0)
    return X, cat_cols


def spatial_r2(X, y, groups, cat_cols=None, log_target=False, tweedie=False, tuned=False):
    gkf = GroupKFold(n_splits=5)
    scores = []
    for tri, tei in gkf.split(X, y, groups=groups):
        params = dict(n_estimators=150, learning_rate=0.03, num_leaves=31,
                      random_state=42, verbose=-1)
        if tuned:
            params.update(n_estimators=600, learning_rate=0.02, num_leaves=63,
                          subsample=0.8, colsample_bytree=0.8, min_child_samples=40)
        if tweedie:
            params.update(objective="tweedie", tweedie_variance_power=1.3)
        m = LGBMRegressor(**params)
        ytr = np.log1p(y.iloc[tri]) if log_target else y.iloc[tri]
        fit_kw = {}
        if cat_cols:
            fit_kw["categorical_feature"] = cat_cols
        m.fit(X.iloc[tri], ytr, **fit_kw)
        pred = m.predict(X.iloc[tei])
        if log_target:
            pred = np.expm1(pred)
        scores.append(r2_score(y.iloc[tei], pred))
    return float(np.mean(scores)), float(np.std(scores))


def main():
    df = real_data_pipeline.load_real_dataset()
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    if len(df) > SAMPLE_N:
        df = df.sample(SAMPLE_N, random_state=42).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)
    groups = df["TRDAR_CD"].astype(str)

    print(f"\n{'='*64}\n구조모델 R² 개선 실험 (공간 홀드아웃, n={len(df):,})\n{'='*64}")
    results = []

    Xb, _ = build(df)
    results.append(("① baseline", spatial_r2(Xb, y, groups)))

    results.append(("② +log타겟", spatial_r2(Xb, y, groups, log_target=True)))
    results.append(("③ +Tweedie", spatial_r2(Xb, y, groups, tweedie=True)))

    Xc, cc = build(df, native_cat=True)
    results.append(("④ +업종 네이티브범주", spatial_r2(Xc, y, groups, cat_cols=cc)))

    Xe, _ = build(df, engineered=True)
    results.append(("⑤ +비율피처", spatial_r2(Xe, y, groups)))

    results.append(("⑥ +튜닝", spatial_r2(Xb, y, groups, tuned=True)))

    # ⑦ ALL: 비율피처 + 네이티브범주 + log + 튜닝
    Xall, ccall = build(df, engineered=True, native_cat=True)
    results.append(("⑦ ALL(비율+범주+log+튜닝)",
                    spatial_r2(Xall, y, groups, cat_cols=ccall, log_target=True, tuned=True)))

    print(f"\n{'구성':<28}{'공간홀드아웃 R²':>18}")
    print("-" * 48)
    base = results[0][1][0]
    for name, (m, s) in results:
        delta = f"  (Δ{m - base:+.3f})" if name != "① baseline" else ""
        print(f"{name:<28}{m:>10.4f} ± {s:.3f}{delta}")
    best = max(results, key=lambda r: r[1][0])
    print("-" * 48)
    print(f"최고: {best[0]}  R²={best[1][0]:.4f}")
    print("\n→ 여기서 오른 조합을 train.py 에 반영하고, 그 다음 새 데이터(아파트/상권변화지표) 수집.")


if __name__ == "__main__":
    main()
