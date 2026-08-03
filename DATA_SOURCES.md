# 실제 CVE 라벨 취약점 데이터셋 — 전체 링크 모음

모두 **진짜 라벨**(NVD 실제 CVE 또는 보안연구팀 수작업 라벨) 데이터다.
"학습 라벨 20개 → 2만+개"로 성능 상한이 AUC 0.6 → 0.95 로 뚫린 이유가 이 데이터다.

## ✅ 지금 이 저장소가 쓰는 것 (GitHub raw — 어디서든 바로 받아짐)

| 데이터셋 | 규모 | 언어 | 링크 |
| --- | --- | --- | --- |
| **VulDeePecker CWE-119** | gadget ~39,753 (취약 10,440) | C/C++ | https://github.com/CGCL-codes/VulDeePecker |
| **VulDeePecker CWE-399** | gadget ~21,885 | C/C++ | https://github.com/CGCL-codes/VulDeePecker |

→ `python fetch_cve_data.py` 로 자동 다운로드, `python cve_train.py` 로 학습.
   라벨 근거: NVD 실제 CVE(CVE-2010-1444 등) + NIST SARD.

## 🔗 더 크고 좋은 것 (본인 PC/코랩에서 권장 — 여기 샌드박스는 Drive/HF 막힘)

| 데이터셋 | 규모 | 라벨 근거 | 링크 |
| --- | --- | --- | --- |
| **DiverseVul** ⭐ | 함수 330,492 (취약 18,945) | 7,514개 실제 CVE 수정커밋 | https://github.com/wagner-group/diversevul |
| **BigVul** | 함수 188,636 (취약 10,900) | 348개 프로젝트 CVE | https://github.com/ZeoVan/MSR_20_Code_vulnerability_CSV_Dataset |
| **CVEfixes** | 5,495 CVE / 5,365 커밋 | NVD+GitHub 자동수집 | https://github.com/secureIT-project/CVEfixes |
| **Devign** | 함수 27,318 | FFmpeg/Qemu 수작업 라벨 | https://github.com/epicosy/devign |
| **ReVeal** | 함수 22,734 | Chromium/Debian 실 취약 | https://github.com/VulDetProject/ReVeal |
| **PrimeVul** ⭐ | 함수 236,000+ | 엄격 검증된 CVE 라벨(최신) | https://github.com/PurCL/PrimeVul |
| **CrossVul** | 27개 언어 CVE | 실제 CVE 커밋 | https://github.com/CrossVul/data (Zenodo) |
| **Draper VDISC** | 함수 127만 | 정적분석+CVE | https://osf.io/d45bw/ |

⭐ = 추천. **DiverseVul / PrimeVul** 이 지금 학계 표준. 규모·라벨 품질 최고.

## 🐍 파이썬 취약점 데이터 (이 저장소 파이프라인과 언어 일치)

| 데이터셋 | 내용 | 링크 |
| --- | --- | --- |
| **Py150 + CVE 매핑 / CVEfixes(Python 필터)** | 파이썬 CVE 수정 | https://github.com/secureIT-project/CVEfixes |
| **SecurityEval** | 파이썬 취약 코드 벤치 | https://github.com/s2e-lab/SecurityEval |
| **OSV.dev API** | 전 생태계 실취약점+패치 | https://osv.dev  (api.osv.dev) |
| **GitHub Advisory (GHSA)** | 큐레이션된 실 취약점 | https://github.com/github/advisory-database |

## 📌 접근성 메모 (이 원격 샌드박스 기준)
- ✅ 열림: `raw.githubusercontent.com`(GitHub raw), PyPI
- ❌ 막힘: Google Drive, Zenodo, HuggingFace, api.osv.dev, download.pytorch.org
- → Drive/HF 데이터(DiverseVul·PrimeVul 등)는 **본인 PC나 Google Colab**에서
  받아서 같은 `cve_train.py` 방식으로 학습하면 됨(규모 커서 GPU 권장).

## 다음 단계 제안
1. **DiverseVul(33만 함수)** 를 Colab에서 받아 학습 → CWE-119 넘어 전체 CWE 커버
2. 파이썬 프로젝트라면 **CVEfixes 로 Python CVE만 추출** → 이 저장소와 언어 통일
3. 지금 CWE-119 모델을 그대로 `ml/inference.py` 에 연결(TF-IDF+LightGBM 교체)
