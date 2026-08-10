# ML 성능 개선안 (정직한 로드맵)

현재 정직한 상한: **실제 오픈소스 코드 leave-one-project-out AUC ≈ 0.60**,
precise CVE 라벨링으로 **0.69**, VulDeePecker CVE 2만개(프로그램 홀드아웃) **0.96**,
Devign 순수 실함수 **0.52(거의 랜덤)**. `nn_learns_proof.py`로 **병목이 모델이 아니라 데이터**임을 입증함.

따라서 개선의 90%는 "더 좋은 모델"이 아니라 **더 많고 정확한 라벨 + 표현(representation)**이다.

## 1순위 — 데이터 (가장 효과 큼, GPU 불필요)
- **DiverseVul(18,900 취약 함수) · MegaVul · PrimeVul** 통합 적재.
  - `load_megavul.py` 이미 있음 → DiverseVul/PrimeVul 로더 추가.
  - 중복제거(함수 해시), **프로젝트 단위 GroupKFold**(누출 방지) 유지.
- **정밀 라벨링 확장**: CVE 수정커밋에서 *실제 바뀐 함수만* 취약(1)로, 나머지는 0.
  이미 `--precise`로 0.62→0.69 확인됨 → 16→50+ 라이브러리로 마이닝 확대(`build_vuln_db.py`).
- **불균형 정직 처리 유지**: accuracy 금지, **PR-AUC·recall@k**로만 평가.
  class_weight / scale_pos_weight / 임계값 튜닝(이미 recall 0.375→0.68 확인).

## 2순위 — 표현(representation) (Devign 0.52 뚫기, GPU 필요)
표면 토큰(TF-IDF)으로는 취약/패치 함수가 거의 동일 → 구조 신호 필요:
- **GraphCodeBERT / UniXcoder / CodeT5+** 임베딩으로 교체(데이터플로우 인지).
- 또는 **Code Property Graph + GNN**(Devign/ReVeal 계열): AST+CFG+DFG.
- 학습은 Colab/GPU에서(`colab_diversevul_train.ipynb` 이미 있음) — 로컬 CPU론 임베딩만 캐시.

## 3순위 — 하이브리드(당장 실전 가치, GPU 불필요)
- **규칙(Bandit/Semgrep, 고정밀) + ML(고재현) 앙상블**:
  규칙이 잡은 건 확정 리포트, ML은 규칙이 놓친 후보를 recall로 보완.
  → 웹 스캐너(패턴) + 백엔드 ML을 한 파이프라인으로 합치면 정밀·재현 둘 다.
- **신뢰도 보정(calibration)**: 확률을 그대로 신뢰하지 말고 isotonic/Platt로 보정 후
  "확실/검토필요/불확실" 3단계로 정직 표기.

## 하지 말 것 (정직성 훼손)
- 합성 데이터(SARD) 섞어 AUC 부풀리기 — 0.96~1.00은 실력 아님, 이미 배제.
- accuracy를 성능으로 보고하기 — 취약률 6% 데이터에선 "다 정상"이라 찍어도 0.94.
- LLM이 지어낸 취약/패치를 검증 없이 신뢰 — 반드시 재스캔(`evidence_validator.py`)으로 확인.

## 측정 방법(고정)
```
GroupKFold(프로젝트 단위) · PR-AUC + recall@1% FPR · leave-one-project-out 별도 리포트
```
이 지표들이 안 오르면 "개선"이 아니다. 숫자는 `HONEST_BENCHMARK.md`에 그대로 갱신.
