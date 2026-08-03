import os
import pickle
import json
import shap
import pandas as pd
import numpy as np
from lightgbm import LGBMRegressor, LGBMClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_absolute_error
from app.core.config import settings
from app.data.real_data_pipeline import real_data_pipeline
from app.ml.data_processing import FEATURE_NAMES
from app.ml.feature_selection import FeatureSelectionEngine
from app.ml.evaluate import ModelEvaluator

# 실데이터에서 타겟(매출) 자신을 구성하는 컬럼 = 누수. 이름에 SELNG 이 들어간 것은 전부 제외.
REAL_LEAKY_SUBSTR = ("SELNG",)
REAL_TARGET_COLS = ("target_monthly_revenue", "monthly_revenue_actual")
REAL_KEY_COLS = ("STDR_YYQU_CD", "TRDAR_CD")
REAL_NAME_COLS = ("TRDAR_CD_NM", "SVC_INDUTY_CD_NM", "TRDAR_SE_CD_NM",
                  "SIGNGU_CD_NM", "ADSTRD_CD_NM", "TRDAR_CHNGE_IX_NM")
# 범주형(라벨인코딩): 업종/상권구분/자치구/행정동/상권변화등급
REAL_CAT_COLS = ("SVC_INDUTY_CD", "TRDAR_SE_CD", "SIGNGU_CD", "ADSTRD_CD", "TRDAR_CHNGE_IX")


def _prepare_synthetic(df):
    """합성/시드 데이터: 기존 방식(FEATURE_NAMES + 사전 타겟)."""
    target_cols = ["target_monthly_revenue", "target_success_label", "target_closure_risk"]
    df = df.dropna(subset=target_cols).reset_index(drop=True)
    X_raw = df[[f for f in FEATURE_NAMES if f in df.columns]]
    y_revenue = df["target_monthly_revenue"]
    y_success = df["target_success_label"].astype(int)
    y_risk = df["target_closure_risk"].astype(int)
    return df, X_raw, y_revenue, y_success, y_risk


def _prepare_real(df):
    """
    실제 서울 상권분석 데이터: 컬럼명이 다르므로 직접 처리.
      - 타겟: target_monthly_revenue (빌더가 THSMON_SELNG_AMT 로 생성)
      - 누수 제거: 이름에 SELNG 포함(매출=타겟) 컬럼 전부 제외
      - 변수: 남은 숫자형 + 업종/상권구분 라벨인코딩 ("다 넣고" 전략)
      - 성공/폐업 라벨: 원본에 없으므로 매출 분위로 파생(정직히 '파생 프록시'로 표기)
    """
    if "target_monthly_revenue" not in df.columns:
        raise RuntimeError(
            "target_monthly_revenue 컬럼이 없습니다. build_seoul_dataset.py --build 로 "
            "매출(THSMON_SELNG_AMT) 기반 타겟을 먼저 생성하세요."
        )
    df = df.dropna(subset=["target_monthly_revenue"]).reset_index(drop=True)

    # 타겟 선택: 기본은 상권×업종 '총매출'.
    #  TARGET_PER_STORE=true 면 '점포당 평균매출'(총매출/점포수)로 바꿔 규모 tautology 제거
    #  → "이 자리 점포 하나가 얼마 벌까"를 예측(소상공인 관점).
    target_per_store = os.getenv("TARGET_PER_STORE", "false").lower() == "true"
    if target_per_store and "STOR_CO" in df.columns:
        stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
        df = df[stor.fillna(0) > 0].reset_index(drop=True)
        stor = pd.to_numeric(df["STOR_CO"], errors="coerce")
        y_revenue = df["target_monthly_revenue"].astype(float) / stor
        print("[Prepare] TARGET_PER_STORE=true → 타겟=점포당 평균매출(총매출/점포수). 규모 tautology 제거.")
    else:
        y_revenue = df["target_monthly_revenue"].astype(float)

    # lag 피처: 같은 상권×업종의 '전분기 매출'. 미래 예측 시점에 이미 아는 값이라 누수 아님.
    #  패널데이터에서 보통 가장 효과 큰 단일 피처. ADD_LAG=true 로 활성화.
    lag_series = None
    if os.getenv("ADD_LAG", "false").lower() == "true" and {"TRDAR_CD", "SVC_INDUTY_CD"}.issubset(df.columns):
        g = pd.DataFrame(
            {"y": y_revenue.values,
             "q": df["STDR_YYQU_CD"].astype(str).values,
             "grp": (df["TRDAR_CD"].astype(str) + "_" + df["SVC_INDUTY_CD"].astype(str)).values},
            index=df.index,
        ).sort_values(["grp", "q"])
        g["lag"] = g.groupby("grp")["y"].shift(1)
        lag_series = g["lag"].reindex(df.index)  # 원래 순서로 복원
        print("[Prepare] ADD_LAG=true → 전분기 매출(PREV_Q_REVENUE) 피처 추가.")

    # 소비(지출)는 매출과 near-tautology(준누수)라 정직한 구조 성능 측정 시 제외 가능.
    exclude_spend = os.getenv("EXCLUDE_SPEND", "false").lower() == "true"
    cols = {}  # dict 로 모아 한 번에 DataFrame 생성 (fragmentation 경고 방지)
    for c in df.columns:
        if c in REAL_TARGET_COLS or c in REAL_KEY_COLS or c in REAL_NAME_COLS:
            continue
        if any(s in c.upper() for s in REAL_LEAKY_SUBSTR):
            continue  # 매출 구성요소 = 타겟 누수
        if exclude_spend and "EXPNDTR" in c.upper():
            continue  # ablation: 소비지출 제외
        if c in REAL_CAT_COLS:
            cols[c + "_ENC"] = df[c].astype("category").cat.codes
        else:
            col = pd.to_numeric(df[c], errors="coerce")
            if col.notna().sum() > 0:
                cols[c] = col
    if lag_series is not None:
        cols["PREV_Q_REVENUE"] = lag_series.fillna(lag_series.median())
    X_raw = pd.DataFrame(cols, index=df.index).fillna(0)
    if exclude_spend:
        print("[Prepare] EXCLUDE_SPEND=true → 소비지출(EXPNDTR) 피처 제외 (정직 성능 측정)")

    # 파생 라벨 (실데이터엔 성공/폐업 정답이 없음 → 매출 분위 기반 프록시)
    y_success = (y_revenue > y_revenue.median()).astype(int)
    q_low, q_high = y_revenue.quantile([0.33, 0.66])
    y_risk = pd.Series(
        np.where(y_revenue <= q_low, 2, np.where(y_revenue <= q_high, 1, 0)),
        index=df.index,
    ).astype(int)
    print("[Prepare] 성공/폐업 라벨은 실데이터에 없어 매출 분위로 파생한 프록시입니다(매출 회귀가 핵심 예측기).")
    return df, X_raw, y_revenue, y_success, y_risk


def prepare_training_frame(df, provenance):
    if provenance == "real_public_data":
        return _prepare_real(df)
    return _prepare_synthetic(df)


def time_series_cv(X, y, quarters, n_folds=5):
    """
    확장 윈도우 시계열 교차검증: '과거 전부로 학습 → 다음 분기로 테스트'를 여러 번 반복.
    최신 n_folds 개 분기를 각각 테스트로 삼아 R² 를 여러 번 측정한다(단일 분할의 운 문제 완화).
    분기코드(YYYYQ)는 문자열 정렬이 곧 시간순이므로 문자열 비교로 과거/미래를 가른다.
    """
    uq = sorted(quarters.unique())
    if len(uq) < 3:
        return []  # 분기가 너무 적으면 CV 불가
    test_qs = uq[-n_folds:] if len(uq) > n_folds else uq[1:]
    folds = []
    for tq in test_qs:
        tr = (quarters < tq).values
        te = (quarters == tq).values
        if tr.sum() == 0 or te.sum() == 0:
            continue
        m = LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=31,
                          random_state=42, verbose=-1)
        m.fit(X[tr], y[tr])
        pred = m.predict(X[te])
        folds.append({
            "test_quarter": tq,
            "r2": round(float(r2_score(y[te], pred)), 4),
            "mae": round(float(mean_absolute_error(y[te], pred)), 1),
            "n_test": int(te.sum()),
        })
    return folds


def train_and_register_models():
    print("[ML Pipeline] Loading commercial dataset CSV...")
    df = real_data_pipeline.load_real_dataset()
    data_provenance = real_data_pipeline.data_provenance
    print(f"Loaded {len(df):,} records (data_provenance={data_provenance}).")
    if data_provenance != "real_public_data":
        print(
            "[경고] 현재 데이터는 실제 공공데이터가 아닙니다(합성/시드 데이터). "
            "아래 성능 지표는 실제 상권 예측 성능을 보장하지 않습니다."
        )

    df, X_raw, y_revenue, y_success, y_risk = prepare_training_frame(df, data_provenance)
    print(f"[Prepare] 후보 변수 {X_raw.shape[1]}개")

    print("[Feature Selection] Selecting top influential features via Mutual Information...")
    # 대용량이면 표본으로 선택(속도), 학습은 전량으로.
    sel_X = X_raw.sample(n=min(50000, len(X_raw)), random_state=42)
    sel_y = y_revenue.loc[sel_X.index]
    selected_features = FeatureSelectionEngine.select_top_features(sel_X, sel_y, top_k=min(18, X_raw.shape[1]))
    print(f"Selected {len(selected_features)} features: {selected_features}")

    X = X_raw[selected_features]

    # Train/Test Split.
    #  실데이터(분기 STDR_YYQU_CD 존재)면 '시간 기반 분할'을 쓴다:
    #  과거 분기로 학습 -> 최신 분기로 테스트 (실제 미래 예측 상황과 동일, 정직한 성능).
    #  무작위 분할은 같은 상권이 학습/테스트에 동시에 들어가 성능을 과대평가한다.
    if "STDR_YYQU_CD" in df.columns and df["STDR_YYQU_CD"].astype(str).nunique() > 1:
        # 시간순 유지(누수 방지)하면서 최신 분기들을 모아 테스트 ≈ 20% 가 되게 한다.
        qcol = df["STDR_YYQU_CD"].astype(str)
        counts = qcol.value_counts()
        n_total = len(df)
        test_quarters, cum = [], 0
        for q in sorted(counts.index, reverse=True):  # 최신 분기부터 담기
            test_quarters.append(q)
            cum += int(counts[q])
            if cum >= 0.20 * n_total:
                break
        test_mask = qcol.isin(test_quarters).values
        test_frac = float(test_mask.mean())
        split_method = f"time_holdout(test_quarters={sorted(test_quarters)}, test={test_frac:.1%})"
        print(f"[Split] 시간기반 분할 → 테스트=최신분기 {sorted(test_quarters)} | "
              f"train={int((~test_mask).sum()):,} ({1 - test_frac:.0%}), "
              f"test={int(test_mask.sum()):,} ({test_frac:.0%})")
        X_train, X_test = X[~test_mask], X[test_mask]
        y_rev_train, y_rev_test = y_revenue[~test_mask], y_revenue[test_mask]
        y_suc_train, y_suc_test = y_success[~test_mask], y_success[test_mask]
        y_risk_train, y_risk_test = y_risk[~test_mask], y_risk[test_mask]
    else:
        split_method = "random_80_20"
        print("[Split] 무작위 80/20 분할 (분기 정보 없음 — 합성/시드 데이터)")
        X_train, X_test, y_rev_train, y_rev_test = train_test_split(X, y_revenue, test_size=0.2, random_state=42)
        _, _, y_suc_train, y_suc_test = train_test_split(X, y_success, test_size=0.2, random_state=42)
        _, _, y_risk_train, y_risk_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    
    n_records = len(df)

    # 1. Revenue Regressor
    #  Tweedie 목적함수: 매출(양수·우편향)에 제곱오차보다 적합 (공간홀드아웃 실험서 최고).
    print(f"Training LightGBM Revenue Regressor on {n_records:,} records...")
    rev_model = LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3,
                              n_estimators=150, learning_rate=0.03, num_leaves=31,
                              random_state=42, verbose=-1)
    rev_model.fit(X_train, y_rev_train)
    rev_metrics = ModelEvaluator.evaluate_regressor(rev_model, X_test, y_rev_test)
    print(f"Revenue Regressor Metrics: {rev_metrics}")

    # 시계열 교차검증: 여러 분기로 반복 테스트해 성능 안정성 확인 (단일 분할의 운 문제 완화)
    cv_folds = []
    if "STDR_YYQU_CD" in df.columns and df["STDR_YYQU_CD"].astype(str).nunique() >= 3:
        cv_folds = time_series_cv(X, y_revenue, df["STDR_YYQU_CD"].astype(str), n_folds=5)
        if cv_folds:
            r2s = [f["r2"] for f in cv_folds]
            print(f"[CV] 시계열 교차검증 {len(cv_folds)}회:")
            for f in cv_folds:
                print(f"     테스트 {f['test_quarter']}: R²={f['r2']} | MAE={f['mae']:,} (n={f['n_test']:,})")
            print(f"[CV] 평균 R²={np.mean(r2s):.4f} ± {np.std(r2s):.4f} "
                  f"(min={min(r2s):.4f}, max={max(r2s):.4f})")

    # 2. Success Classifier
    print(f"Training LightGBM Success Classifier on {n_records:,} records...")
    suc_model = LGBMClassifier(n_estimators=120, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    suc_model.fit(X_train, y_suc_train)
    suc_metrics = ModelEvaluator.evaluate_classifier(suc_model, X_test, y_suc_test)
    print(f"Success Classifier Metrics: {suc_metrics}")

    # 3. Closure Risk Classifier
    print(f"Training LightGBM Closure Risk Classifier on {n_records:,} records...")
    risk_model = LGBMClassifier(n_estimators=120, learning_rate=0.03, num_leaves=31, random_state=42, verbose=-1)
    risk_model.fit(X_train, y_risk_train)
    risk_metrics = ModelEvaluator.evaluate_classifier(risk_model, X_test, y_risk_test)
    print(f"Risk Classifier Metrics: {risk_metrics}")
    
    # 4. SHAP Explainer
    print("Building SHAP TreeExplainer on trained model...")
    shap_explainer = shap.TreeExplainer(rev_model)
    
    # Create Registry Folder
    os.makedirs(settings.MODEL_DIR, exist_ok=True)
    
    artifacts = {
        "revenue_model.pkl": rev_model,
        "success_model.pkl": suc_model,
        "risk_model.pkl": risk_model,
        "shap_explainer.pkl": shap_explainer,
    }
    
    for filename, obj in artifacts.items():
        filepath = os.path.join(settings.MODEL_DIR, filename)
        with open(filepath, "wb") as f:
            pickle.dump(obj, f)
            
    metadata = {
        "version": "v2.0-production-seed",
        "data_source": f"commercial dataset CSV ({len(df):,} records)",
        "data_provenance": data_provenance,  # real_public_data | synthetic | seed_sample
        "is_real_public_data": data_provenance == "real_public_data",
        "split_method": split_method,
        "labels_note": (
            "success/risk are revenue-quantile proxies (real 성공/폐업 labels unavailable)"
            if data_provenance == "real_public_data"
            else "labels from dataset"
        ),
        "trained_at": "2026-07-31",
        "total_training_records": len(df),
        "selected_features": selected_features,
        "revenue_metrics": rev_metrics,
        "success_metrics": suc_metrics,
        "risk_metrics": risk_metrics,
        "cv_time_series": cv_folds,
        "cv_mean_r2": round(float(np.mean([f["r2"] for f in cv_folds])), 4) if cv_folds else None,
        "cv_std_r2": round(float(np.std([f["r2"] for f in cv_folds])), 4) if cv_folds else None,
    }
    
    meta_path = os.path.join(settings.MODEL_DIR, "metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
        
    provenance_warning = (
        ""
        if data_provenance == "real_public_data"
        else "\n> ⚠️ **주의**: 학습 데이터가 실제 공공데이터가 아닌 **합성/시드 데이터**입니다. "
        "아래 지표는 실제 상권 예측 성능을 보장하지 않으며, 실제 공공데이터로 재학습해야 합니다.\n"
    )
    model_card_content = f"""# Model Card: AI Local Intelligence v2.0 ({len(df):,} Records)
{provenance_warning}
- **Data Source**: commercial dataset CSV ({len(df):,} records)
- **Data Provenance**: {data_provenance}
- **Model Type**: LightGBM Multi-Model Ensemble (Regressor + Classifiers)
- **Features Used ({len(selected_features)})**: {', '.join(selected_features)}
- **Revenue Predictor Performance**: RMSE={rev_metrics['rmse']} (Baseline={rev_metrics['baseline_rmse']}, R2={rev_metrics['r2']})
- **Success Rate Classifier Accuracy**: {suc_metrics['accuracy']} (ROC-AUC={suc_metrics['roc_auc']})
- **Closure Risk Classifier Accuracy**: {risk_metrics['accuracy']} (ROC-AUC={risk_metrics['roc_auc']})
"""
    model_card_path = os.path.join(settings.MODEL_DIR, "model_card.md")
    with open(model_card_path, "w", encoding="utf-8") as f:
        f.write(model_card_content)

    print(f"[ML Pipeline] Model Training & Registry Complete! ({len(df):,} records, provenance={data_provenance})")

if __name__ == "__main__":
    train_and_register_models()
