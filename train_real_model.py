"""
REAL vulnerability classifier training — honest, reproducible.

Clones real repos (vulnerable apps + clean libraries), extracts Python functions,
labels each with a REAL SAST tool (Bandit: MEDIUM/HIGH finding inside the function
=> vulnerable), and trains a TF-IDF + LightGBM classifier evaluated with
REPO-LEVEL holdout (GroupKFold by repo) so the model is tested on repositories it
never saw — the honest split (random function split would leak).

No fabricated numbers. If a clone fails it is skipped. Metrics are whatever the
model actually achieves on unseen repos.
"""

import ast
import json
import os
import subprocess
import tempfile
from typing import List, Dict, Any

import numpy as np
from lightgbm import LGBMClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import GroupKFold

REPOS = [
    ("DSVW", "https://github.com/stamparm/DSVW.git", "vuln"),
    ("dvpwa", "https://github.com/anxolerd/dvpwa.git", "vuln"),
    ("vulnflask", "https://github.com/we45/Vulnerable-Flask-App.git", "vuln"),
    ("click", "https://github.com/pallets/click.git", "clean"),
    ("markupsafe", "https://github.com/pallets/markupsafe.git", "clean"),
]


def clone(url: str, dest: str):
    if not os.path.exists(dest):
        subprocess.run(["git", "clone", "--depth", "1", "-q", url, dest],
                       check=True, timeout=180, capture_output=True)


def bandit_lines(repo_dir: str) -> Dict[str, set]:
    """파일별로 MEDIUM/HIGH 취약 줄번호 집합."""
    out: Dict[str, set] = {}
    try:
        proc = subprocess.run(["bandit", "-r", repo_dir, "-f", "json", "-q",
                               "-ll"],  # -ll = MEDIUM 이상만
                              capture_output=True, text=True, timeout=300)
        data = json.loads(proc.stdout or "{}")
        for r in data.get("results", []):
            out.setdefault(r["filename"], set()).add(r["line_number"])
    except Exception:
        pass
    return out


def extract_functions(path: str):
    try:
        src = open(path, encoding="utf-8", errors="ignore").read()
        tree = ast.parse(src)
    except Exception:
        return []
    lines = src.splitlines()
    funcs = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start = node.lineno
            end = max([getattr(n, "lineno", start) for n in ast.walk(node)] + [start])
            code = "\n".join(lines[start - 1:end])
            funcs.append((code, start, end))
    return funcs


def build_dataset(workdir: str):
    X_text, y, groups = [], [], []
    for name, url, _ in REPOS:
        dest = os.path.join(workdir, name)
        try:
            clone(url, dest)
        except Exception as e:
            print(f"  ! {name} clone 실패: {str(e)[:50]}")
            continue
        vuln_map = bandit_lines(dest)
        nfunc = 0
        for root, _, files in os.walk(dest):
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                fpath = os.path.join(root, fn)
                bad_lines = vuln_map.get(fpath, set())
                for code, s, e in extract_functions(fpath):
                    if len(code) < 20:
                        continue
                    label = 1 if any(s <= ln <= e for ln in bad_lines) else 0
                    X_text.append(code); y.append(label); groups.append(name); nfunc += 1
        print(f"  {name}: 함수 {nfunc}개 (취약 {sum(1 for i,g in enumerate(groups) if g==name and y[i])}개)")
    return X_text, np.array(y), np.array(groups)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        print("[1] 실제 repo 클론 + Bandit 라벨링...")
        X_text, y, groups = build_dataset(tmp)
    print(f"\n총 함수 {len(y)}개 | 취약 {int(y.sum())} / 정상 {int((y==0).sum())} | repo {len(set(groups))}개")
    if y.sum() < 5 or len(set(groups)) < 3:
        print("데이터 부족 — 종료"); return

    print("\n[2] repo 단위 홀드아웃 학습 (GroupKFold, 처음 보는 repo로 평가)")
    vec = TfidfVectorizer(analyzer="word", token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z]", max_features=3000)
    X = vec.fit_transform(X_text)
    gkf = GroupKFold(n_splits=min(len(set(groups)), 5))
    aucs, preds_all, y_all = [], [], []
    for tr, te in gkf.split(X, y, groups):
        if y[tr].sum() == 0 or len(set(y[te])) < 2:
            continue
        m = LGBMClassifier(n_estimators=200, learning_rate=0.05, num_leaves=31,
                           class_weight="balanced", random_state=42, verbose=-1)
        m.fit(X[tr], y[tr])
        p = m.predict_proba(X[te])[:, 1]
        aucs.append(roc_auc_score(y[te], p))
        preds_all += list((p > 0.5).astype(int)); y_all += list(y[te])

    print(f"\n=== 정직한 결과 (처음 보는 repo 기준) ===")
    print(f"ROC-AUC (repo홀드아웃 평균): {np.mean(aucs):.3f}" if aucs else "평가 불가")
    if y_all:
        print(classification_report(y_all, preds_all, target_names=["safe", "vulnerable"], digits=3))
    print("※ 라벨=Bandit(실도구). CVE 기반 정답 라벨은 DiverseVul+GPU로 업그레이드.")


if __name__ == "__main__":
    main()
