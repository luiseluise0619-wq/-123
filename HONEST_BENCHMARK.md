# 정직한 벤치마크 — 데이터 종류별 실제 성능

여러 데이터셋을 다 받아 정제·학습한 뒤 얻은 정직한 결론. 핵심은 하나다:
**합성 데이터의 높은 점수는 진짜 실력이 아니다. 실제 코드에선 ~0.6 이 정직한 상한.**

## 데이터셋별 결과 (전부 정제 후, 프로그램/프로젝트 홀드아웃)

| 데이터셋 | 규모 | 취약률 | ROC-AUC | 성격 |
| --- | ---: | ---: | ---: | --- |
| MVD (muVulDeePecker) | 60k | 24% | ~1.00 | ⚠️ 70% SARD 합성 — **가짜로 높음** |
| VulDeePecker 119/399 | 28k | 38% | 0.96–0.99 | ⚠️ SARD 섞임 — 부풀려짐 |
| Devign (FFmpeg/Qemu) | 27k | 46% | 0.52→0.68 | ✅ 실제 프로젝트 코드 |
| **자체 마이닝(실 C 라이브러리 6개)** | 2.8k | 6.8% | **0.60** | ✅ **가장 정직** (실전형 불균형) |

자체 마이닝 = tcpdump·libtiff·libpng·libarchive·file·libgd 의 **실제 CVE 수정커밋**에서
`build_vuln_db.py` 로 취약(수정전)/정상 함수를 추출. leave-one-project-out 평가
(학습에 없던 프로젝트로만 테스트 — 가장 엄격).

### 프로젝트별 (leave-one-project-out)
| 평가 프로젝트 | AUC |
| --- | ---: |
| libarchive | 0.640 |
| libpng | 0.631 |
| libgd | 0.597 |
| libtiff | 0.569 |
| file | 0.491 |
| (tcpdump: 취약 1개라 무의미) | — |
| **종합** | **0.601** (PR-AUC 0.101, 취약률 6.8%) |

## 확장 마이닝 (16개 CVE-rich 라이브러리, "미니 DiverseVul")

tcpdump·libtiff·libpng·libarchive·file·libgd·openjpeg·curl·libexpat·zlib·libssh2·
ImageMagick·Little-CMS·libjpeg-turbo·libzip·libyaml 에서 마이닝.
19,853 함수 / 취약 1,386 (dedup 후 8,987 함수 / 취약 954, 10.6%), 실제 CVE 41개.
GroupKFold(프로젝트 단위):

| | ROC-AUC | PR-AUC |
| --- | ---: | ---: |
| 정제 전(raw) | **0.411** | 0.092 |
| 정제 후 | **0.623** | 0.177 |

**raw 0.41(랜덤 이하)의 의미:** 커밋메시지 휴리스틱 라벨은 노이즈가 크다(보안 커밋도
취약과 무관한 함수를 함께 수정). → **라벨 품질이 병목**임을 실측. OSV/NVD 정확
CVE→커밋 매핑으로 라벨을 정제하면 더 오른다. "양보다 정확 라벨"의 정량 증거.

## 결론 (정직)

1. **SARD/VulDeePecker/MVD 의 0.96~1.0 은 신기루다.** 합성 테스트케이스는
   파일명·패턴만 봐도 취약/정상이 갈려 모델이 "진짜 취약점"이 아니라 템플릿을 외운다.
2. **실제 코드의 정직한 성능은 ROC-AUC ~0.60** (TF-IDF+LightGBM, 처음 보는 프로젝트).
   이는 Devign(0.52–0.68) 및 학계 보고와 일치한다. 실무 취약점 탐지는 원래 어렵다.
3. **PR-AUC 0.10 (취약률 6.8%)** — 랜덤(0.068)보다 1.5배지만, 실전 배포엔 부족.
   더 올리려면: (a) 그래프/데이터흐름 모델(Devign GGNN 계열), (b) 더 많은 실제 CVE
   (DiverseVul 33만·PrimeVul), (c) 사전학습(CodeBERT/GraphCodeBERT).
4. **양보다 '실제 코드 + 정확 라벨'.** 수천만 합성보다 수만 실제가 낫다.

## 오늘 받은 데이터 전부 (여기서 처리)
- VulDeePecker CWE-119/399, Devign, muVulDeePecker(MVD) — GitHub 에서 수집
- 자체 마이닝 DB (실 C 라이브러리 6개) — `build_vuln_db.py`
- 큰 데이터(DiverseVul/PrimeVul)는 `colab_diversevul_train.ipynb` 로
