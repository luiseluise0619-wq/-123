"""
ML Engine: Training — REAL (replaces the fabricated sleep/formula theater).

이전 버전은 time.sleep(0.2)를 "학습"이라 하고 loss를 0.4850/(epoch**0.85)
공식으로 지어내고 "RTX 4090"이라 거짓 로그를 남긴 뒤 텍스트 파일을
pytorch_model.bin으로 저장했다(완전 가짜).

이 버전은 실제로 학습한다:
  - 실제 repo를 클론하고 Bandit(실도구)으로 함수 단위 라벨을 만든다.
  - TF-IDF + LogisticRegression 분류기를 진짜로 fit 한다.
  - repo 단위 홀드아웃(GroupKFold)으로 정직하게 평가한다.
  - 학습된 모델을 joblib로 저장한다(inference.py가 이걸 로드).
  - config.json 에는 실제 측정된 지표만 기록한다(지어낸 loss/GPU 없음).

데이터가 극히 불균형(취약 함수 소수)하다는 사실을 숨기지 않는다 — 그래서
성능 상한이 낮다는 것도 정직하게 기록한다.
"""

import ast
import json
import os
import subprocess
import tempfile
import datetime
from typing import Dict, Any, List, Tuple

import numpy as np

REPOS = [
    ("DSVW", "https://github.com/stamparm/DSVW.git"),
    ("dvpwa", "https://github.com/anxolerd/dvpwa.git"),
    ("vulnflask", "https://github.com/we45/Vulnerable-Flask-App.git"),
    ("markupsafe", "https://github.com/pallets/markupsafe.git"),
    ("werkzeug", "https://github.com/pallets/werkzeug.git"),
]


def _clone(url: str, dest: str):
    if not os.path.exists(dest):
        subprocess.run(["git", "clone", "--depth", "1", "-q", url, dest],
                       check=True, timeout=180, capture_output=True)


def _bandit_bad_lines(repo_dir: str) -> Dict[str, set]:
    out: Dict[str, set] = {}
    try:
        proc = subprocess.run(["bandit", "-r", repo_dir, "-f", "json", "-q", "-ll"],
                              capture_output=True, text=True, timeout=300)
        data = json.loads(proc.stdout or "{}")
        for r in data.get("results", []):
            out.setdefault(r["filename"], set()).add(r["line_number"])
    except Exception:
        pass
    return out


def _functions(path: str) -> List[Tuple[str, int, int]]:
    try:
        src = open(path, encoding="utf-8", errors="ignore").read()
        tree = ast.parse(src)
    except Exception:
        return []
    lines = src.splitlines()
    res = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start = node.lineno
            end = max([getattr(n, "lineno", start) for n in ast.walk(node)] + [start])
            code = "\n".join(lines[start - 1:end])
            if len(code) >= 20:
                res.append((code, start, end))
    return res


class SecurityModelTrainer:
    """실제로 학습하는 취약점 분류기 트레이너. 지어낸 수치 없음."""

    def __init__(self, output_dir: str = None):
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.output_dir = output_dir or os.path.join(base, "models")
        os.makedirs(self.output_dir, exist_ok=True)

    def _build_dataset(self, tmp: str):
        X, y, groups = [], [], []
        for name, url in REPOS:
            dest = os.path.join(tmp, name)
            try:
                _clone(url, dest)
            except Exception as e:
                print(f"  ! {name} clone 실패: {str(e)[:50]}"); continue
            bad = _bandit_bad_lines(dest)
            n = 0
            for root, _, files in os.walk(dest):
                for fn in files:
                    if not fn.endswith(".py"):
                        continue
                    fpath = os.path.join(root, fn)
                    bad_lines = bad.get(fpath, set())
                    for code, s, e in _functions(fpath):
                        label = 1 if any(s <= ln <= e for ln in bad_lines) else 0
                        X.append(code); y.append(label); groups.append(name); n += 1
            print(f"  {name}: 함수 {n}개")
        return X, np.array(y), np.array(groups)

    def train_model(self) -> Dict[str, Any]:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.model_selection import GroupKFold
        from sklearn.metrics import roc_auc_score
        import joblib

        print("[Trainer] 실제 repo 클론 + Bandit 라벨링...")
        with tempfile.TemporaryDirectory() as tmp:
            X_text, y, groups = self._build_dataset(tmp)
        n_vuln = int(y.sum())
        print(f"[Trainer] 함수 {len(y)} | 취약 {n_vuln} / 정상 {int((y==0).sum())} "
              f"| repo {len(set(groups))}개")
        if n_vuln < 5 or len(set(groups)) < 3:
            print("[Trainer] 데이터 부족 — 저장만 스킵"); return {"trained": False}

        vec = TfidfVectorizer(analyzer="word",
                              token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z]",
                              max_features=3000)
        X = vec.fit_transform(X_text)

        # 정직한 평가: repo 단위 홀드아웃
        gkf = GroupKFold(n_splits=min(len(set(groups)), 4))
        aucs = []
        for tr, te in gkf.split(X, y, groups):
            if y[tr].sum() == 0 or len(set(y[te])) < 2:
                continue
            m = LogisticRegression(max_iter=1000, class_weight="balanced")
            m.fit(X[tr], y[tr])
            aucs.append(roc_auc_score(y[te], m.predict_proba(X[te])[:, 1]))
        cv_auc = float(np.mean(aucs)) if aucs else None
        print(f"[Trainer] repo홀드아웃 ROC-AUC: "
              f"{cv_auc:.3f}" if cv_auc is not None else "[Trainer] 평가 불가")

        # 최종 모델: 전체 데이터로 학습 후 저장(추론용)
        final = LogisticRegression(max_iter=1000, class_weight="balanced")
        final.fit(X, y)
        joblib.dump({"model": final, "vectorizer": vec},
                    os.path.join(self.output_dir, "vuln_clf.joblib"))

        meta = {
            "model_type": "TF-IDF + LogisticRegression (from scratch, no pretraining)",
            "trained_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "n_functions": int(len(y)),
            "n_vulnerable": n_vuln,
            "n_repos": int(len(set(groups))),
            "label_source": "Bandit (real SAST, MEDIUM+)",
            "eval": "repo-level GroupKFold holdout",
            "roc_auc_holdout": cv_auc,
            "honest_note": ("취약 샘플이 적어 성능 상한이 낮음. 실전 성능은 CVE 라벨 "
                            "취약함수 수천~수만 개(DiverseVul 등)로 올라감."),
        }
        with open(os.path.join(self.output_dir, "config.json"), "w",
                  encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
        print(f"[Trainer] 저장: {self.output_dir}/vuln_clf.joblib (+config.json)")
        meta["trained"] = True
        return meta


if __name__ == "__main__":
    SecurityModelTrainer().train_model()
