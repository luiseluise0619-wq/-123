# frontend/screens — 화면 조각

`frontend/index.html` 은 **이 폴더의 조각들을 모아 만든 결과물**입니다.
직접 고치지 마세요. 여기 있는 파일을 고치고 다시 만드세요.

```bash
npm run build:html    # 조각 → frontend/index.html
npm run check:html    # 커밋된 index.html 이 조각들과 같은지 확인
npm test              # 위 확인이 테스트에도 들어 있습니다
```

## 왜 나눴나

한 파일에 1,800줄이 있으면 "지도 화면 고치기"에 파일을 찾는 시간이 더 듭니다.
이제 지도는 `32-map.html` 하나만 열면 됩니다.

## 왜 런타임 include 가 아닌가

이 앱은 정적 파일을 그대로 서빙합니다(빌드 단계 없음). 브라우저에서 조각을
가져오면 첫 화면이 느려지고 CSP·캐시 규칙까지 손대야 합니다.
그래서 **만들어진 `index.html` 을 그대로 커밋**합니다 — 배포 방식은 바뀌지 않습니다.

## 파일

| 파일 | 화면 | 켜지는 조건 |
| --- | --- | --- |
| `_shell-head.html` | `<head>`·헤더·`<main>` 여는 태그 | 항상 |
| `00-data-error.html` | 자료 못 불러왔을 때 안내 | `dataError` |
| `01-home.html` | 첫 화면 | `onHome` |
| `02-overlay.html` | 도우미 창·소개 안내창 (화면 위에 뜨는 층) | `botOpen` 등 |
| `03-settings.html` | 설정 — 언어·테마 | `settingsOpen` |
| `05-hub.html` | 상권분석·정밀분석 허브 | `onHub` |
| `10-report.html` | 리포트(설문 → 지원사업) | `onReport` |
| `20-price.html` | 통합시세 (왼쪽 세로 갈래·지표 · 오른쪽 가로 차트) | `onPrice` |
| `30-fine-intro.html` | 정밀분석 소개 | `onFineIntro` |
| `31-fine-compare.html` | 자치구 훑기 | `onFineCmp` |
| `32-map.html` | 지도 — 위치만 | `onMapScreen` |
| `33-fine-detail.html` | 정밀분석 — 왜 좋은/나쁜지 | `onFineDetail` |
| `40-zone-compare.html` | 지역비교(자치구) | `onZoneCmp` |
| `41-region.html` | 고른 지역의 업종 목록 | `onRegion` |
| `42-find.html` | 후보지 | `onFind` |
| `43-diagnosis.html` | 본전 계산 | `onDiag` |
| `45-sim.html` | 정밀비교 — 담은 상권 종합순위 | `onSim` |
| `50-ai.html` | 도우미 전체 화면 | `onAi` |
| `51-soon.html` | 준비 중 화면 | `onSoon` |
| `_shell-foot.html` | `</main>` 닫는 태그·스크립트 | 항상 |

순서는 `scripts/build-html.mjs` 의 `ORDER` 가 정합니다.
화면은 한 번에 하나만 켜지므로(`sc-if`) 순서가 화면에 보이지는 않지만,
파일을 찾기 쉬우라고 번호를 붙여 뒀습니다.

## 새 화면을 추가하려면

1. `frontend/screens/NN-이름.html` 을 만들고 `<sc-if value="{{ onXxx }}"> … </sc-if>` 로 감쌉니다
2. `scripts/build-html.mjs` 의 `ORDER` 에 파일 이름(확장자 없이)을 넣습니다
3. `frontend/app-logic.js` 의 `renderVals()` 에 `onXxx` 를 만듭니다
4. `npm run build:html && npm test`

## 로직은 어디에 있나

`frontend/logic/` 에 책임별로 나뉘어 있고, `frontend/app-logic.js` 가 마지막에
프로토타입으로 합칩니다.

| 파일 | 맡은 일 |
| --- | --- |
| `logic/const.js` | 여러 곳이 함께 쓰는 목록 |
| `logic/i18n.js` | 다국어 — 사전·조사·문장 번역·DOM 훑기 |
| `logic/theme.js` | 테마·라이트/다크·색 고르기 |
| `logic/roman.js` | 한글 → 로마자(영어 화면의 상권 이름) |
| `logic/util.js` | 값 다듬기·이름 바꾸기·언어별 숫자 표기 |
| `logic/design.js` | 카드·제목·숫자 스타일, '숫자 → 해석' |
| `logic/rank.js` | 종합순위 — 정규화·가중치·상권 색 고정 |
| `logic/analysis.js` | 순위·지도·정밀분석 섹션 계산 |
| `logic/screens.js` | 화면별 값 묶음(홈·지역비교·후보 지역·통합시세) |
| `logic/chat.js` | 도우미 |
| `logic/charts.js` | Chart.js 래퍼 |
| `logic/carousel.js` | 가로 슬라이드 |
| `logic/market.js` | 통합시세 7갈래 28지표 · 왼쪽 세로 목록 |
| `logic/views.js` | 자료가 있어야 만들 수 있는 화면 조립 |
| `app-logic.js` | 상태·생애주기·`MENU`·`renderVals()`·조각 결합 |

새 모듈을 만들면 **`app-logic.js` 맨 아래 결합 목록 · `_shell-head.html` 의 `<script>` 순서 ·
`tests/ui-logic.test.js` 와 `tests/i18n.test.js` 의 `LOGIC_PARTS`** 에 같이 넣어야 합니다.
