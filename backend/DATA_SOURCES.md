# 데이터 출처 & 실제 공공데이터 연동 가이드

## ⚠️ 현재 상태 (정직성 고지)

이 저장소에 기본 포함된 학습 데이터(`app/data/sample_real_data/`)는
**실제 공공데이터가 아니라 통계 분포로 생성한 합성(synthetic)/시드 데이터**입니다.

| 파일 | 성격 | provenance |
|------|------|------------|
| `seoul_bigdata_multi_thousand_2026.csv` (4,644행) | 합성 데이터 | `synthetic` |
| `seoul_commercial_districts_2026.csv` (20행) | 수기 시드 샘플 | `seed_sample` |

또한 합성 데이터의 정답(매출)은 입력 변수들의 **정해진 계산식**으로 만들어졌기 때문에,
모델이 높은 R²/정확도를 보여도 이는 **가짜 공식을 역산한 것**이며 실제 상권 예측 성능을 의미하지 않습니다.

➡️ **실제 서비스로 쓰려면 아래 실제 공공데이터로 교체하고 재학습해야 합니다.**

---

## 🔌 실제 데이터 연동 방법

### 1) API 키 발급 (모두 무료)
- 서울 열린데이터광장: https://data.seoul.go.kr → 인증키 발급
- 공공데이터포털: https://data.go.kr → 활용신청 → 인증키 발급

### 2) 환경변수 설정
```bash
export USE_REAL_DATA=true
export SEOUL_OPENDATA_API_KEY="발급받은_서울_인증키"
export DATA_GO_KR_API_KEY="발급받은_공공데이터포털_인증키"
```
설정하지 않으면 `public_api.py` 는 자동으로 합성 폴백값을 반환하며,
반환 dict 의 `"source"` 필드가 `"synthetic_fallback"` 으로 표기됩니다.
실제 API 응답일 때만 `"source": "live_api"` 입니다.

---

## 📚 변수별 실제 데이터 소스 (서울 MVP 기준, 전부 무료)

| 카테고리 | 변수 | 소스 |
|----------|------|------|
| 인구·소비·유동·점포·**추정매출** | pop_total, foot_traffic_*, card_sales_avg, 점포수 등 | 서울 우리마을가게 상권분석 (data.seoul.go.kr) |
| 경쟁 점포 좌표 | competitor_count_100m/500m | 소상공인 상가정보 (data.go.kr) |
| 정밀 유동인구(시간대) | foot_traffic_lunch/dinner | 서울 생활인구 (data.seoul.go.kr) |
| 임대료·공실 | rent_per_m2, vacancy_rate | 한국부동산원 R-ONE |
| 교통 | transit_passengers_daily | 지하철 승하차 (data.seoul.go.kr) |
| 지오코딩·실시간 점포 | lat, lng | 카카오맵 로컬 API |

> 한 소스가 수십 개의 컬럼을 제공하므로, 현재 `FEATURE_NAMES`(약 28개)보다 훨씬 많은
> 후보 변수를 확보할 수 있습니다. "다 넣고 → EDA → 영향력 선별" 전략에 충분합니다.

---

## 🔁 실제 데이터로 재학습하는 순서

1. 위 소스에서 CSV 를 만들어 `RealDataIngestionPipeline(csv_filepath=...)` 로 지정
   (사용자 지정 CSV 는 `data_provenance="real_public_data"` 로 표기됨)
2. `python -m app.ml.eda`          # 분포·상관 파악
3. `python -m app.ml.leakage_audit` # 누수 변수 제거 + 홀드아웃 검증(정직한 판정)
4. `python -m app.ml.train`        # 학습 (provenance 가 model_card/metadata 에 기록됨)
