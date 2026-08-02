import os
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple
from sklearn.metrics import r2_score, mean_squared_error, accuracy_score, roc_auc_score
from sklearn.model_selection import GroupKFold
from lightgbm import LGBMRegressor, LGBMClassifier
from app.core.config import settings
from app.data.schemas.schema import schema_mapper

LEAKY_FEATURES = ["card_sales_avg", "monthly_revenue_actual", "target_monthly_revenue"]

class LeakageAndValidationAuditor:
    """
    Rigorous Data Leakage & Spatial/Temporal Generalization Auditor.
    1. Detects & removes Target Leakage features (e.g. card_sales_avg).
    2. Runs Time-based Split (Train 2021-2025, Test 2026).
    3. Runs Spatial Group-Holdout (Train 20 Gus, Test 5 unseen Gus).
    4. Compares Random Split vs Honest Spatial/Temporal R2.
    """
    def __init__(self, csv_path: str = None):
        if csv_path is None:
            csv_path = os.path.join(settings.BASE_DIR, "data", "sample_real_data", "seoul_bigdata_multi_thousand_2026.csv")
        self.csv_path = csv_path
        self.raw_df = pd.read_csv(csv_path, encoding="utf-8-sig") if os.path.exists(csv_path) else pd.DataFrame()

    def run_full_audit(self) -> Dict[str, Any]:
        df = schema_mapper.normalize_dataframe(self.raw_df)
        
        # 1. Target Leakage Detection & Feature Sanitization
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        target_col = "monthly_revenue"
        
        corrs = df[numeric_cols].corr()[target_col].drop(target_col, errors="ignore")
        leaky_detected = [col for col, val in corrs.items() if abs(val) >= 0.88 or col in LEAKY_FEATURES]
        
        print(f"[Audit] Target Leakage Audit Detected Leaky Features: {leaky_detected}")
        
        # Sanitize Feature Set (Remove Leaky proxies like card_sales_avg)
        candidate_features = [
            c for c in df.columns 
            if c not in leaky_detected and c not in [target_col, "success_label", "closure_risk", "district_code", "district_name", "dong_name"]
            and pd.api.types.is_numeric_dtype(df[c])
        ]
        
        print(f"[Audit] Clean Non-Leaky Feature Set ({len(candidate_features)} features): {candidate_features}")
        
        X = df[candidate_features]
        y_rev = df[target_col]
        y_suc = df["success_label"] if "success_label" in df.columns else (y_rev > y_rev.median()).astype(int)
        
        # 2. Benchmark A: Naive Random 80/20 Split
        from sklearn.model_selection import train_test_split
        X_tr_rand, X_te_rand, y_tr_rand, y_te_rand = train_test_split(X, y_rev, test_size=0.2, random_state=42)
        model_rand = LGBMRegressor(n_estimators=100, learning_rate=0.03, random_state=42, verbose=-1)
        model_rand.fit(X_tr_rand, y_tr_rand)
        r2_random = round(float(r2_score(y_te_rand, model_rand.predict(X_te_rand))), 4)
        
        # 3. Benchmark B: Time-Based Split (Train: 2022-2025, Test: 2026)
        if "year" in df.columns and len(df[df["year"] == 2026]) > 0:
            train_idx = df["year"] < 2026
            test_idx = df["year"] == 2026
            
            X_tr_time, X_te_time = X[train_idx], X[test_idx]
            y_tr_time, y_te_time = y_rev[train_idx], y_rev[test_idx]
            
            model_time = LGBMRegressor(n_estimators=100, learning_rate=0.03, random_state=42, verbose=-1)
            model_time.fit(X_tr_time, y_tr_time)
            r2_time = round(float(r2_score(y_te_time, model_time.predict(X_te_time))), 4)
            rmse_time = round(float(np.sqrt(mean_squared_error(y_te_time, model_time.predict(X_te_time)))), 2)
        else:
            # 시간 컬럼이 없으면 시간 기반 검증은 '수행 불가'로 정직하게 표기한다.
            # (예전 코드는 r2_random * 0.82 처럼 숫자를 지어냈으나 이는 허위 지표이므로 제거)
            r2_time = None
            rmse_time = None

        # 4. Benchmark C: Region-Based Holdout Split (GroupKFold by Gu)
        r2_spatial_list = []
        if "gu_name" in df.columns:
            gkf = GroupKFold(n_splits=5)
            groups = df["gu_name"]
            
            for tr_idx, te_idx in gkf.split(X, y_rev, groups):
                X_tr_sp, X_te_sp = X.iloc[tr_idx], X.iloc[te_idx]
                y_tr_sp, y_te_sp = y_rev.iloc[tr_idx], y_rev.iloc[te_idx]
                
                model_sp = LGBMRegressor(n_estimators=100, learning_rate=0.03, random_state=42, verbose=-1)
                model_sp.fit(X_tr_sp, y_tr_sp)
                r2_spatial_list.append(r2_score(y_te_sp, model_sp.predict(X_te_sp)))
                
            r2_spatial_mean = round(float(np.mean(r2_spatial_list)), 4)
        else:
            # 지역(구) 컬럼이 없으면 공간 홀드아웃 검증은 '수행 불가'로 표기 (허위 지표 생성 금지).
            r2_spatial_mean = None

        # Baseline Comparison
        baseline_rmse = round(float(np.sqrt(mean_squared_error(y_rev, np.full_like(y_rev, y_rev.mean())))), 2)

        # 정직한 종합 판정: 실제로 수행된 홀드아웃 R2 를 임계값과 비교해 결론을 낸다.
        # (예전 코드는 결과와 무관하게 항상 "운영 가능"이라고 단정했으나 이는 허위 결론이므로 제거)
        verdict = self._make_verdict(r2_time, r2_spatial_mean)

        audit_results = {
            "leaky_features_detected": leaky_detected,
            "clean_features_used": candidate_features,
            "random_split_r2": r2_random,
            "time_holdout_r2": r2_time,
            "time_holdout_rmse": rmse_time,
            "spatial_region_holdout_r2": r2_spatial_mean,
            "baseline_mean_rmse": baseline_rmse,
            "verdict": verdict,
            "audit_summary": (
                f"Leaky features removed: {leaky_detected}. "
                f"Time-holdout R2={r2_time}, Spatial-holdout R2={r2_spatial_mean}. "
                f"Verdict: {verdict}"
            ),
        }

        # 5. Export Production Metric Report Markdown
        self._export_production_metric_report(audit_results)
        return audit_results

    @staticmethod
    def _make_verdict(r2_time, r2_spatial) -> str:
        """실제 홀드아웃 R2 를 근거로 정직한 판정을 반환한다. 지어낸 결론 금지."""
        available = [r for r in (r2_time, r2_spatial) if r is not None]
        if not available:
            return "INCONCLUSIVE (시간/지역 홀드아웃을 수행할 데이터가 없어 일반화 성능 미검증)"
        worst = min(available)
        if worst >= 0.6:
            return "USABLE (미관측 홀드아웃에서 안정적 일반화 확인)"
        if worst >= 0.3:
            return "WEAK (일반화 성능 제한적 — 실서비스 전 데이터/피처 보강 필요)"
        return "NOT_USABLE (미관측 상권 일반화 실패 — 예측을 의사결정 근거로 쓰면 안 됨)"

    @staticmethod
    def _fmt(value, suffix: str = "") -> str:
        return "N/A (미수행)" if value is None else f"{value}{suffix}"

    def _export_production_metric_report(self, results: Dict[str, Any]):
        report_md = f"""# Production Model Reliability & Data Leakage Audit Report

본 보고서는 **AI Local Intelligence 예측 모델**의 **Data Leakage(타겟 누수) 탐지 및 시공간(Spatial/Temporal) 일반화 성능 검증 결과**입니다.

> ⚠️ **데이터 출처 고지**: 현재 학습/검증 데이터는 통계 분포로 생성한 **합성(synthetic) 데이터**이며 실제 공공데이터가 아닙니다. 아래 지표는 합성 데이터 기준이므로 **실제 상권 예측 성능을 보장하지 않습니다.** 실제 공공데이터로 재학습한 뒤 지표를 다시 산출해야 합니다.

---

## 🚫 1. Data Leakage (타겟 누수) 탐지 및 조치 결과
- **탐지된 누수 변수 (Eliminated Leaky Features)**: `{', '.join(results['leaky_features_detected']) or '없음'}`
  - *사유*: `card_sales_avg` (평균 카드매출액) 등 타겟변수(`monthly_revenue`)와 사실상 동등한 수치는 실제 미래 창업 시점에는 존재하지 않는 정보이므로 $X$ 입력에서 제거함.
- **정제된 무누수 예측 변수 (Clean Features)**: {len(results['clean_features_used'])}개 변수

---

## 🔬 2. 분할 방식별 실제 R² 검증 비교 (Validation Comparison)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. Random 80/20 Split R² (무작위 분할 - 공간 누수 가능성 존재)                 │
│    - R² : {self._fmt(results['random_split_r2'])}
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. Time-Based Out-of-Time Holdout R² (과거 학습 ➔ 2026 미래 테스트)           │
│    - R² : {self._fmt(results['time_holdout_r2'])} (RMSE: {self._fmt(results['time_holdout_rmse'], '만원')})
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. Region-Based Group Holdout R² (관측 자치구 학습 ➔ 미관측 자치구 평가)       │
│    - R² : {self._fmt(results['spatial_region_holdout_r2'])}
└──────────────────────────────────────────────────────────────────────────────┘
```

*N/A(미수행)* 은 해당 분할에 필요한 컬럼(year/gu_name)이 데이터에 없어 검증을 실제로 수행하지 못했음을 뜻합니다. (지표를 임의로 지어내지 않습니다.)

---

## 💡 3. 최종 결론 및 모델 신뢰도 종합 판정
- **판정(Verdict): {results['verdict']}**
- 시간 미관측 테스트 $R^2$ = {self._fmt(results['time_holdout_r2'])}, 지역 미관측 테스트 $R^2$ = {self._fmt(results['spatial_region_holdout_r2'])}
- 이 판정은 위 홀드아웃 지표를 임계값(≥0.6 사용가능 / ≥0.3 제한적 / 그 외 사용불가)과 비교해 자동 산출되며, 결과와 무관하게 "검증 통과"라고 단정하지 않습니다.
"""
        artifact_dir = os.path.join(settings.BASE_DIR, "..", "..", "brain", "fdede9f2-400d-4223-9c28-f429dba77a87")
        os.makedirs(artifact_dir, exist_ok=True)
        report_path = os.path.join(artifact_dir, "production_metric_report.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report_md)
        print(f"[Audit] Exported production_metric_report.md to {report_path}")

leakage_auditor = LeakageAndValidationAuditor()

if __name__ == "__main__":
    results = leakage_auditor.run_full_audit()
    print("Full Leakage & Spatial/Temporal Audit Completed!")
    print(results)
