# 상권 수집기 업그레이드 (천장 뚫기 준비) — 네 PC에서 실행

서울 API 가 막힌 원격 환경에선 데이터를 못 받으므로, **네 PC(API 열림)** 에서
돌릴 수 있게 수집기를 업그레이드했다. 인증키는 코드에 없고 환경변수로만 받는다.

## 새로 추가된 것

1. **재시도 + 캐시/재개** (`fetch_service`)
   - 네트워크 오류 시 지수백오프 4회 재시도(2/4/8/16초)
   - 서비스별 parquet 캐시(`_cache/`) → 중단해도 다시 실행하면 이어받음
2. **타깃 세분화** (`--granular dow|tmzon`) ⭐ 천장 관련
   - 추정매출의 **요일별/시간대별 분해 컬럼**을 long-format 으로 펼침
   - zone×업종×분기 1행 → 요일 7행(또는 시간대 6행), **각 행이 자기 타깃**을 가짐
   - zone 내부의 요일·시간 변동을 타깃이 담게 됨 = **공공데이터로 얻는 최대 해상도**
   - `slice`(mon/tue/… 또는 t00_06/…)가 학습 피처로 자동 인코딩
3. **per-store 어댑터** (`--per-store 파일.csv`) ⭐⭐ 진짜 천장 돌파
   - 가게단위 실매출(카드사·POS·배달앱) CSV 를 넣으면 학습 프레임에 병합
   - 필수 컬럼: `store_id, TRDAR_CD, SVC_INDUTY_CD, STDR_YYQU_CD, store_monthly_revenue`
   - 공공데이터의 zone-평균 타깃을 per-store 타깃으로 바꾸는 유일한 길
4. **provenance 기록** (`real_data/provenance.json`)
   - 언제·어떤 서비스·몇 행·몇 분기·세분화 여부를 정직하게 남김
5. **아파트-상권 서비스** 추가(`VwsmTrdarAptQq`) — `--test` 로 서비스명 검증 후 사용

## 실행법 (backend 폴더)

```bash
export SEOUL_OPENDATA_API_KEY="발급받은키"     # 코드에 넣지 말 것

python build_seoul_dataset.py --test          # 서비스명·컬럼 점검(5건씩)
python build_seoul_dataset.py --build                     # 기존(분기 총매출 타깃)
python build_seoul_dataset.py --build --granular dow      # 요일 세분화(해상도↑)
python build_seoul_dataset.py --build --granular tmzon    # 시간대 세분화
python build_seoul_dataset.py --build --per-store 매출.csv # 천장 돌파용 실매출 병합

export USE_REAL_DATA=true
python -m app.ml.train
```

## 정직한 기대치

- `--granular` 는 **해상도를 올려** lag/요일/시간 신호를 더 주지만, 타깃이 여전히
  zone 유래라 **0.28 을 크게는 못 넘을 가능성**이 높다(구조적 한계).
- **`--per-store` 실매출을 넣는 것만이 천장(0.28)을 실제로 연다.** 이건 공짜 API 가
  아니라 카드사/POS/배달앱 제휴·유료 데이터다. 어댑터는 그 데이터가 오면 바로
  꽂히도록 준비만 해둔 것.
