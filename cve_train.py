"""
실제 CVE 라벨 대규모 학습 — VulDeePecker(CWE-119) 데이터셋.

이전까지 학습 라벨은 Bandit(추측) 20개뿐이라 성능 상한이 낮았다. 이 스크립트는
**진짜 정답 라벨**(NVD 실제 CVE + NIST SARD)로 된 code gadget 39,753개
(취약 10,440)를 써서 병목을 데이터로 정면돌파한다.

데이터: https://github.com/CGCL-codes/VulDeePecker  (CWE-119, C/C++ code gadgets)
  - 각 gadget = 취약점 후보 주변 코드 조각, 마지막 줄 라벨 0/1 (실제 취약 여부)
  - 헤더의 CVE-xxxx = NVD 실제 취약점, 숫자 = SARD 합성(둘 다 라벨은 진짜)

정직한 방법론(유출 방지):
  1) 정확 중복 gadget 제거 (VulDeePecker 는 중복이 많음 — 안 하면 성능 부풀려짐)
  2) '프로그램' 단위 GroupKFold 홀드아웃 (CVE는 CVE-id, SARD는 변형번호 뗀 파일명)
     → 학습에 없던 프로그램으로만 평가. 같은 취약점의 변형을 테스트에 안 넣음.
지어낸 수치 없음. 나오는 값이 곧 결과.
"""

import glob
import os
import re
import sys
import hashlib
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cvedata")
SEP = "---------------------------------"


def parse(paths):
    """cwe*.txt 여러 파일을 모두 파싱해 합침 (CWE-119 + CWE-399 등)."""
    if isinstance(paths, str):
        paths = [paths]
    codes, labels, groups = [], [], []
    for path in paths:
        raw = open(path, encoding="utf-8", errors="ignore").read()
        tag = os.path.basename(path).replace(".txt", "")
        for block in raw.split(SEP):
            lines = [l for l in block.strip().split("\n") if l.strip() != ""]
            if len(lines) < 2 or lines[-1].strip() not in ("0", "1"):
                continue
            header = lines[0]
            label = int(lines[-1].strip())
            code = "\n".join(lines[1:-1])       # 헤더·라벨 제외한 코드
            codes.append(code); labels.append(label)
            groups.append(f"{tag}:{group_of(header)}")
    return codes, np.array(labels), np.array(groups)


def group_of(header: str) -> str:
    """소스 프로그램 식별자: CVE는 CVE-id, SARD는 변형번호 뗀 베이스."""
    toks = header.split()
    path = toks[1] if len(toks) > 1 else header
    m = re.search(r"CVE-\d+-\d+", path)
    if m:
        return m.group(0)
    base = path.split("/")[-1]                  # 파일명
    base = re.sub(r"_\d+\.c\w*$", "", base)     # 끝의 _NN.c 변형번호 제거
    return base or path


def dedup(codes, labels, groups):
    seen, C, Y, G = set(), [], [], []
    for c, y, g in zip(codes, labels, groups):
        key = hashlib.md5(re.sub(r"\s+", " ", c).strip().encode()).hexdigest()
        if key in seen:
            continue
        seen.add(key); C.append(c); Y.append(y); G.append(g)
    return C, np.array(Y), np.array(G)


def main():
    files = sorted(glob.glob(os.path.join(DATA_DIR, "cwe*.txt")))
    if not files:
        print(f"데이터 없음: {DATA_DIR}\n먼저 `python fetch_cve_data.py` 실행."); sys.exit(1)
    print("데이터 파일:", [os.path.basename(f) for f in files])
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.model_selection import GroupKFold
    from sklearn.metrics import roc_auc_score, average_precision_score, classification_report
    from lightgbm import LGBMClassifier

    print("[1] 파싱 + 중복 제거...")
    codes, y, groups = parse(files)
    n0 = len(codes)
    codes, y, groups = dedup(codes, y, groups)
    print(f"    원본 {n0} → 중복제거 {len(codes)} gadget "
          f"| 취약 {int(y.sum())} ({y.mean()*100:.1f}%) | 그룹 {len(set(groups))}개")

    print("[2] TF-IDF 벡터화 (코드 토큰 + 기호)")
    vec = TfidfVectorizer(analyzer="word",
                          token_pattern=r"[A-Za-z_]\w+|[^\sA-Za-z0-9]",
                          ngram_range=(1, 2), min_df=3, max_features=20000)
    X = vec.fit_transform(codes)
    print(f"    특징 {X.shape[1]}개")

    print("[3] 프로그램 단위 GroupKFold 홀드아웃 학습 (LightGBM)")
    gkf = GroupKFold(n_splits=5)
    aucs, aps, y_all, p_all, prob_all = [], [], [], [], []
    for k, (tr, te) in enumerate(gkf.split(X, y, groups)):
        m = LGBMClassifier(n_estimators=400, learning_rate=0.05, num_leaves=63,
                           class_weight="balanced", random_state=42, verbose=-1,
                           n_jobs=-1)
        m.fit(X[tr], y[tr])
        p = m.predict_proba(X[te])[:, 1]
        auc = roc_auc_score(y[te], p); ap = average_precision_score(y[te], p)
        aucs.append(auc); aps.append(ap)
        y_all += list(y[te]); prob_all += list(p); p_all += list((p > 0.5).astype(int))
        print(f"    fold{k}: ROC-AUC={auc:.3f} PR-AUC={ap:.3f} "
              f"(test {len(te)}, 취약 {int(y[te].sum())})")

    print("\n=== 실제 CVE 라벨 학습 — 정직한 결과 (처음 보는 프로그램) ===")
    print(f"ROC-AUC {np.mean(aucs):.3f} ± {np.std(aucs):.3f}")
    print(f"PR-AUC  {np.mean(aps):.3f} ± {np.std(aps):.3f}  (취약률 {np.mean(y)*100:.1f}% 대비)")
    print(classification_report(y_all, p_all, target_names=["safe", "vuln"], digits=3))
    print("데이터: VulDeePecker CWE-119 (NVD 실제 CVE + NIST SARD). 라벨=실제 취약 여부.")
    print("※ 중복제거 + 프로그램단위 홀드아웃으로 유출 차단. 이게 이 데이터의 정직한 상한.")


if __name__ == "__main__":
    main()
