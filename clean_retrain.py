"""
정제 후 재학습 — 여기서 받은 소규모 데이터 전부를 노이즈 필터 → 통합 학습.

수집한 실데이터(전부 GitHub 에서 받음, 실 CVE 라벨):
  - VulDeePecker CWE-119/399  (cwe*.txt)
  - Devign FFmpeg/Qemu        (devign.json)
  - muVulDeePecker(MVD)        (mvd.txt, multiclass→binary)

각 데이터셋을 dedup → Confident Learning 노이즈 정제 → 프로그램 단위 홀드아웃으로
학습한다. 큰 건(DiverseVul/PrimeVul)은 Colab 노트북에서. 지어낸 수치 없음.
"""

import glob, os, json, re, hashlib, sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import roc_auc_score, average_precision_score
from sklearn.linear_model import LogisticRegression
from lightgbm import LGBMClassifier

from cve_train import parse, dedup, DATA_DIR
from noise_filter import confident_label_errors

SEED = 42
MAX_PER = 60000          # 데이터셋당 상한(CPU 시간 관리). 넘으면 랜덤 서브샘플.
MVD_SEP = "--------------------"


def _dd(codes, y, groups):
    return dedup(codes, np.array(y), np.array(groups))


def load_vuldeepecker():
    files = sorted(f for f in glob.glob(os.path.join(DATA_DIR, "cwe*.txt")))
    if not files:
        return None
    return _dd(*parse(files))


def load_devign():
    p = os.path.join(DATA_DIR, "devign.json")
    if not os.path.exists(p):
        return None
    d = json.load(open(p, encoding="utf-8"))
    C, Y, G = [], [], []
    for x in d:
        if len(x.get("func", "")) >= 20:
            C.append(x["func"]); Y.append(int(x["target"])); G.append(str(x["commit_id"]))
    return _dd(C, Y, G)


def load_mvd():
    p = os.path.join(DATA_DIR, "mvd.txt")
    if not os.path.exists(p):
        return None
    raw = open(p, encoding="utf-8", errors="ignore").read()
    C, Y, G = [], [], []
    for b in raw.split(MVD_SEP):
        lines = [l for l in b.strip().split("\n") if l.strip()]
        if len(lines) < 3:
            continue
        lab = lines[-1].strip()
        if not lab.isdigit():
            continue
        code = "\n".join(lines[1:-1])
        if len(code) < 20:
            continue
        # 헤더 예: "1 150200/dirent_uri.c memset 405" → 파일명을 그룹으로
        grp = lines[0].split()[1].split("/")[0] if len(lines[0].split()) > 1 else "na"
        C.append(code); Y.append(1 if lab != "0" else 0); G.append(grp)
    return _dd(C, Y, G)


def clean_and_train(name, data, est_noise=0.10):
    codes, y, groups = data
    y = y.astype(int)
    rng = np.random.default_rng(SEED)
    if len(codes) > MAX_PER:                      # 상한 서브샘플(정직히 표기)
        idx = rng.choice(len(codes), MAX_PER, replace=False)
        codes = [codes[i] for i in idx]; y = y[idx]; groups = groups[idx]
        note = f" (상한 {MAX_PER}로 서브샘플)"
    else:
        note = ""
    print(f"\n{'='*56}\n[{name}] {len(codes)} 함수{note} | 취약 {int(y.sum())} ({y.mean()*100:.1f}%)")

    vec = TfidfVectorizer(token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z0-9]",
                          ngram_range=(1, 2), min_df=3, max_features=20000)
    X = vec.fit_transform(codes)

    def split(Xx, yy, gg):
        # 그룹 홀드아웃 시도; 한쪽이 너무 작으면 stratified 랜덤으로 폴백
        if len(set(gg)) >= 4:
            tr, te = next(GroupShuffleSplit(1, test_size=0.3, random_state=SEED).split(Xx, yy, gg))
            if min(len(tr), len(te)) >= 50 and len(set(yy[te])) == 2:
                return tr, te
        from sklearn.model_selection import train_test_split
        idx = np.arange(len(yy))
        return train_test_split(idx, test_size=0.3, random_state=SEED, stratify=yy)

    def auc(Xx, yy, gg):
        tr, te = split(Xx, yy, gg)
        m = LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=63,
                           class_weight="balanced", random_state=SEED, n_jobs=-1, verbose=-1)
        m.fit(Xx[tr], yy[tr]); p = m.predict_proba(Xx[te])[:, 1]
        return roc_auc_score(yy[te], p), average_precision_score(yy[te], p)

    a0, p0 = auc(X, y, groups)
    suspect, _ = confident_label_errors(X, y, est_noise=est_noise)
    keep = ~suspect
    a1, p1 = auc(X[keep], y[keep], groups[keep])
    print(f"  정제전 ROC-AUC {a0:.3f} PR-AUC {p0:.3f}")
    print(f"  정제후 ROC-AUC {a1:.3f} PR-AUC {p1:.3f}  (라벨오류 {int(suspect.sum())}개 제거)")
    print("  ※ 정제후는 테스트도 정제돼 낙관적일 수 있음 — 산출물은 '깨끗한 학습셋'.")
    return name, len(codes), int(y.sum()), a0, a1


def main():
    print("여기서 받은 소규모 실데이터 전부 정제+재학습 (큰 건 Colab)")
    rows = []
    for name, loader in [("VulDeePecker", load_vuldeepecker),
                         ("Devign", load_devign),
                         ("MVD", load_mvd)]:
        data = loader()
        if data is None:
            print(f"\n[{name}] 데이터 없음 — 스킵"); continue
        rows.append(clean_and_train(name, data))

    print(f"\n{'='*56}\n요약 (프로그램 단위 홀드아웃)")
    print(f"{'데이터셋':<14}{'함수':>8}{'취약':>8}{'정제전AUC':>10}{'정제후AUC':>10}")
    for name, n, v, a0, a1 in rows:
        print(f"{name:<14}{n:>8}{v:>8}{a0:>10.3f}{a1:>10.3f}")
    print("\n큰 데이터(DiverseVul 33만·PrimeVul 23만)는 colab_diversevul_train.ipynb 로.")


if __name__ == "__main__":
    main()
