#!/usr/bin/env python3
"""
모델별 성능 벤치마크 — LightGBM vs XGBoost vs CatBoost vs 앙상블.
동일 피처/동일 공간 홀드아웃(신규 자리)에서 비교. 알고리즘 교체의 실제 효과 측정.

준비:  pip install xgboost catboost
실행:  export USE_REAL_DATA=true && python model_compare.py

기대: 미세 차이(±0.02)만 있고 0.28 천장은 안 뚫림 → "모델은 병목이 아니다" 확증.
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


def build(df):
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES or (LEAK in c.upper()):
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


def make_models():
    m = {"LightGBM": lambda: LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3,
                                           n_estimators=300, learning_rate=0.03, num_leaves=31,
                                           random_state=42, verbose=-1)}
    try:
        from xgboost import XGBRegressor
        m["XGBoost"] = lambda: XGBRegressor(objective="reg:tweedie", tweedie_variance_power=1.3,
                                            n_estimators=300, learning_rate=0.03, max_depth=6,
                                            subsample=0.9, colsample_bytree=0.9, random_state=42,
                                            verbosity=0)
    except ImportError:
        print("  (xgboost 없음 → pip install xgboost 하면 포함됨)")
    try:
        from catboost import CatBoostRegressor
        m["CatBoost"] = lambda: CatBoostRegressor(iterations=300, learning_rate=0.03, depth=6,
                                                  loss_function="Tweedie:variance_power=1.3",
                                                  random_seed=42, verbose=0)
    except ImportError:
        print("  (catboost 없음 → pip install catboost 하면 포함됨)")
    return m


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
    X = build(df)

    models = make_models()
    print(f"\n{'='*58}\n모델 벤치마크 (공간 홀드아웃 5-fold, n={len(df):,}, 피처 {X.shape[1]})\n{'='*58}")

    gkf = GroupKFold(n_splits=5)
    splits = list(gkf.split(X, y, groups=groups))
    fold_preds = {name: np.zeros(len(y)) for name in models}
    scores = {name: [] for name in models}

    for name, factory in models.items():
        accs = []
        for tri, tei in splits:
            m = factory(); m.fit(X.iloc[tri], y.iloc[tri])
            p = m.predict(X.iloc[tei])
            fold_preds[name][tei] = p
            scores[name].append(r2_score(y.iloc[tei], p))
            accs.append(within(y.iloc[tei], p))
        r2 = np.mean(scores[name])
        print(f"  {name:10s} R²={r2:.4f} ± {np.std(scores[name]):.3f} | ±30%={np.mean(accs):.1%}")

    # 앙상블: 모델별 out-of-fold 예측 평균
    if len(models) > 1:
        ens = np.mean([fold_preds[n] for n in models], axis=0)
        r2e = r2_score(y, ens)
        print(f"  {'앙상블(avg)':10s} R²={r2e:.4f} | ±30%={within(y, ens):.1%}")

    print("\n→ 차이가 미세하면(±0.02) '병목은 알고리즘이 아니라 타겟/데이터'가 확증됨.")


if __name__ == "__main__":
    main()
