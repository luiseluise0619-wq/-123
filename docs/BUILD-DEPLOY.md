# Claude Code 전달용 프롬프트

아래 코드 블록을 **그대로 복사해서** Claude Code에 붙여넣으세요.

---

```
이 저장소의 프론트엔드를 새 디자인으로 교체합니다.
아래 3개 파일은 이미 완성된 산출물입니다. 배치만 하고, 내용은 손대지 마세요.

  index.html
  support.js
  data-bundle.js

## 하지 말아야 할 것

1. 이 3개 파일을 수정·리팩터링·포맷팅하지 마세요. 주석도 추가하지 마세요.
2. 인라인 스타일을 CSS 파일로 분리하지 마세요. 클래스를 추출하지 마세요.
   이 페이지는 인라인 스타일 기반으로 동작하며, 분리하면 렌더링이 깨집니다.
3. HTML을 컴포넌트로 쪼개지 마세요. React/Vue/Svelte로 옮기지 마세요.
4. 빌드 도구를 도입하지 마세요. 번들러·트랜스파일러·npm 패키지 모두 불필요합니다.
   정적 파일 3개로 그대로 동작합니다.
5. data-bundle.js 는 자동 생성된 데이터 파일입니다. 손으로 편집하지 마세요.
6. 코드가 이상해 보여도 고치지 마세요. 의도된 구조입니다.

## 배치

3개 파일을 frontend/ 아래 같은 디렉터리에 넣습니다. 경로가 어긋나면 화면이 뜨지 않습니다.
기존 frontend/index.html 은 삭제하지 말고 frontend/legacy.html 로 이름만 바꿔 보존하세요.
기존 frontend/*.json 데이터 파일도 삭제하지 마세요.

결과 구조:
  frontend/
    index.html        ← 새 파일
    support.js        ← 새 파일
    data-bundle.js    ← 새 파일
    legacy.html       ← 기존 index.html (이름만 변경)
    *.json            ← 기존 유지

## 확인

frontend/ 에서 python -m http.server 8000 을 띄우고 http://localhost:8000 접속:

  - 첫 화면에 "어디에서 어떤 장사를 시작하시나요?" 가 보인다
  - 상단 메뉴 6개(상권·후보지·데이터·진단·비교·상담·방법)가 동작한다
  - '상권' 화면에 서울 자치구 지도가 색으로 칠해져 보인다
  - '방법' 화면에 데이터 목록과 계산식이 보인다
  - 헤더 오른쪽 아이콘으로 다크모드가 전환된다
  - 콘솔에 에러가 없다

화면이 비어 있거나 지도가 안 보이면, 3개 파일이 같은 디렉터리에 있는지부터 확인하세요.
파일 내용을 고쳐서 해결하려 하지 마세요.

## 건드리지 말 것

backend/ 의 수집·계산 스크립트와 데이터 로직은 변경 대상이 아닙니다.
```

---

## 데이터 갱신 방법 (참고)

어떤 데이터를 언제 받아야 하는지, API인지 수동인지는 같은 폴더의 `DATA-UPDATE.md` 에 정리했습니다.

`data-bundle.js` 는 기존 JSON들을 하나로 묶은 파일입니다. 값은 원본 그대로이며 형식만 바꿨습니다.

```js
window.__SANGGWON = { core, geo, pop, park, stores, sales, repop, work, income, forecast };
```

| 키 | 원본 |
| --- | --- |
| core | 기존 index.html 의 DATA 상수 (업종·자치구·임대료·폐업사유·벤치마크) |
| geo | 서울 자치구 경계 SVG path (KOSTAT 2013) |
| pop | livepop_gu.json |
| park | parking_gu.json |
| stores | stores_by_industry.json |
| sales | sales_by_industry.json |
| repop | repop.json |
| work | workpop.json |
| income | income.json |
| forecast | sales_forecast.json |

새 분기 데이터가 나오면 위 구조로 다시 묶어 `data-bundle.js` 만 덮어쓰면 됩니다. `index.html` 은 수정할 필요가 없습니다.

## 코드에 들어 있는 판단값 (검토 필요)

데이터가 아니라 선택한 값입니다. '방법' 화면에도 같은 내용이 표시됩니다.

- **자치구 → 대표 상권 매핑** (`rentZoneOf`): 부동산원 임대료가 상권 단위로만 공표되어 각 구의 대표 상권을 하나씩 지정했습니다. 지역을 아는 분의 검토가 필요합니다.
- **자치구 면적 추정** (`computeAreas`): 지도 폴리곤 넓이를 605.21㎢로 정규화한 값입니다. 정확한 면적 데이터가 있으면 대체하세요.
- **판단 임계값**: 유동인구 상위 8위, 폐업률 2%, 임대료 매출 대비 20%. 검증된 기준이 아닙니다.
