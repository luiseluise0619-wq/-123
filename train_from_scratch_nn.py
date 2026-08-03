"""
밑바닥부터(from scratch) 만든 취약점 분류 신경망 — CodeBERT 같은 사전학습 없음.

무엇이 "from scratch" 인가:
  - 토크나이저를 이 데이터로 직접 만든다 (사전학습 어휘 없음).
  - 임베딩/인코더/분류기 가중치를 전부 random init 에서 시작해 학습한다.
  - 외부 사전학습 모델을 전혀 불러오지 않는다 (torch nn 모듈만 사용).

정직성:
  - 라벨은 실제 SAST 도구(Bandit, MEDIUM 이상)가 붙인다. 사람이 지어낸 숫자 없음.
  - 데이터가 극단적으로 불균형하면 from-scratch 넷은 다수클래스만 찍는다 —
    그 사실을 숨기지 않고, 균형 학습셋(취약:정상 = 1:1)을 별도로 만들어
    넷이 실제로 신호를 배우는지 정직하게 측정한다.
  - repo 단위 홀드아웃(GroupKFold): 학습에 없던 repo 로만 평가 → 유출 없음.
"""

import ast
import os
import random
import subprocess
import tempfile
import json
from collections import Counter
from typing import List, Dict, Tuple

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

SEED = 42
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

REPOS = [
    ("DSVW", "https://github.com/stamparm/DSVW.git"),
    ("dvpwa", "https://github.com/anxolerd/dvpwa.git"),
    ("vulnflask", "https://github.com/we45/Vulnerable-Flask-App.git"),
    ("click", "https://github.com/pallets/click.git"),
    ("markupsafe", "https://github.com/pallets/markupsafe.git"),
    ("werkzeug", "https://github.com/pallets/werkzeug.git"),
    ("itsdangerous", "https://github.com/pallets/itsdangerous.git"),
]


# ---------------------------------------------------------------- 데이터 수집
def clone(url: str, dest: str):
    if not os.path.exists(dest):
        subprocess.run(["git", "clone", "--depth", "1", "-q", url, dest],
                       check=True, timeout=180, capture_output=True)


def bandit_bad_lines(repo_dir: str) -> Dict[str, set]:
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


def extract_functions(path: str) -> List[Tuple[str, int, int]]:
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
            if len(code) >= 20:
                funcs.append((code, start, end))
    return funcs


def build_corpus(workdir: str):
    X, y, groups = [], [], []
    for name, url in REPOS:
        dest = os.path.join(workdir, name)
        try:
            clone(url, dest)
        except Exception as e:
            print(f"  ! {name} clone 실패: {str(e)[:50]}"); continue
        bad = bandit_bad_lines(dest)
        n = 0
        for root, _, files in os.walk(dest):
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                fpath = os.path.join(root, fn)
                bad_lines = bad.get(fpath, set())
                for code, s, e in extract_functions(fpath):
                    label = 1 if any(s <= ln <= e for ln in bad_lines) else 0
                    X.append(code); y.append(label); groups.append(name); n += 1
        print(f"  {name}: 함수 {n}개 (취약 {sum(1 for i,g in enumerate(groups) if g==name and y[i])}개)")
    return X, np.array(y), np.array(groups)


# ---------------------------------------------------------------- 토크나이저(직접 제작)
class CharBPEIshTokenizer:
    """사전학습 없이 이 코퍼스로만 만드는 단어/기호 토크나이저."""
    def __init__(self, max_vocab=4000):
        self.max_vocab = max_vocab
        self.stoi = {"<pad>": 0, "<unk>": 1}

    def _tok(self, s: str) -> List[str]:
        import re
        return re.findall(r"[A-Za-z_]\w+|[^\sA-Za-z0-9]", s)

    def fit(self, texts: List[str]):
        c = Counter()
        for t in texts:
            c.update(self._tok(t))
        for w, _ in c.most_common(self.max_vocab - len(self.stoi)):
            self.stoi[w] = len(self.stoi)

    def encode(self, s: str, maxlen=120) -> List[int]:
        ids = [self.stoi.get(t, 1) for t in self._tok(s)][:maxlen]
        return ids + [0] * (maxlen - len(ids))


# ---------------------------------------------------------------- 모델(random init)
class TinyVulnNet(nn.Module):
    """임베딩 → 1D conv 인코더 → 전역풀링 → 분류기. 전부 random init 부터 학습."""
    def __init__(self, vocab, dim=64, nclass=2):
        super().__init__()
        self.emb = nn.Embedding(vocab, dim, padding_idx=0)
        self.conv1 = nn.Conv1d(dim, 128, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(128, 128, kernel_size=5, padding=2)
        self.drop = nn.Dropout(0.3)
        self.fc = nn.Sequential(nn.Linear(128, 64), nn.ReLU(), nn.Linear(64, nclass))

    def forward(self, x):
        e = self.emb(x).transpose(1, 2)          # (B, dim, L)
        h = torch.relu(self.conv1(e))
        h = torch.relu(self.conv2(h))
        h = torch.max(h, dim=2).values           # 전역 max pooling
        return self.fc(self.drop(h))


def make_balanced(idx, y, rng):
    """소수클래스(취약) 오버샘플로 1:1 균형 학습셋 인덱스."""
    pos = [i for i in idx if y[i] == 1]
    neg = [i for i in idx if y[i] == 0]
    if not pos:
        return list(idx)
    need = len(neg)
    pos_up = list(rng.choice(pos, size=need, replace=True)) if len(pos) < need else pos
    out = list(neg) + list(pos_up)
    rng.shuffle(out)
    return out


def train_eval(Xids, y, groups):
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import roc_auc_score, classification_report
    device = "cuda" if torch.cuda.is_available() else "cpu"
    rng = np.random.default_rng(SEED)
    gkf = GroupKFold(n_splits=min(len(set(groups)), 4))
    aucs, y_all, p_all = [], [], []

    for fold, (tr, te) in enumerate(gkf.split(Xids, y, groups)):
        if y[tr].sum() == 0 or len(set(y[te])) < 2:
            continue
        tr_bal = make_balanced(tr, y, rng)
        Xtr = torch.tensor(Xids[tr_bal]); ytr = torch.tensor(y[tr_bal])
        Xte = torch.tensor(Xids[te]); yte = torch.tensor(y[te])
        dl = DataLoader(TensorDataset(Xtr, ytr), batch_size=64, shuffle=True)

        model = TinyVulnNet(vocab=Xids.max() + 1).to(device)
        opt = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)
        lossf = nn.CrossEntropyLoss()
        model.train()
        for epoch in range(15):
            for xb, yb in dl:
                xb, yb = xb.to(device), yb.to(device)
                opt.zero_grad()
                loss = lossf(model(xb), yb)
                loss.backward(); opt.step()

        model.eval()
        with torch.no_grad():
            prob = torch.softmax(model(Xte.to(device)), dim=1)[:, 1].cpu().numpy()
        try:
            auc = roc_auc_score(yte.numpy(), prob); aucs.append(auc)
        except ValueError:
            auc = float("nan")
        held = [g for g in set(groups) if g in set(groups[te])]
        print(f"  fold{fold} (평가 repo={held}): AUC={auc:.3f}  (test {len(te)}, 취약 {int(y[te].sum())})")
        y_all += list(yte.numpy()); p_all += list((prob > 0.5).astype(int))

    print("\n=== from-scratch 신경망 정직한 결과 (처음 보는 repo) ===")
    print(f"ROC-AUC (repo홀드아웃 평균): {np.nanmean(aucs):.3f}" if aucs else "평가 불가")
    if y_all:
        print(classification_report(y_all, p_all, target_names=["safe", "vuln"],
                                    digits=3, zero_division=0))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        print("[1] 실제 repo 클론 + Bandit 라벨링...")
        X, y, groups = build_corpus(tmp)
    print(f"\n총 함수 {len(y)} | 취약 {int(y.sum())} / 정상 {int((y==0).sum())} "
          f"| repo {len(set(groups))}개 | 불균형 {y.mean()*100:.1f}% 취약")
    if y.sum() < 5 or len(set(groups)) < 3:
        print("데이터 부족 — 종료"); return

    print("\n[2] from-scratch 토크나이저 학습 (사전학습 어휘 없음)")
    tok = CharBPEIshTokenizer(max_vocab=4000)
    tok.fit(X)
    Xids = np.array([tok.encode(c, maxlen=120) for c in X], dtype=np.int64)
    print(f"    어휘 크기 {len(tok.stoi)} | 시퀀스 길이 120")

    print("\n[3] TinyVulnNet 학습 (Embedding+Conv, random init, 균형 오버샘플)")
    train_eval(Xids, y, groups)
    print("\n※ CodeBERT/사전학습 전혀 사용 안 함. 전 가중치 random init에서 학습.")
    print("※ 라벨=Bandit(실도구). from-scratch 넷은 데이터가 많을수록 좋아짐 —")
    print("  현재 취약 샘플 수가 적어 성능 상한이 낮음(정직한 한계).")


if __name__ == "__main__":
    main()
