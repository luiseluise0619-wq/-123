# 코드 전체 정리 (파일·함수 한눈에)

> 이 문서 하나면 "어디에 뭐가 있는지" 다 보입니다. ⭐ = 미팅/공부에 중요, 먼저 볼 것.
> 각 함수 옆 숫자는 대략적인 줄 위치(코드가 바뀌면 조금씩 달라짐 — Ctrl+F로 함수 이름 검색이 확실).

---

## 전체 구조 3줄

```
[백엔드 Python] 공공API → JSON 만들기 → data-bundle.js 로 묶기 → check_data 로 검증
[서버리스 api/] AI·지도 키를 숨기는 중간 창구 (브라우저↔외부API)
[화면 HTML]     data-bundle.js·JSON 을 읽어 지도·표·차트·진단 그리기
```

---

## 1. 백엔드 — 데이터 만드는 Python (`backend/`) ⭐ 여기부터 공부

### `collect_income.py` — 소비 데이터 수집기 (172줄) ⭐⭐
| 함수 | 하는 일 |
|---|---|
| `fetch()` | 서울시 소비 API를 호출해 XML 받아오기 |
| `fnum()` / `pct_list()` | 숫자 변환 / 카테고리 금액 → 비율(%)로 |
| `write_unavailable()` | 데이터 못 받으면 "없음" 표시 저장(안 지어냄) |
| **`main()`** ⭐ | 전체 흐름: 자치구별 모든 분기 수집 → 정상 분기 선별(`ok`) → 비율 계산 → 저장 |

👉 **다른 collect_*.py 도 다 이 구조** (fetch → 가공 → 저장). 이거 하나 이해하면 나머지 다 읽힘.

### `check_data.py` — 데이터 무결성 검사기 (166줄) ⭐
| 함수 | 하는 일 |
|---|---|
| `FAIL/WARN/OK/SKIP()` | 검사 결과 기록용 |
| `check_sales()` | 매출 분포합 100%인지, 객단가>0인지 |
| `check_income()` ⭐ | 소비 구성이 정상인지(필수지출 40%↑, 단일항목 55%↓) |
| `check_stores/zone_change/zone_apt/pop/rent/livepop()` | 각 데이터 범위 검사 |
| `main()` | 전부 돌려서 리포트 출력, `--strict`면 실패 시 종료코드 1 |

### `build_bundle.py` — JSON들을 하나로 묶기 (152줄)
| 함수 | 하는 일 |
|---|---|
| `load_json()` / `usable()` | JSON 읽기 / 쓸 수 있는 데이터인지 확인 |
| `parse_existing_bundle()` | 기존 번들에서 core·geo 보존 |
| `build_stores_gu()` | 자치구별 점포 데이터 가공 |
| `main()` | 동적 레이어(소비·매출 등)를 최신 JSON으로 교체해 `data-bundle.js` 재생성 |

### 그 외 수집기 (구조 같음, 참고용)
`collect_sales.py`(매출) · `collect_stores.py`(점포) · `collect_repop.py`/`collect_workpop.py`(인구) · `collect_zone_*.py`(상권변화·집객시설·아파트) · `make_rent.py`(임대료)

---

## 2. 데이터 파일 (`frontend/`)

| 파일 | 내용 |
|---|---|
| `data-bundle.js` ⭐ | 모든 데이터 묶음 (`window.__SANGGWON`). 화면이 이거 하나 읽음 |
| `income.json` | 자치구별 소비 구성 |
| `sales_by_industry.json` | 업종별 매출·객단가·시간대 |
| `stores_by_industry.json` | 업종별 점포·폐업률 |
| `zone_change/facility/apt.json` | 상권 등급·집객시설·배후아파트 |
| `rent.json` | 임대료·공실률 |
| `vendor/` | React·Babel 원본(외부 CDN 대신 자체 보관) — 안 봐도 됨 |

---

## 3. 서버리스 함수 (`frontend/api/`) — 키 숨기는 중간 창구

모두 `export default handler(req,res)` 형태 (요청 받아 응답).

| 파일 | 하는 일 |
|---|---|
| `_ai.js` | AI 공용 모듈. `callGemini/callOpenAI/callAnthropic` — 제공자별 호출, 자동 폴백 |
| `chat.js` ⭐ | AI 상담 (선택 데이터 근거로 답) |
| `insight.js` | AI 데이터 요약 |
| `building.js` | 좌표 → 건축물대장 조회 |
| `kakao.js` | 카카오 지도 검색 프록시 |
| `models.js` | 쓸 수 있는 AI 모델 목록 |

👉 공통 원리: **API 키는 서버(여기)에서만 쓰고 브라우저엔 안 넘김.**

---

## 4. 화면 — `frontend/index.html` (메인) ⭐

클래스형 컴포넌트 하나. 아래 함수만 골라 보면 됨 (1800줄 통째로 X).

### 데이터·설명 (미팅 근거)
| 함수 | 하는 일 |
|---|---|
| `dataRows()` | "방법" 화면의 **데이터 출처 목록** (미팅용) |
| `formulas()` ⭐ | **공식과 근거** (손익분기 등) |
| `assumptions()` ⭐ | "우리가 정한 것" — 가정값 정직 공개 |

### 계산 (핵심)
| 함수 | 하는 일 |
|---|---|
| **`calc()`** ⭐⭐ | **손익분기·순이익·회수기간 계산**. 미팅에서 제일 중요 |
| `pctBelow()` | 내 손익분기가 매출 분포 어디쯤인지 |
| `rank()` | 자치구 순위 계산 |

### 화면 그리기
| 함수 | 하는 일 |
|---|---|
| `metricDefs()` | 지도 지표 정의(폐업추세·유동인구 등) |
| `topicDefs()` | 데이터 토픽 카드 목록 |
| `buildTopic()` ⭐ | 클릭한 토픽을 화면 블록으로 만듦 (소비·매출·인구 등 여기) |
| `bars()` / `stackComp()` ⭐ | 막대그래프 / 소비 100% 누적막대 |
| `heatCells()` | 시간대·요일 히트맵 |
| `rampColor()`/`divColor()` | 지도 색 계산 |

### AI 상담
| 함수 | 하는 일 |
|---|---|
| `chatContext()` ⭐ | AI에게 넘길 **현재 선택 데이터 요약** |
| `answer()` | AI 실패 시 규칙 기반 대체 답변 |

### 기타
`applyTheme()`(다크모드) · `componentDidMount()`(시작 시 데이터 로드) · `won()`/`num()`(숫자 표기) · `computeAreas()`/`project()`(지도 좌표)

---

## 5. 화면 — `frontend/compare.html` (비교) ⭐ index보다 쉬움

순수 자바스크립트(React 안 씀).

| 함수 | 하는 일 |
|---|---|
| `render()` ⭐ | **자치구 비교표 그리기** (기본 화면) |
| `renderZones()` / `renderZoneInd()` | 상권 비교 |
| `renderRent()` | 임대료 비교 |
| `pick()` | 업종+자치구로 데이터 뽑기 |
| `winners()` | 비교 항목 중 제일 좋은 값 강조 |
| `loadZI/loadRent/loadZCF()` | 추가 데이터 지연 로드 |
| `spark()` | 미니 추이선(스파크라인) |

---

## 6. 화면 — `frontend/building.html` (건물 지도)

| 함수 | 하는 일 |
|---|---|
| `analyzePin()` ⭐ | 지도 클릭 → 그 지점 종합 분석 (주소·인구·역·경쟁점포) |
| `findDong()`/`pointInRing()` | 클릭점이 어느 행정동인지 계산 |
| `drawGuBase/drawStations/drawZones()` | 지도에 구·역·상권 그리기 |
| `kakao()` | 카카오 API 호출 |
| `runInsight()` | AI 인사이트 요청 |
| `opportunityAnalysis()` | 기회/과열 분석 |
| `haversine()` | 두 좌표 간 거리 |
| `fmt*()` | 날짜·시간·거리 보기 좋게 |

---

## 7. 화면 — `frontend/trends.html` (연도별 추이)

| 함수 | 하는 일 |
|---|---|
| `lineChart()` ⭐ | 선 그래프 그리기(SVG 직접) |
| `barChart()` | 가로 막대그래프 |

---

## 공부 순서 (다시)

1. 이 문서로 **전체 지도** 파악
2. `collect_income.py` → `check_data.py` (Python, 당신 강점)
3. `compare.html` 의 `render()` (JSON→표)
4. `index.html` 의 `calc()` (손익분기, 미팅 핵심)
5. 막히면 함수 복붙해서 **"이거 설명해줘"** 물어보기

⭐ 붙은 것만 이해해도 미팅·설명은 충분합니다.
