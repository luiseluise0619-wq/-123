"""
MegaVul 로더 — 대규모 정밀 CVE 함수 데이터셋을 학습에 바로 연결.

MegaVul(github.com/Icyrockton/MegaVul): 8,000+ CVE, 함수단위 C/C++/Java,
CVE→수정커밋→함수(전/후)까지 정밀 추출된 공개 데이터셋. 우리 build_vuln_db
--precise 와 같은 방식을 대규모로 수행한 결과물이다.

데이터(megavul_simple.json)는 OneDrive 배포라 이 원격 샌드박스에선 못 받는다.
네 PC/Colab 에서 받아 아래처럼 쓰면, 우리 학습 파이프라인이 그대로 소화한다.

  1) https://github.com/Icyrockton/MegaVul 의 Download 에서 megavul_simple.json 받기
  2) python load_megavul.py --json megavul_simple.json      # 정직 학습·평가
  3) 또는 to_frame() 로 (code,label,group) 얻어 cve_train 방식과 합치기

megavul_simple.json 구조(핵심 필드): 각 항목에 func_before/func(취약),
func_after(패치), cve_id, cwe_ids, is_vul 등. 필드명이 버전마다 조금 달라
방어적으로 파싱한다.
"""

import argparse
import json
import re
import hashlib
from typing import List, Tuple

import numpy as np


def _vuln_func(item) -> str:
    for k in ("func_before", "func", "vulnerable_function", "code"):
        if item.get(k):
            return item[k]
    return ""


def _is_vuln(item) -> int:
    for k in ("is_vul", "is_vulnerable", "target", "label"):
        if k in item:
            return int(bool(item[k]))
    # func_before ≠ func_after 면 취약(수정 전)으로 간주
    return 1 if item.get("func_after") and item.get("func_before") else 0


def _group(item) -> str:
    return str(item.get("cve_id") or item.get("commit_id") or
               item.get("repo_name") or "na")


def to_frame(json_path: str) -> Tuple[List[str], np.ndarray, np.ndarray]:
    """megavul_simple.json → (codes, y, groups). 취약(전)+패치(정상) 모두 사용."""
    data = json.load(open(json_path, encoding="utf-8"))
    if isinstance(data, dict):                 # {list:[...]} 형태 방어
        data = data.get("data") or next(iter(data.values()))
    seen, C, Y, G = set(), [], [], []

    def add(code, label, grp):
        if not code or len(code) < 20:
            return
        k = hashlib.md5(re.sub(r"\s+", " ", code).strip().encode()).hexdigest()
        if k in seen:
            return
        seen.add(k); C.append(code); Y.append(label); G.append(grp)

    for it in data:
        grp = _group(it)
        add(_vuln_func(it), _is_vuln(it), grp)
        if it.get("func_after"):               # 패치본 = 정상 라벨
            add(it["func_after"], 0, grp)
    return C, np.array(Y), np.array(G)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True, help="megavul_simple.json 경로")
    args = ap.parse_args()

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import roc_auc_score, average_precision_score
    from lightgbm import LGBMClassifier

    print("[1] MegaVul 로드")
    C, Y, G = to_frame(args.json)
    print(f"    {len(C)} 함수 | 취약 {int(Y.sum())} ({Y.mean()*100:.1f}%) | 그룹 {len(set(G))}")

    vec = TfidfVectorizer(token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z0-9]",
                          ngram_range=(1, 2), min_df=3, max_features=30000)
    X = vec.fit_transform(C)
    pw = (Y == 0).sum() / max(Y.sum(), 1)
    gkf = GroupKFold(5); ya, pa = [], []
    for tr, te in gkf.split(X, Y, G):
        if Y[tr].sum() < 5 or len(set(Y[te])) < 2:
            continue
        m = LGBMClassifier(n_estimators=500, learning_rate=0.05, num_leaves=127,
                           scale_pos_weight=pw, random_state=42, n_jobs=-1, verbose=-1)
        m.fit(X[tr], Y[tr]); ya += list(Y[te]); pa += list(m.predict_proba(X[te])[:, 1])
    print(f"[2] 그룹 홀드아웃  ROC-AUC {roc_auc_score(ya,pa):.3f} | "
          f"PR-AUC {average_precision_score(ya,pa):.3f}")
    print("※ 대규모 정밀 라벨이라 우리 12-repo(0.69)보다 안정적 성능 기대.")


if __name__ == "__main__":
    main()
