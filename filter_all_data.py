"""
전체 데이터셋 노이즈 정제 — 실데이터의 '자연 라벨오류'를 찾아 청소한다.

주입 실험(noise_filter.py)과 달리 여기선 VulDeePecker / Devign 의 원본에
실제로 섞여있는 라벨오류를 Confident Learning 으로 찾아 제거하고, 정제본을
cvedata/clean/ 에 저장한다. VulDeePecker·Devign 은 라벨노이즈가 있다고
학계에 보고된 데이터라 실제로 걸러진다.

정직성: 홀드아웃 라벨도 노이즈가 있어 AUC 가 크게 안 뛸 수 있음 — 핵심 산출물은
'정제된 학습셋'이다. 걸러낸 개수·예시를 그대로 보고한다.
"""

import glob, os, json, re, hashlib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import roc_auc_score
from sklearn.linear_model import LogisticRegression

from cve_train import parse, dedup, DATA_DIR
from noise_filter import confident_label_errors, holdout_auc

CLEAN_DIR = os.path.join(DATA_DIR, "clean")
os.makedirs(CLEAN_DIR, exist_ok=True)


def load_devign():
    p = os.path.join(DATA_DIR, "devign.json")
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding="utf-8"))
    seen, C, Y, G = set(), [], [], []
    for x in d:
        code = x.get("func", "")
        if len(code) < 20:
            continue
        k = hashlib.md5(re.sub(r"\s+", " ", code).strip().encode()).hexdigest()
        if k in seen:
            continue
        seen.add(k); C.append(code); Y.append(int(x["target"])); G.append(str(x["commit_id"]))
    return C, np.array(Y), np.array(G)


def clean_dataset(name, codes, y, groups, est_noise=0.10):
    print(f"\n{'='*54}\n[{name}] {len(codes)} 함수 | 취약 {int(y.sum())} ({y.mean()*100:.1f}%)")
    vec = TfidfVectorizer(token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z0-9]",
                          ngram_range=(1, 2), min_df=3, max_features=20000)
    X = vec.fit_transform(codes)

    suspect, oof = confident_label_errors(X, y, est_noise=est_noise)
    n_bad = int(suspect.sum())
    print(f"  라벨오류 후보: {n_bad}개 ({n_bad/len(y)*100:.1f}%) 표시")

    # 가장 확신도 낮은(=오류가능성 최상위) 예시 2개
    self_conf = np.where(y == 1, oof, 1 - oof)
    worst = np.argsort(self_conf)[:2]
    for i in worst:
        snippet = codes[i].replace("\n", " ")[:70]
        print(f"    ⚠ 라벨={y[i]} OOF={oof[i]:.2f} | {snippet}...")

    auc_before = holdout_auc(X, y, groups)
    keep = ~suspect
    auc_after = holdout_auc(X[keep], y[keep], groups[keep])
    print(f"  홀드아웃 AUC  정제전 {auc_before:.3f} → 정제후 {auc_after:.3f} "
          f"({auc_after-auc_before:+.3f})")

    # 정제본 저장 (걸러낸 것 제외)
    out = os.path.join(CLEAN_DIR, f"{name}_clean.jsonl")
    with open(out, "w", encoding="utf-8") as f:
        for i in np.where(keep)[0]:
            f.write(json.dumps({"code": codes[i], "label": int(y[i]),
                                "group": str(groups[i])}, ensure_ascii=False) + "\n")
    print(f"  정제본 저장: {out} ({int(keep.sum())}개, {n_bad}개 제거)")
    return n_bad, keep.sum()


def main():
    print("전체 데이터셋 노이즈 정제 (Confident Learning)")

    # 1) VulDeePecker (CWE-119 + 399 통합)
    files = sorted(glob.glob(os.path.join(DATA_DIR, "cwe*.txt")))
    if files:
        codes, y, groups = dedup(*parse(files))
        clean_dataset("vuldeepecker", codes, y.astype(int), groups, est_noise=0.10)

    # 2) Devign (있으면)
    dv = load_devign()
    if dv:
        clean_dataset("devign", *dv, est_noise=0.10)
    else:
        print("\n[devign] cvedata/devign.json 없음 — 스킵")

    print(f"\n{'='*54}\n정제 완료 → {CLEAN_DIR}/*.jsonl")
    print("이 정제본으로 학습하면 라벨오류 학습을 피할 수 있음. 대규모일수록 효과 큼.")


if __name__ == "__main__":
    main()
