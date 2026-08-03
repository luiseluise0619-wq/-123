#!/usr/bin/env python3
"""
새로 붙인 데이터(영역+상권변화지표)가 실제로 R² 를 올렸는지 깔끔하게 비교.
전체 모델, 공간 홀드아웃 5-fold, Tweedie. 새 변수 유무만 바꿔서 대조.

실행:
    export USE_REAL_DATA=true
    python test_new_data.py
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
# 이번에 새로 붙인 컬럼들
NEW_COLS = {"XCNTS_VALUE", "YDNTS_VALUE", "SIGNGU_CD", "SIGNGU_CD_NM", "ADSTRD_CD",
            "ADSTRD_CD_NM", "RELM_AR", "TRDAR_CHNGE_IX", "TRDAR_CHNGE_IX_NM",
            "OPR_SALE_MT_AVRG", "CLS_SALE_MT_AVRG", "SU_OPR_SALE_MT_AVRG", "SU_CLS_SALE_MT_AVRG"}
SAMPLE_N = 80_000


def build(df, include_new):
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES:
            continue
        if LEAK in c.upper():
            continue
        if (not include_new) and c in NEW_COLS:
            continue
        if c in CATS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    return pd.DataFrame(cols, index=df.index).fillna(0)


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
    if len(df) > SAMPLE_N:
        df = df.sample(SAMPLE_N, random_state=42).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)
    groups = df["TRDAR_CD"].astype(str)

    have_new = [c for c in NEW_COLS if c in df.columns]
    print(f"\n{'='*56}\n새 데이터 효과 검증 (공간 홀드아웃 5-fold, n={len(df):,})\n{'='*56}")
    print(f"붙은 새 컬럼 {len(have_new)}개: {sorted(have_new)}\n")

    r2_old, s_old, a_old = spatial(build(df, False), y, groups)
    print(f"① 새 데이터 없이 : R²={r2_old:.4f} ± {s_old:.3f} | ±30%={a_old:.1%}")
    r2_new, s_new, a_new = spatial(build(df, True), y, groups)
    print(f"② 새 데이터 포함 : R²={r2_new:.4f} ± {s_new:.3f} | ±30%={a_new:.1%}")
    print(f"\n→ 효과: R² {r2_new - r2_old:+.4f}, ±30% {a_new - a_old:+.1%}")
    if r2_new - r2_old >= 0.01:
        print("  ✅ 새 데이터가 의미있게 도움 → 반영하고 임대료도 추가 가치 있음")
    else:
        print("  ⚠️ 새 데이터 효과 미미 → 공공데이터 천장 근접, 제품 방향으로")


if __name__ == "__main__":
    main()
