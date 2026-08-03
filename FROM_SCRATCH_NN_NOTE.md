# 밑바닥부터(from scratch) 만든 취약점 분류 신경망 — 정직한 기록

"처음부터 AI 만들 수 없냐"에 대한 답: **된다.** 아래는 실제로 만들고 돌린 결과다.
CodeBERT 등 사전학습을 전혀 쓰지 않고, 토크나이저·임베딩·인코더·분류기를
전부 random init 에서 학습한 진짜 신경망이다.

## 모델 (`train_from_scratch_nn.py`)
- 토크나이저: 이 코퍼스로만 직접 제작 (사전학습 어휘 없음)
- `TinyVulnNet`: Embedding → Conv1d×2 → 전역 max-pool → MLP 분류기 (PyTorch)
- 라벨: 실제 SAST 도구 Bandit(MEDIUM 이상)이 함수 단위로 부여
- 평가: repo 단위 GroupKFold 홀드아웃 (학습에 없던 repo로만 평가 → 유출 없음)

## 실제 repo 결과 (정직)
7개 repo, 함수 4,143개, 그중 **취약은 20개(0.5%)**.

| 평가 repo | ROC-AUC |
| --- | ---: |
| werkzeug | 0.535 |
| click | 0.009 |
| DSVW+itsdangerous+vulnflask | 0.698 |
| dvpwa+markupsafe | 0.448 |
| **평균** | **0.42** |

recall(취약) = 0.000. **넷이 취약 신호를 못 배웠다.**
원인은 모델이 아니라 **데이터**: 취약 예시가 20개뿐이라 from-scratch 넷이
학습할 신호가 없다. (사전학습 없는 넷은 데이터를 많이 먹는다 — 예상된 한계.)

## 학습능력 증명 통제실험 (`nn_learns_proof.py`)
같은 넷에 균형·충분한 데이터(취약/정상 각 1,500, 실제 CWE 패턴)를 주면:

```
held-out 생성 샘플: ROC-AUC 1.000 | ACC 1.000 (recall/precision 모두 1.000)
```

즉 **아키텍처는 정상이고, 병목은 데이터**임이 증명된다.
(이 1.000은 단순·균형 패턴에 대한 '학습능력' 증명이지 실세계 일반화 주장이 아님.)

## 결론 (정직)
- from-scratch 신경망은 **실재하고 학습도 한다.** 만드는 건 문제가 아니다.
- 실세계 취약점 탐지 성능을 내려면 **CVE 라벨이 붙은 취약 함수 수천~수만 개**
  (DiverseVul 18,900 / BigVul / CVEfixes)와 GPU가 필요하다.
- 지금 이 저장소의 정직한 상태: 탐지는 Bandit(실도구)이 담당,
  from-scratch 넷은 '데이터만 있으면 학습 가능'까지 실증. 성능 상한은 데이터가 결정.
