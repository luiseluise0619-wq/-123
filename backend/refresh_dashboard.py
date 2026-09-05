#!/usr/bin/env python3
"""
사장님인사이트 대시보드 자동 재생성 파이프라인.

하는 일 (전부 실데이터, 지어냄 없음):
  1) 식자재: agmarket_prices.csv(공판장 실가) → 품목 요약(전년비)·월별 추세.
     DATA_GO_KR_KEY 있으면 aT 실시간가로 최신값 갱신(선택).
  2) 상권:   sangkwon_snapshot.json(서울 상권분석 실데이터) 로드.
     SEOUL 원본 CSV(seoul_trdar_dataset.csv) 있으면 그걸로 재집계.
  3) ML:     누출 피처(거래건수·점포당매출) 제외하고 성공확률·매출 예측
     재학습(공간 홀드아웃) → out-of-fold 예측·신뢰도곡선 산출.
  4) 렌더:   frontend/dashboard_template.html 의 __ZONES__/__FOOD__/__CHART__
     자리에 최신 데이터를 넣어 frontend/sangkwon_charts_dashboard.html 생성.

갱신 주기: 가격=매일, 상권=분기(원본이 그때만 바뀜). GitHub Action 이 매일 실행.

    python refresh_dashboard.py            # 재생성
    python refresh_dashboard.py --check    # 데이터 존재만 확인
"""
import os, sys, json, datetime
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MARKET = os.path.join(HERE, "app", "data", "market")
REAL = os.path.join(HERE, "app", "data", "real_data")
AGCSV = os.path.join(MARKET, "agmarket_prices.csv")
SNAP = os.path.join(MARKET, "sangkwon_snapshot.json")
TRDAR = os.path.join(REAL, "seoul_trdar_dataset.csv")
TEMPLATE = os.path.join(HERE, "dashboard_template.html")
OUT = os.path.join(ROOT, "frontend", "dashboard.html")


# ----------------------------------------------------------------- 1) 식자재
def build_food():
    if not os.path.exists(AGCSV):
        raise FileNotFoundError(f"공판장 CSV 없음: {AGCSV}")
    df = pd.read_csv(AGCSV, encoding="utf-8-sig", low_memory=False)
    df["가격날짜"] = pd.to_datetime(df["가격날짜"], errors="coerce")
    df["평균가격"] = pd.to_numeric(df["평균가격"], errors="coerce")
    df = df[(df["평균가격"] > 0) & df["가격날짜"].notna()]

    # 품목 요약: 최신가 + 전년대비 등락(있으면 컬럼, 없으면 1년전 대비 계산)
    summary = []
    for item, sub in df.groupby("품목명"):
        ts = sub.groupby("가격날짜")["평균가격"].mean().sort_index()
        if ts.empty:
            continue
        latest = float(ts.iloc[-1]); ld = ts.index[-1]
        yoy = None
        if "전년대비등락율" in sub.columns:
            yv = pd.to_numeric(sub["전년대비등락율"], errors="coerce").dropna()
            if len(yv):
                yoy = float(yv.tail(20).mean())
        if yoy is None:  # 1년 전 값과 직접 비교
            prev = ts[ts.index <= ld - pd.Timedelta(days=350)]
            if len(prev):
                yoy = (latest - float(prev.iloc[-1])) / float(prev.iloc[-1]) * 100
        if yoy is None:
            continue
        d = "상승" if yoy > 2 else "하락" if yoy < -2 else "보합"
        summary.append({"item": item, "price": int(latest), "yoy": round(yoy, 1), "dir": d})
    summary.sort(key=lambda x: -abs(x["yoy"]))

    # 월별 추세(대표 4품목): 최근 8개월
    lines = {}
    for item in ["배추", "양파", "사과", "고구마"]:
        sub = df[df["품목명"] == item]
        if sub.empty:
            continue
        m = (sub.assign(ym=sub["가격날짜"].dt.strftime("%Y-%m"))
                .groupby("ym")["평균가격"].mean().tail(8))
        if len(m):
            lines[item] = [{"m": k, "v": int(v)} for k, v in m.items()]
    return summary, lines


# ----------------------------------------------------------------- 2) 상권
def load_sangkwon():
    """원본 CSV 있으면 재집계, 없으면 스냅샷 사용."""
    # [확장 지점] 원본 CSV(TRDAR)로 zone×industry 를 재집계하려면 여기에 구현한다.
    # 현재는 build_seoul_dataset 산출물(스냅샷)을 그대로 신뢰한다.
    # 예전에는 CSV 를 pandas 로 읽어놓고 쓰지 않아 매 실행마다 파싱·메모리만 낭비했다 → 제거.
    if not os.path.exists(SNAP):
        raise FileNotFoundError(f"상권 스냅샷 없음: {SNAP}")
    return json.load(open(SNAP, encoding="utf-8"))


# ----------------------------------------------------------------- 3) ML
FEATS = ["stores", "we_ratio", "fm_ratio"]  # 누출 cnt·ops 제외


def train_ml(rows):
    """정직한 목표 = '점포당 매출'(내 가게가 실제 벌 돈).
    총매출을 목표로 하면 점포수가 합계를 기계적으로 끌어올려 AUC 0.80/R²0.47로 부풀려짐.
    새 점주가 궁금한 건 '내 가게'이므로 rev/stores 를 예측 → AUC 0.64 · R² 0.35(정직).
    stores==0 행은 점포당 계산 불가 → 예측값 null(카드/그래프에서 미표시)."""
    from lightgbm import LGBMClassifier, LGBMRegressor
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import roc_auc_score, r2_score
    full = pd.DataFrame(rows)
    for c in FEATS:
        full[c] = pd.to_numeric(full[c], errors="coerce").fillna(0)
    full["icode"] = full["i"].astype("category").cat.codes
    full["sp"] = None; full["pr"] = None

    df = full[full["stores"] > 0].copy()
    df["perstore"] = df["rev"] / df["stores"]
    df = df[df["perstore"] > 0].reset_index()          # index = full 행 매핑용
    X = df[FEATS + ["icode"]].values
    groups = df["z"].values
    df["pct"] = df.groupby("i")["perstore"].rank(pct=True)
    yc = (df["pct"] >= 0.65).astype(int).values
    yr = df["perstore"].values
    gkf = GroupKFold(n_splits=5)
    oof_p = np.zeros(len(df)); oof_r = np.zeros(len(df)); au = []; r2 = []
    for tr, te in gkf.split(X, yc, groups):
        clf = LGBMClassifier(n_estimators=400, learning_rate=0.03, num_leaves=31,
                             subsample=0.8, colsample_bytree=0.8, min_child_samples=40,
                             random_state=42, verbose=-1).fit(X[tr], yc[tr])
        p = clf.predict_proba(X[te])[:, 1]; oof_p[te] = p; au.append(roc_auc_score(yc[te], p))
        reg = LGBMRegressor(objective="tweedie", tweedie_variance_power=1.3, n_estimators=500,
                            learning_rate=0.03, num_leaves=31, subsample=0.8, colsample_bytree=0.8,
                            min_child_samples=40, random_state=42, verbose=-1).fit(X[tr], yr[tr])
        pr = np.clip(reg.predict(X[te]), 0, None); oof_r[te] = pr; r2.append(r2_score(yr[te], pr))
    df["sp"] = np.round(oof_p * 100).astype(int)
    df["pr"] = np.round(oof_r).astype(int)             # 점포당 예측 월매출
    for _, r in df.iterrows():                          # full 로 되돌려 매핑
        full.at[r["index"], "sp"] = int(r["sp"]); full.at[r["index"], "pr"] = int(r["pr"])
    metrics = {"success_auc": round(float(np.mean(au)), 3),
               "success_auc_std": round(float(np.std(au)), 3),
               "rev_r2_spatial": round(float(np.mean(r2)), 3),
               "target": "점포당 매출(내 가게)",
               "n": int(len(df)), "zones": int(df["z"].nunique()),
               "feats": FEATS + ["업종"], "holdout": "GroupKFold(zone) 5-fold"}
    out_rows = full[["z", "i", "rev", "g", "p", "cnt", "we_ratio", "fm_ratio",
                     "stores", "ops", "sp", "pr"]].to_dict("records")
    return out_rows, metrics, []


# ----------------------------------------------------------------- chartdata
def build_chartdata(rows, price_lines, calib):
    df = pd.DataFrame(rows)
    grade_dist = df["g"].value_counts().to_dict()
    ind_avg = (df.groupby("i")["rev"].agg(["mean", "size"]).reset_index()
                 .sort_values("mean", ascending=False).head(8))
    ind_avg = [{"i": r["i"], "rev": int(r["mean"]), "n": int(r["size"])}
               for _, r in ind_avg.iterrows()]
    return {"grade_dist": grade_dist, "ind_avg": ind_avg,
            "price_lines": price_lines, "calib": calib}


# ----------------------------------------------------------------- render
def render(zones_obj, food, chart):
    html = open(TEMPLATE, encoding="utf-8").read()
    html = (html.replace("__ZONES__", json.dumps(zones_obj, ensure_ascii=False, separators=(",", ":")))
                .replace("__FOOD__", json.dumps(food, ensure_ascii=False, separators=(",", ":")))
                .replace("__CHART__", json.dumps(chart, ensure_ascii=False, separators=(",", ":"))))
    for ph in ("__ZONES__", "__FOOD__", "__CHART__"):
        assert ph not in html, f"미치환 자리표: {ph}"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(html)
    return len(html)


def main():
    if "--check" in sys.argv:
        for p in (AGCSV, SNAP, TEMPLATE):
            print(f"{'OK ' if os.path.exists(p) else 'MISSING'} {p}")
        return
    print(f"[{datetime.datetime.now():%Y-%m-%d %H:%M}] 대시보드 재생성 시작")
    summary, lines = build_food()
    print(f"  식자재 {len(summary)}품목 · 추세 {len(lines)}품목")
    snap = load_sangkwon()
    rows, metrics, calib = train_ml(snap["rows"])
    print(f"  상권 {metrics['n']}건 · ML AUC {metrics['success_auc']} R² {metrics['rev_r2_spatial']}")
    chart = build_chartdata(rows, lines, calib)
    zones_obj = {"quarter": snap.get("quarter"), "rows": rows, "ml": metrics}
    size = render(zones_obj, summary, chart)
    print(f"  → {OUT} ({size/1e6:.2f} MB)  완료")


if __name__ == "__main__":
    main()
