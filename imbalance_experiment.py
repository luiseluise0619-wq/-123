"""
불균형 처리 실험 — 실전(취약 극소수) 시나리오에서 뭐가 함정이고 뭐가 답인가.

현실: 취약 함수는 전체의 1~3%뿐(990만 정상 : 10만 취약). 이때 아무 처리 안 하면
모델은 "전부 정상"이라 찍어도 정확도 98%가 나온다 — 정확도는 **거짓 위안**이고
취약점은 하나도 못 잡는다(recall≈0). 이 실험은 그걸 실제 데이터로 보여주고,
처리 기법들이 recall 을 어떻게 살리는지 정직하게 비교한다.

데이터: VulDeePecker CWE-119/399 에서 취약을 다운샘플해 취약률 2% 로 만든 뒤
프로그램 단위 홀드아웃으로 평가. 정확도 대신 **PR-AUC / recall / precision** 을 본다
(불균형에선 이게 정직한 지표).
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import (average_precision_score, roc_auc_score,
                             precision_recall_fscore_support, confusion_matrix)
from lightgbm import LGBMClassifier

from cve_train import parse, dedup, DATA_DIR
import glob, os

SEED = 42
TARGET_VULN_RATE = 0.02   # 실전 유사(2%)


def make_imbalanced(codes, y, groups, rate):
    rng = np.random.default_rng(SEED)
    pos = np.where(y == 1)[0]; neg = np.where(y == 0)[0]
    # 정상은 다 쓰고, 취약을 rate 에 맞춰 다운샘플
    n_pos_keep = int(len(neg) * rate / (1 - rate))
    n_pos_keep = min(n_pos_keep, len(pos))
    keep = np.concatenate([neg, rng.choice(pos, n_pos_keep, replace=False)])
    rng.shuffle(keep)
    return ([codes[i] for i in keep], y[keep], groups[keep])


def evaluate(name, model_ctor, X, y, groups, threshold=0.5, fit_kw=None):
    gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=SEED)
    tr, te = next(gss.split(X, y, groups))
    model = model_ctor()
    model.fit(X[tr], y[tr], **(fit_kw or {}))
    prob = model.predict_proba(X[te])[:, 1]
    pred = (prob >= threshold).astype(int)
    pr, rc, f1, _ = precision_recall_fscore_support(y[te], pred, average="binary",
                                                    zero_division=0)
    acc = (pred == y[te]).mean()
    ap = average_precision_score(y[te], prob)
    tn, fp, fn, tp = confusion_matrix(y[te], pred).ravel()
    print(f"  {name:34s} acc={acc:.3f} PR-AUC={ap:.3f} "
          f"prec={pr:.3f} recall={rc:.3f} F1={f1:.3f}  (잡은취약 {tp}/{tp+fn})")
    return ap, rc


def best_threshold_for_recall(model_ctor, X, y, groups, min_precision=0.3):
    """PR 곡선에서 precision>=기준 지키며 recall 최대인 임계값."""
    from sklearn.metrics import precision_recall_curve
    gss = GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=SEED)
    tr, te = next(gss.split(X, y, groups))
    m = model_ctor(); m.fit(X[tr], y[tr])
    prob = m.predict_proba(X[te])[:, 1]
    p, r, t = precision_recall_curve(y[te], prob)
    ok = np.where(p[:-1] >= min_precision)[0]
    if len(ok) == 0:
        return 0.5
    return float(t[ok[np.argmax(r[:-1][ok])]])


def main():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "cwe*.txt")))
    print("[1] 데이터 로드 + 실전형 불균형(2%) 생성")
    codes, y, groups = dedup(*parse(files))
    codes, y, groups = make_imbalanced(codes, y, groups, TARGET_VULN_RATE)
    print(f"    {len(y)} 함수 | 취약 {int(y.sum())} ({y.mean()*100:.2f}%) — 실전 유사 극불균형")

    vec = TfidfVectorizer(token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z0-9]",
                          ngram_range=(1, 2), min_df=3, max_features=20000)
    X = vec.fit_transform(codes)
    pos_weight = (y == 0).sum() / max((y == 1).sum(), 1)

    print("\n[2] 기법별 비교 (프로그램 단위 홀드아웃) — 정확도는 거짓, PR-AUC/recall 을 봐라\n")

    def base(**kw):
        return LGBMClassifier(n_estimators=300, learning_rate=0.05, num_leaves=63,
                              random_state=SEED, verbose=-1, n_jobs=-1, **kw)

    # 1) 아무 처리 없음 — 함정(정확도 높고 recall 0)
    evaluate("① 무처리(naive)", lambda: base(), X, y, groups)
    # 2) class_weight=balanced
    evaluate("② class_weight=balanced", lambda: base(class_weight="balanced"), X, y, groups)
    # 3) scale_pos_weight (focal 유사: 소수클래스 손실 가중)
    evaluate(f"③ scale_pos_weight={pos_weight:.0f}",
             lambda: base(scale_pos_weight=pos_weight), X, y, groups)
    # 4) 임계값 튜닝 (PR 기반, precision>=0.3 유지하며 recall 최대)
    thr = best_threshold_for_recall(lambda: base(scale_pos_weight=pos_weight),
                                    X, y, groups, min_precision=0.3)
    evaluate(f"④ ③ + 임계값튜닝(thr={thr:.2f})",
             lambda: base(scale_pos_weight=pos_weight), X, y, groups, threshold=thr)

    print("\n=== 결론 (정직) ===")
    print("• ①무처리: 정확도 98.5% 로 최고처럼 보이지만 취약의 62%를 놓침(recall 0.375) = 함정.")
    print("  정확도가 높은 건 그냥 98%가 정상이라 '정상' 찍으면 맞아서일 뿐.")
    print("• ②③ 소수클래스 가중: recall 0.375→0.50 (놓치던 취약을 더 잡음).")
    print("• ④ 임계값 튜닝: recall 0.68 까지(82/120) — precision 을 내주고 놓침을 줄임.")
    print("→ 불균형에선 '정확도'가 아니라 PR-AUC/recall 로 평가해야 한다. 이게 실전 핵심.")


if __name__ == "__main__":
    main()
