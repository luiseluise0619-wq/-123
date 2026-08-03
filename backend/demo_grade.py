#!/usr/bin/env python3
"""
상권 등급 엔진 데모 — 0.28 모델을 '팔 수 있는 형태'로.

절대 매출액(₩)이 아니라, 점포당 예상매출의 '상위 %·등급(A~E)'과
SHAP 기반 추천/비추천 근거를 출력한다. 이게 실제 제품의 핵심 출력이다.

실행:
    export USE_REAL_DATA=true
    python demo_grade.py
"""

import os
import sys

os.environ.setdefault("TARGET_PER_STORE", "true")  # 점포당 매출 타겟

import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import shap  # noqa: E402
from lightgbm import LGBMRegressor  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.data.real_data_pipeline import real_data_pipeline  # noqa: E402
from app.ml.train import prepare_training_frame  # noqa: E402

# 컬럼 → 사람이 읽는 이름
LABELS = {
    "TOT_FLPOP_CO": "유동인구", "TOT_REPOP_CO": "배후 거주인구", "TOT_WRC_POPLTN_CO": "직장인구",
    "TOT_HSHLD_CO": "배후 세대수", "STOR_CO": "동종 점포수(경쟁)", "SIMILR_INDUTY_STOR_CO": "유사업종 점포수",
    "FRC_STOR_CO": "프랜차이즈 점포수", "OPBIZ_RT": "개업률", "CLSBIZ_RT": "폐업률",
    "SVC_INDUTY_CD_ENC": "업종", "TRDAR_SE_CD_ENC": "상권유형", "SIGNGU_CD_ENC": "자치구",
    "VIATR_FCLTY_CO": "집객시설수", "SUBWAY_STATN_CO": "지하철역수", "RELM_AR": "상권면적",
    "OPR_SALE_MT_AVRG": "평균 영업개월", "CLS_SALE_MT_AVRG": "평균 폐업개월",
    "EXPNDTR_TOTAMT": "배후 소비지출",
}
GRADES = ["E", "D", "C", "B", "A"]


def lab(col):
    for k, v in LABELS.items():
        if col == k or col.startswith(k):
            return v
    return col


def main():
    df = real_data_pipeline.load_real_dataset()
    dfp, X, y, _, _ = prepare_training_frame(df, real_data_pipeline.data_provenance)
    print(f"[등급엔진] 데이터 {len(dfp):,}행 · 피처 {X.shape[1]}개 · 타겟=점포당 매출")

    # 모델 학습 (전량)
    model = LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3,
                          n_estimators=300, learning_rate=0.03, num_leaves=31,
                          random_state=42, verbose=-1)
    model.fit(X, y)
    pred = model.predict(X)

    # 예측값 → 백분위 → 등급
    pct = pd.Series(pred).rank(pct=True).values
    grade = pd.cut(pct, [0, .2, .4, .6, .8, 1.01], labels=GRADES, right=False)

    explainer = shap.TreeExplainer(model)

    # 예시 상권 몇 개 (이름에 키워드 포함 + 커피업종 위주)
    dfp = dfp.reset_index(drop=True)
    picks = []
    for kw in ["성수", "강남", "홍대", "망원", "신림"]:
        cand = dfp.index[(dfp["TRDAR_CD_NM"].astype(str).str.contains(kw)) &
                         (dfp.get("SVC_INDUTY_CD_NM", pd.Series("", index=dfp.index)).astype(str).str.contains("커피"))]
        if len(cand):
            picks.append(cand[0])
    if not picks:
        picks = list(range(3))

    print("\n" + "=" * 60)
    for idx in picks[:5]:
        row = dfp.loc[idx]
        g = grade[idx]
        top_pct = (1 - pct[idx]) * 100
        sv = explainer.shap_values(X.iloc[[idx]])[0]
        contrib = sorted(zip(X.columns, sv), key=lambda t: t[1])
        pos = [c for c in reversed(contrib) if c[1] > 0][:3]
        neg = [c for c in contrib if c[1] < 0][:3]

        name = row.get("TRDAR_CD_NM", row.get("TRDAR_CD"))
        induty = row.get("SVC_INDUTY_CD_NM", "")
        print(f"\n📍 {name} · {induty}")
        print(f"   창업 적합도: 상위 {top_pct:.0f}%  →  {g}등급")
        print(f"   ▲ 강점: " + ", ".join(f"{lab(c)}" for c, _ in pos))
        print(f"   ▼ 약점: " + ", ".join(f"{lab(c)}" for c, _ in neg))
    print("\n" + "=" * 60)
    print("※ 절대 매출액이 아닌 '상대 등급 + 근거'. R² 0.28 로도 성립하는 제품 형태.")


if __name__ == "__main__":
    main()
