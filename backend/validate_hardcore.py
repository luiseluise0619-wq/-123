#!/usr/bin/env python3
"""
하드코어 검증 — lag/구조 모델을 냉혹하게 조진다.

실행:
    export USE_REAL_DATA=true
    python validate_hardcore.py

포함: 과적합 갭 / 공간 홀드아웃(처음 보는 상권) / 셔플타겟 누수탐지 /
      ±% 정확도 / 최악 업종 구간 / 순열 중요도.
전처리는 투명성을 위해 스크립트 안에서 직접 수행.
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


def lgbm():
    return LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31,
                         random_state=42, verbose=-1)


def within_pct(y_true, y_pred, pct):
    y_true = np.asarray(y_true, float)
    y_pred = np.asarray(y_pred, float)
    ok = np.abs(y_pred - y_true) <= pct * np.abs(y_true)
    return float(ok.mean())


def main():
    df = real_data_pipeline.load_real_dataset()
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)

    q = df["STDR_YYQU_CD"].astype(str)
    trdar = df["TRDAR_CD"].astype(str)
    induty = df["SVC_INDUTY_CD"].astype(str)
    grp = trdar + "_" + induty

    base = pd.DataFrame({"y": y.values, "q": q.values, "grp": grp.values}, index=df.index)
    s = base.sort_values(["grp", "q"])
    lag1 = s.groupby("grp")["y"].shift(1).reindex(df.index)

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

    tq = sorted(q.unique())[-1]
    tr, te = (q < tq).values, (q == tq).values

    print(f"\n{'='*60}\n하드코어 검증 (테스트 분기={tq})\n{'='*60}")

    # ⑤ 과적합 갭
    print("\n⑤ 과적합 갭 (train R² vs test R²)")
    for name, X in [("구조모델", Xstruct), ("lag모델", Xfull)]:
        m = lgbm(); m.fit(X[tr], y[tr])
        r2_tr = r2_score(y[tr], m.predict(X[tr]))
        r2_te = r2_score(y[te], m.predict(X[te]))
        flag = "  ⚠️ 과적합 의심" if (r2_tr - r2_te) > 0.15 else "  ✅ 정상"
        print(f"    {name}: train={r2_tr:.3f} test={r2_te:.3f} 갭={r2_tr - r2_te:.3f}{flag}")

    # ⑥ 공간 홀드아웃 — 처음 보는 상권 (구조모델 = 새 자리 성능)
    print("\n⑥ 공간 홀드아웃: 처음 보는 상권으로 테스트 (GroupKFold=5, 구조모델)")
    gkf = GroupKFold(n_splits=5)
    r2s = []
    for tri, tei in gkf.split(Xstruct, y, groups=trdar):
        m = lgbm(); m.fit(Xstruct.iloc[tri], y.iloc[tri])
        r2s.append(r2_score(y.iloc[tei], m.predict(Xstruct.iloc[tei])))
    print(f"    R²={np.mean(r2s):.4f} ± {np.std(r2s):.4f}   ← 진짜 '새 창업 자리' 성능")

    # ⑦ 셔플 타겟 누수 탐지
    print("\n⑦ 셔플 타겟 누수 탐지 (정답 섞고 학습 → R²≈0 이어야 정상)")
    rng = np.random.default_rng(42)
    y_shuf = pd.Series(rng.permutation(y.values), index=y.index)
    m = lgbm(); m.fit(Xfull[tr], y_shuf[tr])
    r2_shuf = r2_score(y_shuf[te], m.predict(Xfull[te]))
    flag = "  ⚠️ 누수 의심!" if abs(r2_shuf) > 0.05 else "  ✅ 누수 없음"
    print(f"    셔플 R²={r2_shuf:.4f}{flag}")

    # ⑧ ±% 정확도 (사업적으로 와닿는 지표)
    print("\n⑧ ±% 정확도 (예측이 실제의 오차범위 안에 드는 비율)")
    for name, X in [("구조모델", Xstruct), ("lag모델", Xfull)]:
        m = lgbm(); m.fit(X[tr], y[tr]); p = m.predict(X[te])
        print(f"    {name}: ±20%={within_pct(y[te], p, .2):.1%}  "
              f"±30%={within_pct(y[te], p, .3):.1%}  ±50%={within_pct(y[te], p, .5):.1%}")

    # ⑨ 최악 업종 구간
    print("\n⑨ 최악 업종 구간 (lag모델, 테스트셋에서 R² 낮은 업종 5개)")
    m = lgbm(); m.fit(Xfull[tr], y[tr]); pred = m.predict(Xfull[te])
    te_df = pd.DataFrame({"induty": induty[te].values, "y": y[te].values, "p": pred})
    rows = []
    for name, gdf in te_df.groupby("induty"):
        if len(gdf) >= 100:
            rows.append((name, r2_score(gdf["y"], gdf["p"]), len(gdf)))
    worst = sorted(rows, key=lambda r: r[1])[:5]
    for name, r2v, n in worst:
        print(f"    업종 {name}: R²={r2v:.3f} (n={n:,})")

    # ⑩ 순열 중요도 (top5) — 셔플 시 R² 하락폭
    print("\n⑩ 순열 중요도 (lag모델 top5, 값 섞으면 R² 얼마나 떨어지나)")
    m = lgbm(); m.fit(Xfull[tr], y[tr])
    base_r2 = r2_score(y[te], m.predict(Xfull[te]))
    Xte = Xfull[te].reset_index(drop=True)
    yte = y[te].reset_index(drop=True)
    drops = []
    for col in Xfull.columns:
        Xp = Xte.copy()
        Xp[col] = rng.permutation(Xp[col].values)
        drops.append((col, base_r2 - r2_score(yte, m.predict(Xp))))
    for col, d in sorted(drops, key=lambda x: -x[1])[:5]:
        print(f"    {col}: -{d:.4f}")

    print(f"\n{'='*60}\n해석: ⑥가 낮으면 새자리 예측 한계 / ⑦ 0아니면 누수 / "
          f"⑧로 실사용 정확도 / ⑩로 진짜 중요변수 확인\n{'='*60}")


if __name__ == "__main__":
    main()
