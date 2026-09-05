#!/usr/bin/env python3
"""
포워드 피처 선택 — 변수를 하나씩 넣고 검사, 또 넣고 검사.

기준: 공간 홀드아웃(처음 보는 상권) R². 신규 창업 자리 예측 성능.
1) 단일변수 랭킹: 각 변수 하나만으로 R²
2) 탐욕적 누적: 가장 많이 올리는 변수부터 하나씩 추가, R²곡선

실행:
    export USE_REAL_DATA=true
    python forward_select.py
"""

import os
import sys

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import GroupShuffleSplit

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.real_data_pipeline import real_data_pipeline  # noqa: E402

LEAK = "SELNG"
KEYS = {"STDR_YYQU_CD", "TRDAR_CD"}
NAMES = {"TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM",
         "SIGNGU_CD_NM", "ADSTRD_CD_NM", "TRDAR_CHNGE_IX_NM"}
TGT = {"target_monthly_revenue", "monthly_revenue_actual"}
CATS = {"SVC_INDUTY_CD", "TRDAR_SE_CD", "SIGNGU_CD", "ADSTRD_CD", "TRDAR_CHNGE_IX"}

SAMPLE_N = 40_000       # 탐색 속도용 표본
SEARCH_TREES = 120
TOP_CANDIDATES = 25     # 단일랭킹 상위 몇 개로 누적탐색
MAX_FEATURES = 15
MIN_GAIN = 0.002        # 이보다 적게 오르면 멈춤


def num(df, c):
    return pd.to_numeric(df[c], errors="coerce") if c in df.columns else None


def build_candidates(df):
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
    X = pd.DataFrame(cols, index=df.index)
    # 엔지니어링 비율 피처 (규모 정규화)
    stor, rep = num(df, "STOR_CO"), num(df, "TOT_REPOP_CO")
    sim, frc = num(df, "SIMILR_INDUTY_STOR_CO"), num(df, "FRC_STOR_CO")
    opb, cls = num(df, "OPBIZ_RT"), num(df, "CLSBIZ_RT")
    exp, flp = num(df, "EXPNDTR_TOTAMT"), num(df, "TOT_FLPOP_CO")
    wrc = num(df, "TOT_WRC_POPLTN_CO")
    if stor is not None and rep is not None: X["ENG_comp_density"] = stor / (rep + 1)
    if sim is not None and stor is not None: X["ENG_similar_ratio"] = sim / (stor + 1)
    if frc is not None and stor is not None: X["ENG_franchise_ratio"] = frc / (stor + 1)
    if opb is not None and cls is not None: X["ENG_net_open"] = opb - cls
    if exp is not None and rep is not None: X["ENG_spend_per_capita"] = exp / (rep + 1)
    if flp is not None and rep is not None: X["ENG_flow_per_resident"] = flp / (rep + 1)
    if wrc is not None and rep is not None: X["ENG_worker_ratio"] = wrc / (rep + 1)
    return X.fillna(0)


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

    X = build_candidates(df)
    # 고정 공간 분할(상권 80/20)로 탐색 속도 확보
    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    tri, tei = next(gss.split(X, y, groups))
    yl_tr = np.log1p(y.iloc[tri])  # 매출 우편향 → log 학습

    def evalset(feats):
        m = LGBMRegressor(n_estimators=SEARCH_TREES, learning_rate=0.03, num_leaves=31,
                          random_state=42, verbose=-1)
        m.fit(X.iloc[tri][feats], yl_tr)
        pred = np.expm1(m.predict(X.iloc[tei][feats]))
        return r2_score(y.iloc[tei], pred)

    feats_all = list(X.columns)
    print(f"\n{'='*60}\n포워드 선택 (공간 홀드아웃, n={len(df):,}, 후보 {len(feats_all)}개)\n{'='*60}")

    # 1) 단일 변수 랭킹
    print("\n[1] 단일변수 R² 랭킹 (각 변수 하나만)")
    single = sorted(((f, evalset([f])) for f in feats_all), key=lambda x: -x[1])
    for f, r in single[:20]:
        print(f"    {r:>7.4f}  {f}")

    # 2) 탐욕적 누적 (상위 후보에서)
    pool = [f for f, _ in single[:TOP_CANDIDATES]]
    print(f"\n[2] 탐욕적 누적 (상위 {len(pool)}개에서 하나씩 추가)")
    chosen, cur = [], -1e9
    while len(chosen) < MAX_FEATURES and pool:
        best_f, best_r = None, cur
        for f in pool:
            r = evalset(chosen + [f])
            if r > best_r:
                best_r, best_f = r, f
        if best_f is None or best_r - cur < MIN_GAIN:
            print(f"    (개선 < {MIN_GAIN} → 중단)")
            break
        chosen.append(best_f); pool.remove(best_f)
        print(f"    +{best_f:<24} → R²={best_r:.4f}  (Δ{best_r - cur:+.4f})")
        cur = best_r

    print(f"\n{'='*60}")
    print(f"최종 선택 {len(chosen)}개: {chosen}")
    print(f"최종 공간홀드아웃 R²(log,고정분할) = {cur:.4f}")
    print("→ 이 피처셋을 train.py 에 반영. 더 올리려면 새 데이터(아파트/상권변화지표/임대료).")


if __name__ == "__main__":
    main()
