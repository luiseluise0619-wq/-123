#!/usr/bin/env python3
"""
lag 모델 스트레스 테스트.

질문: per-store + lag 로 나온 R² 0.92 는 진짜 실력인가, 아니면 '지난 분기 복사'인가?

실행:
    export USE_REAL_DATA=true
    python stress_test_lag.py

투명성을 위해 전처리를 이 스크립트 안에서 직접(재사용 없이) 수행한다.
"""

import os
import sys

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, r2_score

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.real_data_pipeline import real_data_pipeline  # noqa: E402

LEAK = "SELNG"
KEYS = {"STDR_YYQU_CD", "TRDAR_CD"}
NAMES = {"TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM"}
TGT = {"target_monthly_revenue", "monthly_revenue_actual"}
CATS = {"SVC_INDUTY_CD", "TRDAR_SE_CD"}


def lgbm():
    return LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31,
                         random_state=42, verbose=-1)


def main():
    df = real_data_pipeline.load_real_dataset()
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)

    # per-store 타겟
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)

    q = df["STDR_YYQU_CD"].astype(str)
    grp = (df["TRDAR_CD"].astype(str) + "_" + df["SVC_INDUTY_CD"].astype(str))

    # lag1, lag2 (원본 NaN 유지 → 신규(과거없음) 식별 가능)
    base = pd.DataFrame({"y": y.values, "q": q.values, "grp": grp.values}, index=df.index)
    s = base.sort_values(["grp", "q"])
    lag1 = s.groupby("grp")["y"].shift(1).reindex(df.index)
    lag2 = s.groupby("grp")["y"].shift(2).reindex(df.index)
    has_hist = lag1.notna()

    # 구조 피처 (SELNG 누수 제외, 업종 인코딩)
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES:
            continue
        if LEAK in c.upper():
            continue
        if c in CATS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    Xstruct = pd.DataFrame(cols, index=df.index).fillna(0)
    Xfull = Xstruct.copy()
    Xfull["PREV_Q_REVENUE"] = lag1.fillna(lag1.median())

    # 시간 분할: 최신 분기 = 테스트
    tq = sorted(q.unique())[-1]
    tr, te = (q < tq).values, (q == tq).values

    def fit_eval(X):
        m = lgbm(); m.fit(X[tr], y[tr]); p = m.predict(X[te])
        return r2_score(y[te], p), mean_absolute_error(y[te], p)

    print(f"\n=== 스트레스 테스트 (테스트 분기={tq}, train={tr.sum():,}, test={te.sum():,}) ===\n")

    # Test A: Naive persistence (예측 = 지난분기 그대로), 과거 있는 행만
    te_hist = te & has_hist.values
    r2_naive = r2_score(y[te_hist], lag1[te_hist])
    mae_naive = mean_absolute_error(y[te_hist], lag1[te_hist])
    print("① Naive '지난분기 복사' 기준선 (과거 있는 행만)")
    print(f"    R²={r2_naive:.4f} | MAE={mae_naive:,.0f}   ← 모델이 이걸 못 이기면 무의미\n")

    # Test B: 전체 vs 구조만 vs lag만
    r2_full, mae_full = fit_eval(Xfull)
    r2_struct, mae_struct = fit_eval(Xstruct)
    r2_lagonly, mae_lagonly = fit_eval(Xfull[["PREV_Q_REVENUE"]])
    print("② 피처 구성별 (LightGBM)")
    print(f"    전체(구조+lag): R²={r2_full:.4f} | MAE={mae_full:,.0f}")
    print(f"    lag 1개만     : R²={r2_lagonly:.4f} | MAE={mae_lagonly:,.0f}")
    print(f"    구조만(lag없음): R²={r2_struct:.4f} | MAE={mae_struct:,.0f}")
    print(f"    → 전체가 lag만보다 +{r2_full - r2_lagonly:.4f}, "
          f"모델이 naive보다 +{r2_full - r2_naive:.4f}\n")

    # Test C: 신규(과거 없음) vs 기존(과거 있음) 분리 성능
    m = lgbm(); m.fit(Xfull[tr], y[tr]); pred = m.predict(Xfull[te])
    yv = y[te].values
    hh = has_hist.values[te]
    if hh.sum() > 0:
        r2_exist = r2_score(yv[hh], pred[hh])
    else:
        r2_exist = float("nan")
    if (~hh).sum() > 0:
        r2_new = r2_score(yv[~hh], pred[~hh])
    else:
        r2_new = float("nan")
    print("③ 테스트셋 내 기존 vs 신규(과거 없음) 상권 분리")
    print(f"    기존(과거 있음) n={hh.sum():,}: R²={r2_exist:.4f}")
    print(f"    신규(과거 없음) n={(~hh).sum():,}: R²={r2_new:.4f}   ← 새 창업 자리의 현실 성능\n")

    # Test D: 2분기 앞 예측 (lag2 만 사용 가능한 행)
    X2 = Xstruct.copy()
    X2["PREV2Q_REVENUE"] = lag2.fillna(lag2.median())
    valid2 = lag2.notna().values
    tr2 = tr & valid2
    te2 = te & valid2
    if te2.sum() > 0:
        m2 = lgbm(); m2.fit(X2[tr2], y[tr2]); p2 = m2.predict(X2[te2])
        r2_2q = r2_score(y[te2], p2)
        print("④ 2분기 앞 예측 (더 어려운 시나리오)")
        print(f"    R²={r2_2q:.4f} (n={te2.sum():,})   ← 멀리 볼수록 떨어지는지\n")

    print("=== 해석 가이드 ===")
    print("· ①≈② 이고 ②의 lag만≈전체 → 모델은 사실상 '지난분기 복사'(관성). 새 정보 거의 없음.")
    print("· ③ 신규 R² 이 낮음 → lag 모델은 '기존 상권' 전용, 새 창업엔 구조모델 필요.")
    print("· ④ 가 ①보다 크게 낮음 → 1분기 앞만 잘 되고 그 이상은 약함.")


if __name__ == "__main__":
    main()
