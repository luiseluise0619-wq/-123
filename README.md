# 서울 상권 인텔리전스

예비 소상공인·창업자를 위한 **서울 상권 분석 웹앱**입니다. 서울시 공공데이터(상권분석·생활인구·임대료 등)와
국세청·통계청 통계를 바탕으로, 자치구·상권·업종별 매출·객단가·폐업률·손익분기·소비 성향을 보여주고,
Gemini 기반 AI 상담으로 데이터에 근거한 해설을 제공합니다.

> **설계 원칙 — 데이터 정직성.** 없는 값은 지어내지 않고 "데이터 없음/보정 중"으로 표시합니다.
> 실측·가정·추정·폴백을 화면과 코드 주석에서 구분하고, 분기 갱신 후 깨진 데이터를 자동으로 걸러냅니다.

라이브: 정적 사이트로 **Vercel**에 배포됩니다(Root Directory = `frontend/`).

---

## 실제 구성 (배포되는 것)

정적 HTML + 커스텀 템플릿 프레임워크 + 서버리스 함수 구조입니다. 빌드 스텝 없이 파일을 그대로 서빙합니다.

### 화면 (`frontend/*.html`)
- `index.html` — 메인. 서울 지도(지표별 색), **진단(손익분기·매출분포)**, 데이터 토픽(유동/거주/직장인구·소비·매출·점포·임대료·예측), **AI 상담**
- `compare.html` — 자치구 / 상권 / 임대료 **비교** (업종별 매출·객단가·폐업률·소비 구성·상권등급·배후 아파트)
- `building.html` — 지도에서 지점 클릭 시 **실시간 브리핑** (주소·유동인구·주변 역·경쟁 점포·건축물대장)
- `trends.html` — 연도별 추이 차트
- `about.html` · `legacy.html` — 소개·구버전

### 서버리스 함수 (`frontend/api/*.js`, Vercel Functions)
API 키를 브라우저에 노출하지 않기 위한 서버 프록시입니다. 키는 Vercel 환경변수로만 보관합니다.
- `chat.js` · `insight.js` — Gemini/OpenAI/Anthropic 상담·인사이트 (`_ai.js` 공용 모듈, 자동 폴백)
- `building.js` — 좌표→건축물대장(건축HUB) 실시간 조회
- `kakao.js` — 카카오 로컬(키워드·카테고리·좌표변환) 프록시
- `models.js` — 사용 가능한 AI 모델 목록

### 데이터 파이프라인 (`backend/collect_*.py`, `build_bundle.py`)
Python 수집기가 공공 API를 호출해 `frontend/*.json`을 만들고, `build_bundle.py`가 이를
`frontend/data-bundle.js`(`window.__SANGGWON`)로 묶어 지도 앱이 한 번에 읽습니다.
- 수집: 생활인구·주차·추정매출·점포·상주/직장인구·소비·상권변화·집객시설·배후아파트·임대료 등
- **자동 무결성 점검** (`backend/check_data.py`) — 분기 갱신 후 이상치(비율합·범위·소비 구성)를 걸러 로그로 경고
- 자동 갱신: GitHub Actions `대시보드 자동 갱신` — 매주(가벼운 갱신) + 매월 1일(상권 전량 빌드)

### 주요 데이터 출처
서울 열린데이터광장(상권분석서비스·생활인구), 국세청 폐업통계, 한국부동산원 상업용부동산 임대동향,
통계청 소상공인실태조사, 전국주차장정보표준데이터, 카카오 로컬(실시간), 건축HUB 건축물대장.
자세한 서비스명·갱신 주기·주의점은 [`docs/DATA-UPDATE.md`](docs/DATA-UPDATE.md), [`backend/DATA_SOURCES.md`](backend/DATA_SOURCES.md).

---

## 로컬에서 보기

정적 사이트라 별도 빌드가 필요 없습니다.

```bash
cd frontend
python -m http.server 8000    # http://localhost:8000
```

서버리스 함수(AI 상담 등)까지 로컬에서 쓰려면 Vercel CLI:

```bash
npm i -g vercel
vercel dev                    # frontend/ 를 Root Directory 로 설정
```

AI·지도 기능에 필요한 환경변수(있는 것만 설정, 없으면 해당 기능만 비활성):
`GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `KAKAO_REST_KEY`, `DATA_GO_KR_KEY`, `SEOUL_API_KEY`.

데이터를 직접 갱신하려면:

```bash
cd backend
pip install pandas numpy requests pyproj
SEOUL_API_KEY=... python collect_sales.py      # 개별 수집기
python build_bundle.py                          # data-bundle.js 재생성
python check_data.py                            # 무결성 점검
```

---

## 참고 — `backend/app/` (실험적, 미배포)

레포에는 FastAPI + LightGBM + RAG 지식베이스 형태의 별도 실험 코드(`backend/app/`)가 있습니다.
현재 **배포되지 않으며**, 위에서 설명한 정적 사이트가 실제 서비스입니다. 이 실험 코드는 참고용입니다.

---

## 문서
- [`docs/PRODUCT_BRIEF.md`](docs/PRODUCT_BRIEF.md) — 제품 개요
- [`docs/DATA-UPDATE.md`](docs/DATA-UPDATE.md) — 데이터 갱신 방법·출처·주의점
- [`docs/BUILD-DEPLOY.md`](docs/BUILD-DEPLOY.md) — 빌드·배포
- [`docs/운영가이드.md`](docs/운영가이드.md) — 운영 가이드
