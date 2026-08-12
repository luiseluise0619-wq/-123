# 언어별 모델 튜닝 및 CVEfixes 블루팀 패치 학습

이 파이프라인은 하나의 언어에서 얻은 단순 토큰 패턴을 다른 언어에 그대로 적용하는 문제를 줄이기 위해 **언어별 모델**, **검증 세트 전용 임계값**, **수정 후 하드 네거티브**를 사용한다. 모든 코드는 학습 데이터의 텍스트를 읽을 뿐 가져오기·컴파일·실행하지 않으며, 블루팀의 패치 제안은 Bandit 재스캔으로 검증되기 전까지 해결로 취급하지 않는다.

> 모델의 확률은 우선순위 신호다. 취약점 존재와 패치 성공은 실제 정적 분석 심판의 결과로만 확정한다.

## 구성 요소

| 파일 | 책임 |
| --- | --- |
| `security_engine/language_model_tuner.py` | 언어별 모델을 학습하고 검증 세트에서 임계값을 선택한다. |
| `security_engine/cvefixes_patch_pipeline.py` | CVEfixes의 수정 전·후 메서드를 취약 예제와 수정 후 하드 네거티브로 변환하고, 소스 비노출 패치 증거 검색을 제공한다. |
| `retrain_cvefixes_blue.py` | 변환된 CVEfixes SQLite 데이터베이스에서 언어별 모델과 보고서를 생성한다. |
| `tests/test_language_tuning_and_cvefixes.py` | 임계값 선택, 언어 분리, 하드 네거티브, 메타데이터 전용 증거 검색을 검증한다. |

## 검증 세트 기반 임계값 튜닝

각 언어의 데이터는 CVE 또는 커밋 그룹 기준으로 약 80/20으로 분리된다. 모델은 학습 분할로만 적합하고, 임계값 후보는 검증 분할에서만 평가한다. `minimum_recall` 이상을 만족하는 후보 중 정밀도가 가장 높은 임계값을 우선 선택하며, 어떤 후보도 목표 재현율을 만족하지 못하면 F1이 가장 높은 후보를 선택하고 선택 사유를 보고서에 남긴다.

| 지표 | 목적 |
| --- | --- |
| 정밀도 | 개발자가 검토해야 할 오탐을 줄이는지 확인한다. |
| 재현율 | 알려진 취약 예제를 놓치지 않는지 확인한다. |
| F1 | 정밀도와 재현율이 모두 필요한 경우의 균형 지표다. |
| 거짓양성률 | 비취약 함수를 취약으로 잘못 분류하는 비율을 직접 점검한다. |

## CVEfixes에서 하드 네거티브 만들기

CVEfixes 데이터 사전은 `method_change.before_change`을 취약 여부로 설명한다. 파이프라인은 같은 파일 변경과 메서드 식별자에서 `before_change=True`인 수정 전 메서드를 취약 라벨로, `before_change=False`인 수정 후 메서드를 **하드 네거티브**로 만든다. 수정 후 코드는 취약 코드와 구조적으로 가깝지만 안전한 상태이므로, 단순 키워드 때문에 발생하는 오탐을 줄이는 데 사용된다.[1]

패치 증거 검색은 언어가 같은 수정 전 메서드를 토큰 유사도로 순위화하지만, 원본 취약 코드나 패치 코드를 반환하거나 자동 적용하지 않는다. 반환되는 것은 CVE ID, 언어, 유사도, 재스캔 필요 여부 같은 메타데이터뿐이다. 블루팀은 그 증거를 참고할 수 있으나, 실제 수정은 결정적 규칙 또는 사람 검토로 수행하고 Bandit 재스캔을 거쳐야 한다.

## 실행 준비

CVEfixes의 공식 배포본은 압축 SQL 덤프 형태다. 공식 안내에 따라 SQL 덤프를 SQLite 데이터베이스로 변환한 뒤 아래 스크립트에 경로를 전달한다.[2]

```bash
cd -123
python retrain_cvefixes_blue.py \
  --db /absolute/path/to/CVEfixes.db \
  --models-dir models/cvefixes_languages \
  --minimum-recall 0.85
```

스크립트는 언어별 모델 아티팩트, `training_report.json`, `patch_evidence_metadata.json`을 생성한다. `joblib`이 설치된 환경에서는 `.joblib`로, 그렇지 않은 환경에서는 표준 라이브러리 `pickle`을 사용한 `.pkl`로 모델을 저장한다. 보고서에는 언어별 문서 수, 하드 네거티브 수, 검증 지표, 선택된 임계값과 선택 근거가 포함되며 원본 소스는 저장하지 않는다.

## 안전 및 해석 경계

이 구현은 공개 CVE 수정 데이터를 방어 모델 학습에 사용한다. 실제 대상 스캔, 네트워크 공격, 익스플로잇 실행, 자동 패치 적용은 포함하지 않는다. 또한 CVEfixes의 언어·프로젝트 분포와 현재 대상 코드의 분포가 다를 수 있으므로, 모델 성능은 언어별·프로젝트별 홀드아웃 결과와 정적 분석 심판 결과를 함께 읽어야 한다.

## References

[1] [CVEfixes Data Dictionary — `method_change.before_change` field](https://github.com/secureIT-project/CVEfixes/blob/main/Doc/DataDictionary.md)

[2] [CVEfixes installation guide — SQL dump to SQLite conversion](https://github.com/secureIT-project/CVEfixes/blob/main/INSTALL.md)
