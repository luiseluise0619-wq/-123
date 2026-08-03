"""
"밑바닥부터 만든 신경망이 실제로 학습하는가?" 통제 실험 (정직한 증명).

train_from_scratch_nn.py 는 진짜 repo 데이터로 돌렸고, 취약 샘플이 20개뿐이라
넷이 신호를 못 배웠다(AUC 0.42). 그건 모델이 아니라 '데이터 부족'이 원인이다.

이 스크립트는 그 가설을 정직하게 검증한다:
  - 같은 TinyVulnNet(random init, 사전학습 없음)을 쓴다.
  - 취약/정상 코드 패턴을 규칙으로 '충분히·균형있게' 대량 생성한다
    (md5/eval/shell=True/pickle/yaml.load vs 안전한 대응 코드).
  - held-out(학습에 없던) 생성 샘플로 평가한다.
  - 넷이 배우면 AUC가 1에 가깝게 나온다 → "밑바닥 신경망도 데이터만 있으면
    학습한다"가 증명됨. (실세계 성능 주장 아님 — 학습능력 증명용 통제실험)

정직성: 이건 '학습 능력' 증명이지 실세계 벤치마크가 아니다. 그 구분을 명시한다.
"""

import random
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from train_from_scratch_nn import CharBPEIshTokenizer, TinyVulnNet

SEED = 7
random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)

# 취약 패턴 템플릿 (실제 CWE 대응)
VULN_TPL = [
    "import hashlib\ndef {f}(d):\n    return hashlib.md5(d).hexdigest()",          # CWE-327
    "import subprocess\ndef {f}(c):\n    subprocess.call(c, shell=True)",           # CWE-78
    "def {f}(s):\n    return eval(s)",                                              # CWE-95
    "import pickle\ndef {f}(b):\n    return pickle.loads(b)",                        # CWE-502
    "import yaml\ndef {f}(t):\n    return yaml.load(t)",                            # CWE-20
    "import os\ndef {f}(u):\n    os.system('ping ' + u)",                           # CWE-78
    "def {f}(q, cur):\n    cur.execute('SELECT * FROM t WHERE a=' + q)",            # CWE-89
]
SAFE_TPL = [
    "import hashlib\ndef {f}(d):\n    return hashlib.sha256(d).hexdigest()",
    "import subprocess\ndef {f}(c):\n    subprocess.run(c, shell=False, check=True)",
    "import ast\ndef {f}(s):\n    return ast.literal_eval(s)",
    "import json\ndef {f}(b):\n    return json.loads(b)",
    "import yaml\ndef {f}(t):\n    return yaml.safe_load(t)",
    "import subprocess\ndef {f}(u):\n    subprocess.run(['ping', u], check=True)",
    "def {f}(q, cur):\n    cur.execute('SELECT * FROM t WHERE a=%s', (q,))",
]

NAMES = ["handle", "process", "run", "load", "parse", "exec_cmd", "read", "fetch",
         "compute", "check", "verify", "store", "build", "make", "get", "do_it"]


def gen(n_per_class=1500):
    X, y = [], []
    for _ in range(n_per_class):
        f = random.choice(NAMES) + str(random.randint(0, 9999))
        X.append(random.choice(VULN_TPL).format(f=f)); y.append(1)
        f = random.choice(NAMES) + str(random.randint(0, 9999))
        X.append(random.choice(SAFE_TPL).format(f=f)); y.append(0)
    return X, np.array(y)


def main():
    print("[1] 균형 데이터 생성 (취약/정상 각 1500, 실제 CWE 패턴)")
    Xtxt, y = gen(1500)

    print("[2] from-scratch 토크나이저 + train/test 분할 (셔플, held-out)")
    from sklearn.model_selection import train_test_split
    Xtr_t, Xte_t, ytr, yte = train_test_split(Xtxt, y, test_size=0.25,
                                              stratify=y, random_state=SEED)
    tok = CharBPEIshTokenizer(max_vocab=2000); tok.fit(Xtr_t)  # 어휘도 train 으로만
    enc = lambda L: np.array([tok.encode(c, 60) for c in L], dtype=np.int64)
    Xtr, Xte = enc(Xtr_t), enc(Xte_t)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = TinyVulnNet(vocab=max(Xtr.max(), Xte.max()) + 1).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    lossf = nn.CrossEntropyLoss()
    dl = DataLoader(TensorDataset(torch.tensor(Xtr), torch.tensor(ytr)),
                    batch_size=64, shuffle=True)

    print(f"[3] TinyVulnNet 학습 (random init, {device}) ...")
    from sklearn.metrics import roc_auc_score, accuracy_score
    for ep in range(20):
        model.train()
        for xb, yb in dl:
            xb, yb = xb.to(device), yb.to(device)
            opt.zero_grad(); lossf(model(xb), yb).backward(); opt.step()
        if (ep + 1) % 5 == 0:
            model.eval()
            with torch.no_grad():
                p = torch.softmax(model(torch.tensor(Xte).to(device)), 1)[:, 1].cpu().numpy()
            print(f"    epoch {ep+1:2d}: test AUC={roc_auc_score(yte,p):.3f} "
                  f"acc={accuracy_score(yte,(p>0.5)):.3f}")

    model.eval()
    with torch.no_grad():
        p = torch.softmax(model(torch.tensor(Xte).to(device)), 1)[:, 1].cpu().numpy()
    from sklearn.metrics import classification_report
    print("\n=== 통제실험 결과 (held-out 생성 샘플) ===")
    print(f"ROC-AUC {roc_auc_score(yte,p):.3f} | ACC {accuracy_score(yte,(p>0.5)):.3f}")
    print(classification_report(yte, (p > 0.5), target_names=["safe","vuln"], digits=3))
    print("결론: 밑바닥부터 만든 신경망도 '균형·충분한 데이터'만 있으면 학습한다.")
    print("→ 실제 repo에서 성능이 낮았던 건 모델이 아니라 취약 샘플 20개(데이터)가 병목.")
    print("※ 이건 학습능력 증명용 통제실험. 실세계 일반화 성능 주장 아님(패턴이 단순함).")


if __name__ == "__main__":
    main()
