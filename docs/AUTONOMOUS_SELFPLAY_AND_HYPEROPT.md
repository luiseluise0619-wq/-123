# 자율 대항 훈련과 CVEfixes 언어별 최적화

AegisAI의 자율 대항 훈련은 승인된 로컬 교육 시나리오에서만 레드팀·블루팀·정적 분석 심판을 반복 실행한다. 코드 실행, 네트워크 대상 접근, 익스플로잇 전달, 자동 패치 적용은 포함하지 않는다. 각 사이클은 코드가 아닌 집계 성능 수치만 JSONL 로그로 남긴다.

> 반복 훈련의 새 라벨은 모델의 자기 예측이 아니라 Bandit 심판 결과에서만 얻는다. 따라서 모델이 자기 오류를 정답으로 되먹임하지 않는다.

## 반복 자율 대항 훈련

`run_autonomous_red_blue.py`는 사이클마다 시나리오 시작 위치를 이동해 전체 교육 카탈로그를 순환한다. 각 사이클 전에는 기준 샘플과 이전 심판 검증 피드백으로 로컬 모델을 재학습하고, 블루팀 패치의 성공은 재스캔에서 규칙이 사라졌는지로 판정한다.

```bash
cd -123
python run_autonomous_red_blue.py \
  --cycles 8 \
  --rounds-per-cycle 5 \
  --log reports/selfplay_cycles.jsonl \
  --summary reports/selfplay_summary.json
```

| JSONL 필드 | 의미 |
| --- | --- |
| `red_judge_detection_rate` | 레드팀 교육 시나리오를 심판이 정적으로 발견한 비율 |
| `model_judge_agreement_rate` | 모델 이진 판단과 심판 발견 여부가 일치한 비율 |
| `blue_patch_verified_rate` | 해당 사이클의 시나리오에서 블루팀 변경 후 재스캔으로 규칙 해소가 검증된 비율 |
| `blue_human_review_rate` | 결정적 자동 패치가 없어 사람 검토로 남은 시나리오 비율 |
| `change_from_previous_cycle` | 바로 이전 사이클과 비교한 성능 변화 |

실제 4개 사이클·사이클당 5라운드 실행에서는 심판 탐지와 모델-심판 일치가 모두 100.0%, 재스캔 검증 패치 비율은 40.0%, 사람 검토 비율은 80.0%로 기록됐다. 이 수치는 소규모 승인 시나리오 카탈로그에서의 훈련 지표일 뿐, 외부 시스템 또는 실제 운영 코드의 보안 수준을 의미하지 않는다.

## CVEfixes 전체 데이터 언어별 하이퍼파라미터 탐색

`optimize_cvefixes_languages.py`는 제한값을 생략하면 로컬 CVEfixes SQLite 데이터베이스에서 사용 가능한 모든 수정 전·후 메서드 쌍을 사용한다. 언어별로 라플라스 평활화 계수와 최소 재현율 목표의 격자를 탐색한다. 후보 선택은 그룹 홀드아웃 검증 세트에서만 수행되며, 선택한 설정은 전체 해당 언어 데이터에 다시 적합한다.

```bash
cd -123
python optimize_cvefixes_languages.py \
  --db /absolute/path/to/CVEfixes.db \
  --output-dir models/cvefixes_optimized
```

기본 탐색값은 평활화 계수 `0.25, 0.5, 1.0, 2.0`과 최소 재현율 `75%, 80%, 85%, 90%`다. 소규모 동작 검증에는 `--limit 1000`처럼 제한을 지정할 수 있지만, 전체 학습에는 제한을 생략한다.

| 선택 기준 | 가중치 |
| --- | ---: |
| F1 | 0.50 |
| 재현율 | 0.25 |
| 정밀도 | 0.15 |
| 수정 후 하드 네거티브 오탐률 | −0.10 |

출력 디렉터리에는 언어별 모델 아티팩트와 `hyperparameter_search_report.json`이 생성된다. 보고서에는 선택한 평활화 계수, 최소 재현율 목표, 검증 임계값, 검증 지표, 후보별 비교가 기록되지만 원본 소스 코드는 포함되지 않는다.

## 대시보드 접속

블루팀 평가 대시보드는 로컬 서버에서 다음 주소로 접속한다.

```text
http://127.0.0.1:8001/blue-dashboard
```

현재 세션에서 해당 주소를 브라우저로 열었다. 화면에서 공식 CVEfixes SQLite 파일명을 지정하면 언어별 모델의 정확도·재현율·오탐률, 수정 후 하드 네거티브 해석, 승인 레드팀 시나리오별 블루팀 대응·재스캔 결과를 확인할 수 있다.

## 데이터·안전 경계

CVEfixes는 수정 전·후 소스와 메서드 수준 변경 정보를 관계형 데이터베이스에 제공하며, `method_change.before_change` 필드로 메서드가 수정 전 취약 버전인지 나타낸다.[1] 공식 배포본의 SQL 덤프를 SQLite로 변환한 뒤 경로를 전달한다.[2] 모든 스크립트는 데이터베이스와 시나리오 코드를 텍스트로만 읽고 실행하지 않는다.

## References

[1] [CVEfixes Data Dictionary — `method_change.before_change`](https://github.com/secureIT-project/CVEfixes/blob/main/Doc/DataDictionary.md)

[2] [CVEfixes Installation Guide — SQL dump to SQLite conversion](https://github.com/secureIT-project/CVEfixes/blob/main/INSTALL.md)
