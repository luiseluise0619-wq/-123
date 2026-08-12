# AegisAI 대규모 강화 모델 학습

## 개요

AegisAI는 공개 취약점 코퍼스를 실행하지 않고 텍스트와 라벨만 읽어 언어별 모델을 학습한다. C/C++에는 Big-Vul과 DiverseVul을 결합하고, Python에는 PyCode-Vul과 CVEfixes의 라인 라벨 함수를 통합한다. 데이터셋의 제공된 학습·검증·테스트 분할을 유지하며, 검증 세트에서만 최소 재현율 목표를 만족하는 임계값을 선택한다.

## 실행

먼저 공개 파일을 로컬 코퍼스 디렉터리에 내려받는다.

```bash
cd -123
python fetch_strong_data.py
```

그 다음 언어별 모델을 학습한다. `--language`는 여러 번 지정할 수 있으며, 아래 명령은 현재 사용한 CPU 친화적 설정이다.

```bash
python train_strong_models.py \
  --data-root /home/ubuntu/cvedata \
  --output-dir models/strong_v1 \
  --language c_cpp \
  --language python \
  --epochs 2 \
  --features 131072 \
  --minimum-recall 0.80
```

모델은 hashing word-bigram 표현과 averaged SGD logistic classifier를 사용한다. 이 구조는 기존의 작은 나이브 베이즈 우선순위 모델보다 표현력이 높고, 대용량 코퍼스를 CPU에서 스트리밍에 가깝게 처리할 수 있다. 모델 아티팩트와 보고서는 `models/strong_v1/`에 저장되며, 원본 소스 코드는 저장하지 않는다.

## 실제 학습 결과

이번 실행에서는 C/C++ 학습 문서 362,970건과 Python 학습 문서 20,999건을 사용했다. Python 문서 수에는 CVEfixes 학습 함수를 추가한 결과가 포함된다.

| 언어 | 테스트 문서 | 정확도 | PR-AUC | 재현율 | 오탐률 | 선택 임계값 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C/C++ | 63,164 | 54.9% | 11.9% | 80.5% | 46.3% | 0.0437 |
| Python | 3,558 | 86.6% | 94.1% | 80.1% | 8.1% | 0.1694 |

C/C++의 오탐률이 높으므로 해당 모델은 자동 차단이나 자동 패치의 근거로 사용하면 안 된다. 반대로 Python 모델도 테스트 세트에서의 수치일 뿐, 새로운 프로젝트나 다른 라벨 체계에서 같은 성능을 보장하지 않는다. 모든 최종 판단은 기존처럼 정적 분석 심판과 재스캔으로 확정한다.

## 레드팀·블루팀 연결

학습 완료 후 최신 모델은 다음 API로 조회하거나 예측에 사용할 수 있다.

```text
GET  /api/v1/strong-models/report
POST /api/v1/strong-models/predict
POST /api/v1/training/red-blue
```

`/api/v1/training/red-blue`에는 `training_corpus: "strong-language-models"`를 지정할 수 있다. 이 모드는 현재 승인된 Python 교육 시나리오에 학습된 Python 모델을 연결하고, Bandit 심판이 레드팀 탐지·블루팀 패치·재스캔 결과를 최종 판정한다. 모델 확률은 시나리오 우선순위를 정하는 보조 신호일 뿐이다.

```json
{
  "rounds": 5,
  "training_corpus": "strong-language-models",
  "retrain_model": false
}
```

이번 5라운드 시뮬레이션에서 모델-심판 일치 여부는 시나리오별로 기록되며, `weak-hash`와 `shell-flag`는 결정적 패치가 재스캔으로 검증되었다. `insecure-tempfile`, `assert-check`, `predictable-session-nonce`는 자동 패치 성공으로 가장하지 않고 검토 상태를 유지한다.

## 대시보드

강화 모델 카드가 포함된 블루팀 화면은 다음 주소에서 확인한다.

```text
http://127.0.0.1:8002/blue-dashboard
```

화면은 C/C++와 Python 모델의 테스트 정확도, PR-AUC, 재현율, 오탐률, 임계값을 표시하며 CVEfixes 평가와 레드팀 대응 영역을 함께 제공한다. API 요청에는 로컬 개발용 `X-Org-Id`, `X-User-Email`, `X-User-Role` 헤더가 필요하다. 이 헤더는 운영 인증이 아니므로 외부 공개 전에 OIDC·세션·API 키 등 검증된 인증으로 교체해야 한다.

## 안전 경계와 한계

학습·평가·시뮬레이션은 소스 코드를 실행하지 않는다. 네트워크 대상에 연결하지 않으며, 모델이 제안한 결과를 자동으로 패치하거나 배포하지 않는다. 공개 데이터 미러의 라이선스와 무결성은 배포 전에 다시 확인해야 한다. 프로젝트·CVE 단위 중복과 라벨 노이즈를 완전히 제거했다고 가정하지 않으며, 실제 운영에서는 프로젝트 그룹 분할, 시간 분할, 교차 데이터셋 평가를 추가해야 한다.

## References

[1] [Big-Vul dataset repository](https://github.com/ZeoVan/MSR_20_Code_vulnerability_CSV_Dataset)

[2] [DiverseVul official repository](https://github.com/wagner-group/diversevul)

[3] [Big-Vul Hugging Face mirror](https://huggingface.co/datasets/bstee615/bigvul)

[4] [DiverseVul Hugging Face mirror](https://huggingface.co/datasets/bstee615/diversevul)

[5] [PyCode-Vul dataset](https://huggingface.co/datasets/S-AIR-L/PyCode-Vul)

[6] [CVEfixes dataset mirror](https://huggingface.co/datasets/DetectVul/CVEFixes)
