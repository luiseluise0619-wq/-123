# 이 저장소의 정직한 상태 (REAL vs 남은 것)

이 프로젝트는 원래 AI 에이전트가 만들면서 상당수 컴포넌트가 **가짜(연극)**였다
— 정규식을 "CodeBERT 추론"이라 부르고, `time.sleep()`을 "학습"이라 하고,
하드코딩한 응답을 "샌드박스 증거"라 주장하는 식. 아래는 실제로 **진짜로 작동하게**
교체한 것과, 아직 남은 것을 숨김없이 적는다.

## ✅ 진짜로 작동함 (실제 도구·실제 학습·객관 검증)

| 파일 | 무엇이 진짜인가 |
| --- | --- |
| `security_engine/real_detector.py` | 실제 **Bandit** 정적분석 래퍼. CWE/severity/line 실제 반환 |
| `ml/inference.py` | Bandit 실결과 + (있으면)학습모델 확률. `model_available` 정직 표기 |
| `ml/train.py` | 실제 repo 클론→Bandit 라벨→TF-IDF+LogReg **진짜 학습**, repo홀드아웃 평가, joblib 저장 |
| `security_engine/vulnerability_detector.py` | 실제 탐지결과 요약 + severity/confidence 기반 위험도 |
| `security_engine/business_logic_agent.py` | 익스플로잇 날조 제거. '검토 필요' 신호만 정직 표기 |
| `security_engine/evidence_validator.py` | 패치 전/후 **재스캔**으로 해결 객관 검증 + SHA-256 증거 |
| `security_engine/integrated_auditor.py` | 탐지→추론→패치→재스캔검증 실제 파이프라인 (하드코딩 점수 없음) |
| `security_ai_core.py` | 4-에이전트 self-healing 루프. Reviewer 가 재스캔으로 검증 |
| `real_benchmark.py` | 실제 취약 repo 클론 후 Bandit 스캔, 실제 카운트 |
| `train_real_model.py` | 실제 repo 라벨 학습(LightGBM), repo홀드아웃 |
| `train_from_scratch_nn.py` | **밑바닥부터** 신경망(PyTorch, random init, 사전학습 없음) |
| `nn_learns_proof.py` | 균형데이터로 넷 학습능력 증명(AUC 1.0) — 병목이 데이터임을 입증 |
| `adversarial_loop.py` | Red/Blue/Judge 자가학습. 보상은 실제 스캐너가 부여 |
| `osv_ingest.py` | 실제 OSV.dev API 지식베이스 수집(온라인 시) |
| `auto_pr_generator.py` | 진짜 unified diff(git apply 가능) 생성. 가짜 PR/CI 주장 제거 |

### 정직한 성능 (지어낸 수치 아님)
- 함수 분류(실 repo, Bandit 라벨 20개, repo 홀드아웃): **ROC-AUC ≈ 0.6** (데이터 부족)
- **실 CVE 라벨 2만개**(VulDeePecker CWE-119/399, 중복제거+프로그램홀드아웃):
  **ROC-AUC 0.96 / recall 0.87** ← 데이터를 키우니 천장이 뚫림
- **Devign**(순수 실프로젝트 함수, TF-IDF): **ROC-AUC 0.52 (거의 랜덤)**
  → 취약/패치 함수가 표면상 거의 동일. 어려운 실데이터엔 그래프/dataflow 모델 필요(정직).
- 밑바닥 신경망: 취약 20개 → AUC 0.42(실패) / 균형 충분데이터 → AUC 1.0
  → **병목은 모델이 아니라 데이터**
- **불균형 처리**(취약 2%로 downsample): 무처리는 정확도 0.985 인데 취약 62% 놓침.
  class_weight/scale_pos_weight/임계값튜닝으로 recall 0.375→0.68. **정확도는 함정, PR-AUC/recall 로 평가.**
- 자동 패치 — **의미적으로 올바른 결정적 변환만** 적용하고 Bandit 재스캔으로 해결 검증:
  md5/sha1→sha256(B324), yaml.load→safe_load(B506), assert→명시적 raise(B101).
  안전한 자동수정이 없는 것(shell=True: shell=False로 바꾸면 B602→B603로 바뀌고 코드도 깨짐,
  mktemp, pickle.loads 등)은 **가짜로 고치지 않고 `needs_llm`으로 정직 표기**.
  Red/Blue self-play(`adversarial_loop.py`)에서 심판(Bandit)이 방어 성공/실패를 객관 부여.

## ⚠️ 아직 데모/미검증 (정직한 한계)
- 실전급 성능을 내려면 **CVE 라벨 취약함수 수천~수만 개**(DiverseVul 18,900 등)와
  **GPU**가 필요. 현재 학습 데이터는 취약 샘플이 20개 안팎이라 상한이 낮다.
- **Semgrep/OSV** 는 온라인 레지스트리가 필요 — 오프라인 샌드박스에선 스킵(거짓결과 안 만듦).
- **일반 패치(임의 CWE)**: 결정적 규칙이 없는 건 `needs_llm=True` 로 정직 표기.
  진짜 자동수정을 넓히려면 LLM API 연동 필요.
- `models/security_model_v1~v3`(텍스트를 가중치로 위장한 가짜): **삭제함**.

## 재현 방법
```bash
python -m ml.train                       # 실제 학습 → models/vuln_clf.joblib
python -m security_engine.integrated_auditor   # 탐지→패치→재스캔검증 데모
python fetch_cve_data.py && python cve_train.py # 실 CVE 라벨 2만개 학습 (AUC 0.96)
python imbalance_experiment.py           # 불균형 처리(정확도 함정) 실험
python build_vuln_db.py --repos <git...> # CVE수정커밋→취약/정상 함수 DB 구축
python train_from_scratch_nn.py          # 밑바닥 신경망(실 repo)
python nn_learns_proof.py                # 신경망 학습능력 증명
python real_benchmark.py                 # 실제 취약 repo 벤치마크
```
