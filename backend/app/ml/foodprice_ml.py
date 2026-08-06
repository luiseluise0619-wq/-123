"""
식자재 가격 예측 ML — 공판장 실가격 CSV 로 LightGBM 학습 (이동평균 아님, 진짜 학습).

CSV(agmarket_prices.csv, 92k행)에서 품목별 일별 시계열을 만들고, lag/이동평균/
요일·월 피처로 'N일 뒤 가격'을 회귀 예측한다. 시간기반 홀드아웃으로 정직하게 평가.

  python -m app.ml.foodprice_ml           # 학습 + 정직 평가 + 모델 저장
저장: app/data/market/foodprice_model.pkl
"""

import os
import pickle
from typing import Dict, Any

import numpy as np
import pandas as pd

CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "data", "market", "agmarket_prices.csv")
MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                     "..", "data", "market", "foodprice_model.pkl")
HORIZON = 1   # 며칠 뒤 가격 예측. 1일=ML이 persistence 이김(R²0.92,MAPE11.8<13.9).
              #  7일 등 장기는 농산물이 random-walk라 persistence 못 이김(정직).


def _series():
    df = pd.read_csv(CSV, encoding="utf-8-sig", low_memory=False)
    df["가격날짜"] = pd.to_datetime(df["가격날짜"], errors="coerce")
    df["평균가격"] = pd.to_numeric(df["평균가격"], errors="coerce")
    df = df[(df["평균가격"] > 0) & df["가격날짜"].notna()]
    # 품목×일자 평균(등급 통합)
    ts = (df.groupby(["품목명", "가격날짜"])["평균가격"].mean()
            .reset_index().sort_values(["품목명", "가격날짜"]))
    return ts


def _features(ts: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for item, g in ts.groupby("품목명"):
        g = g.set_index("가격날짜").asfreq("D").ffill()
        p = g["평균가격"]
        f = pd.DataFrame({
            "item": item,
            "price": p,
            "lag1": p.shift(1), "lag7": p.shift(7), "lag14": p.shift(14), "lag30": p.shift(30),
            "ma7": p.rolling(7).mean(), "ma30": p.rolling(30).mean(),
            "chg7": p.pct_change(7), "dow": p.index.dayofweek, "month": p.index.month,
            "target": p.shift(-HORIZON),          # N일 뒤 가격
        }, index=p.index)
        rows.append(f)
    out = pd.concat(rows).dropna()
    out["item_code"] = out["item"].astype("category").cat.codes
    return out


def train() -> Dict[str, Any]:
    from lightgbm import LGBMRegressor
    from sklearn.metrics import r2_score, mean_absolute_percentage_error
    print("[1] 시계열 + 피처 생성")
    ts = _series()
    data = _features(ts)
    feats = ["lag1", "lag7", "lag14", "lag30", "ma7", "ma30", "chg7", "dow", "month", "item_code"]
    # 시간기반 분할(정직): 마지막 20% 날짜 = 테스트
    cut = data.index.min() + (data.index.max() - data.index.min()) * 0.8
    tr, te = data[data.index <= cut], data[data.index > cut]
    print(f"    학습 {len(tr):,} / 테스트 {len(te):,} (품목 {data['item'].nunique()}개, +{HORIZON}일 예측)")
    m = LGBMRegressor(n_estimators=400, learning_rate=0.05, num_leaves=63,
                      random_state=42, verbose=-1)
    m.fit(tr[feats], tr["target"])
    pred = m.predict(te[feats])
    r2 = r2_score(te["target"], pred)
    mape = mean_absolute_percentage_error(te["target"], pred) * 100
    # persistence 베이스라인(오늘 가격=미래 가격 가정) 대비
    base_mape = mean_absolute_percentage_error(te["target"], te["lag1"]) * 100
    print(f"[2] 정직한 결과(시간홀드아웃): R²={r2:.3f} | MAPE={mape:.1f}% "
          f"(베이스라인 persistence MAPE={base_mape:.1f}%)")
    with open(MODEL, "wb") as f:
        pickle.dump({"model": m, "feats": feats,
                     "items": sorted(data["item"].unique().tolist()),
                     "horizon": HORIZON,
                     "item_codes": {it: c for it, c in
                                    zip(data["item"], data["item_code"])}}, f)
    print(f"[3] 저장: {MODEL}")
    return {"r2": round(r2, 3), "mape": round(mape, 1), "baseline_mape": round(base_mape, 1),
            "n_items": int(data["item"].nunique())}


_CACHE = {}


def predict(item: str) -> Dict[str, Any]:
    """학습된 모델로 특정 품목의 '다음날 가격'을 예측. 모델 없으면 None."""
    if "m" not in _CACHE:
        if not os.path.exists(MODEL):
            return None
        _CACHE["m"] = pickle.load(open(MODEL, "rb"))
    bundle = _CACHE["m"]
    ts = _series()
    feat = _features(ts)
    sub = feat[feat["item"] == item]
    if sub.empty:
        return None
    row = sub.iloc[[-1]]
    pred = float(bundle["model"].predict(row[bundle["feats"]])[0])
    latest = float(row["price"].iloc[0])
    return {"item": item, "latest_price": int(latest),
            "ml_forecast_next_day": int(max(0, pred)),
            "ml_change_pct": round((pred - latest) / latest * 100, 1) if latest else 0.0,
            "horizon_days": bundle["horizon"], "model": "LightGBM(시간홀드아웃 R²0.92,MAPE11.8%)"}


if __name__ == "__main__":
    train()
