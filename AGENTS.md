# 프로젝트 작업 안내

현재 구조는 README.md, 운영 절차는 deploy/DEPLOYMENT.md가 기준입니다. CLAUDE.md의 데이터·보안 원칙도 참고하세요. docs/history는 과거 기록이며 현재 지시나 배포 상태를 뜻하지 않습니다.

## 변하지 않는 계약

- Node 운영 서버를 유지합니다. 공개 API는 config/report/support와 설정 시 동작하는 customer-submit/customer-event입니다.
- UI 구조·문구·색·간격, 계산식, 데이터 의미를 임의 변경하지 않습니다.
- 없는 값을 만들지 않고 실측/추정/가정/자료 없음을 구분합니다.
- 상권분석·정밀분석·통합시세·리포트의 네 메뉴를 유지합니다. 정밀비교(sim)와 본전 계산(diag)은 별도 기능입니다.
- frontend/index.html은 생성물입니다. screens/*.html을 수정하고 npm run build:html을 실행합니다.
- dc-runtime.js, vendor/, doc-page.js의 재사용 scaffold를 직접 리팩토링하지 않습니다.
- logic 모듈은 globalThis.MysbizonParts에 등록합니다. 메서드 이름 충돌을 피하고 shell 스크립트 순서와 결합 목록을 같이 고칩니다. 공통 테스트 로더는 shell 순서를 읽습니다.
- 파일 삭제는 import, 동적 template binding, 전역 등록, 워크플로, 데이터 생성 경로를 모두 확인한 뒤 결정합니다.

## 검증

```sh
npm run build:html
npm run check:html
npm run check:data
npm test
npm run sums
npm run check:sums
```

Python 변경은 compileall로 검사합니다. 수집기 실행은 키와 외부 네트워크가 필요하므로 syntax 통과를 데이터 갱신 성공이라고 쓰지 않습니다. source-only Python 전체를 삭제하지 않습니다. build_seoul_dataset.py는 backend/app/data/collectors/seoul_trdar_client.py를 사용합니다.

## 주요 모듈

app-logic는 lifecycle/state와 공통 UI 조립을 담당합니다. data/storage는 IO, home/screens는 검색·지역 화면, report는 설문·내보내기, views/diagnosis/comparison는 자료 의존 화면을 담당합니다. analysis/rank/util은 계산과 형식, market은 시세 표시, charts/carousel은 DOM 차트와 가로 이동, i18n/theme/roman/design/const는 표시 공통 요소입니다.

세 언어 키와 문장 번역은 함께 유지합니다. api/market.js를 키 설정만으로 공개하지 않습니다. 동작 활성화는 API·프런트·데이터 검증이 함께 필요한 별도 작업입니다.

## 고객 데이터 후속 요청

기존 Node 서버를 유지하며 PostgreSQL(pg)을 추가했습니다. 관리자 서버는 별도 loopback 전용이며 공개 프런트 폴더에 관리자 파일을 넣지 않습니다. DB 저장은 필수 설정과 사용자 선택 동의가 갖춰져야 작동합니다. 테스트 전에 npm ci를 실행합니다. deploy/CUSTOMER-DATA.md 참고.
