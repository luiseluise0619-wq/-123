#!/usr/bin/env python3
"""
좌표 기반 입지 피처가 신규 자리 예측(공간 홀드아웃) R² 를 올리나?
외부 데이터/키 없이, 우리 상권 좌표(EPSG:5181, 미터)만으로 기하 피처 생성.

피처:
  GEO_dist_center   : 서울 중심(전 상권 무게중심)까지 거리
  GEO_dist_dev      : 가장 가까운 발달상권(D)까지 거리
  GEO_dist_subway   : 가장 가까운 '지하철 있는 상권'까지 거리 (역세권 근접)
  GEO_density_1km   : 반경 1km 내 상권 수 (상권 집적)

실행:
    export USE_REAL_DATA=true
    python test_location.py
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
GEO_COLS = ["GEO_dist_center", "GEO_dist_dev", "GEO_dist_subway", "GEO_density_1km"]
SAMPLE_N = 80_000


def build_geo(df):
    """상권 단위 기하 피처 계산 후 df 에 병합 (TRDAR_CD 기준)."""
    z = df.drop_duplicates("TRDAR_CD").copy()
    x = pd.to_numeric(z["XCNTS_VALUE"], errors="coerce").values
    y = pd.to_numeric(z["YDNTS_VALUE"], errors="coerce").values
    ok = np.isfinite(x) & np.isfinite(y)
    z = z[ok].copy(); x = x[ok]; y = y[ok]
    P = np.column_stack([x, y]).astype(float)  # EPSG:5181, 미터

    # 무게중심까지 거리
    center = P.mean(axis=0)
    dist_center = np.linalg.norm(P - center, axis=1)

    # 발달상권(D) / 지하철 있는 상권 좌표
    se = z["TRDAR_SE_CD"].astype(str).values
    subway = pd.to_numeric(z.get("SUBWAY_STATN_CO", pd.Series(0, index=z.index)), errors="coerce").fillna(0).values
    dev_P = P[se == "D"]
    sub_P = P[subway > 0]

    def nearest(P_all, P_ref):
        if len(P_ref) == 0:
            return np.full(len(P_all), np.nan)
        # 1650^2 규모라 브로드캐스트로 충분
        d = np.sqrt(((P_all[:, None, :] - P_ref[None, :, :]) ** 2).sum(2))
        np.fill_diagonal(d, np.inf) if P_all.shape == P_ref.shape else None
        return d.min(axis=1)

    dist_dev = nearest(P, dev_P)
    dist_sub = nearest(P, sub_P)

    # 반경 1km 내 상권 수
    D = np.sqrt(((P[:, None, :] - P[None, :, :]) ** 2).sum(2))
    density = ((D > 0) & (D <= 1000)).sum(axis=1)

    z["GEO_dist_center"] = dist_center
    z["GEO_dist_dev"] = dist_dev
    z["GEO_dist_subway"] = dist_sub
    z["GEO_density_1km"] = density
    return df.merge(z[["TRDAR_CD"] + GEO_COLS], on="TRDAR_CD", how="left")


def build(df, include_geo):
    cols = {}
    for c in df.columns:
        if c in TGT or c in KEYS or c in NAMES:
            continue
        if LEAK in c.upper():
            continue
        if (not include_geo) and c in GEO_COLS:
            continue
        if c in CATS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            v = pd.to_numeric(df[c], errors="coerce")
            if v.notna().sum() > 0:
                cols[c] = v
    return pd.DataFrame(cols, index=df.index).replace([np.inf, -np.inf], np.nan).fillna(0)


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
    if "XCNTS_VALUE" not in df.columns:
        print("좌표 컬럼(XCNTS_VALUE) 없음. add_services.py 로 영역-상권을 먼저 붙이세요.")
        sys.exit(1)
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    df = df[stor.fillna(0) > 0].reset_index(drop=True)
    df = build_geo(df)
    if len(df) > SAMPLE_N:
        df = df.sample(SAMPLE_N, random_state=42).reset_index(drop=True)
    stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
    y = (df["target_monthly_revenue"].astype(float) / stor).reset_index(drop=True)
    groups = df["TRDAR_CD"].astype(str)

    print(f"\n{'='*56}\n좌표 기반 입지 피처 효과 (공간 홀드아웃 5-fold, n={len(df):,})\n{'='*56}")
    print(f"입지 피처: {GEO_COLS}\n")
    r0, s0, a0 = spatial(build(df, False), y, groups)
    print(f"① 입지 없이 : R²={r0:.4f} ± {s0:.3f} | ±30%={a0:.1%}")
    r1, s1, a1 = spatial(build(df, True), y, groups)
    print(f"② 입지 포함 : R²={r1:.4f} ± {s1:.3f} | ±30%={a1:.1%}")
    print(f"\n→ 효과: R² {r1 - r0:+.4f}, ±30% {a1 - a0:+.1%}")
    print("  ✅ 도움" if r1 - r0 >= 0.01 else "  ⚠️ 미미 (좌표는 이미 X/Y로 모델에 있어 겹칠 수 있음)")


if __name__ == "__main__":
    main()
