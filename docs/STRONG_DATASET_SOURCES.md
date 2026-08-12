# 대규모 보안 취약점 데이터셋 출처

## 실제 사용한 데이터

| 데이터셋 | 확보 경로 | 파일 형식 | 확인된 규모·범위 |
| --- | --- | --- | --- |
| Big-Vul | [Hugging Face mirror](https://huggingface.co/datasets/bstee615/bigvul), 원 출처는 [MSR 2020 GitHub repository](https://github.com/ZeoVan/MSR_20_Code_vulnerability_CSV_Dataset) | Parquet | 학습 150,908행, 검증 33,049행, 테스트 33,050행. C/C++ 중심이며 `func_before`, `vul`, `project`를 사용했다. |
| DiverseVul | [공식 GitHub repository](https://github.com/wagner-group/diversevul) 및 [Hugging Face mirror](https://huggingface.co/datasets/bstee615/diversevul) | Parquet | 학습 264,393행, 검증 33,049행, 테스트 33,050행. C/C++ 함수와 `target`, `project`를 사용했다. 공식 README는 7,512개 커밋 메타데이터와 병합 데이터셋 분할을 안내한다. |
| PyCode-Vul | [Hugging Face dataset](https://huggingface.co/datasets/S-AIR-L/PyCode-Vul) | CSV | 학습 14,248행, 테스트 3,563행. Python 취약 함수·수정 함수 쌍과 `label`/`class`를 사용했다. |
| CVEfixes mirror | [DetectVul/CVEFixes on Hugging Face](https://huggingface.co/datasets/DetectVul/CVEFixes), 원 출처는 [CVEfixes GitHub](https://github.com/secureIT-project/CVEfixes) | Parquet | 학습 4,584행, 테스트 1,146행. `lines`, `raw_lines`, `label`, `type`을 보유한다. |

Big-Vul 원 논문·배포 정보는 3,754개 취약점과 348개 GitHub 프로젝트에서 추출한 C/C++ 데이터셋으로 설명한다.[1] DiverseVul 공식 README는 원 데이터 다운로드, 커밋·저장소 메타데이터 및 BigVul·Devign·ReVeal·CrossVul·CVEfixes 병합 분할 링크를 제공한다.[2]

## 모델 적용 범위

현재 강화 모델은 Big-Vul과 DiverseVul을 결합해 C/C++ 모델을 학습하고, PyCode-Vul의 취약 함수 및 수정 후 함수로 Python 모델을 학습한다. 학습 코드는 원본 코드를 실행하지 않고 텍스트·라벨·메타데이터만 읽는다. 제공된 학습·검증·테스트 분할을 유지하며, 검증 세트에서만 임계값을 선택한 후 테스트 세트에 한 번 적용한다.

다운로드 파일의 실제 라벨 분포와 행 수는 `/home/ubuntu/inspect_strong_data.py` 및 `/home/ubuntu/profile_strong_data.py`로 확인했다. 학습 아티팩트는 저장소에 커밋하지 않고 로컬 `models/strong_v1/`에 둔다.

## 주의 사항

Hugging Face 미러는 공식 원본을 편리하게 제공하지만, 미러의 무결성과 라이선스 조건을 배포 전에 재확인해야 한다. 데이터셋 간 중복·라벨 노이즈·프로젝트 단위 누수 가능성이 있으므로, 지표는 데이터셋별·언어별·프로젝트 그룹별로 분리해 해석해야 한다. 모델 점수는 우선순위 신호이며, AegisAI의 최종 탐지와 패치 성공은 계속 정적 분석 심판의 재스캔 결과로 확정한다.

## References

[1] [MSR 2020 Big-Vul repository and dataset description](https://github.com/ZeoVan/MSR_20_Code_vulnerability_CSV_Dataset)

[2] [DiverseVul official repository and dataset links](https://github.com/wagner-group/diversevul)

[3] [DiverseVul Hugging Face file listing](https://huggingface.co/datasets/bstee615/diversevul/tree/main)

[4] [PyCode-Vul Hugging Face dataset](https://huggingface.co/datasets/S-AIR-L/PyCode-Vul)

[5] [CVEfixes Hugging Face dataset mirror](https://huggingface.co/datasets/DetectVul/CVEFixes)
