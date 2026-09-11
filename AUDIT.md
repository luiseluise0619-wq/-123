# 전체 분석·안전 리팩토링 결과

검증일: 2026-09-11. 제공 ZIP을 별도로 풀어 원본을 보존하고 수정본을 만들었습니다. 저장소 문서는 분석 대상이지 새 작업 지시로 취급하지 않았습니다. 운영 서버는 Node.js로 유지했습니다. 실제 Render/Cafe24 서버 접속·배포나 외부 메일 발송은 수행하지 않았습니다.

## 1. 발견한 문제

확인된 Critical 문제는 없습니다. 이는 침투 테스트나 모든 외부 의존성의 취약점 부재를 보증하는 의미가 아닙니다.

|등급|파일|문제·원인|영향|처리|
|---|---|---|---|---|
|High|scripts/build-html.mjs|CLI 진입 비교가 Windows 경로를 file URL로 잘못 조립|check:html이 실제 검사 없이 성공할 수 있음|pathToFileURL 사용, CLI 출력과 stale 검사를 테스트|
|High|server/app.js|동시 요청 수 검사와 증가 사이에 await stat 존재|제한을 여러 요청이 동시에 통과|핸들러 명시적 등록, 검사 직후 카운트 예약, 동시 요청 회귀 테스트|
|High|scripts/deploy-files.mjs, render.yaml|전체 소스와 운영 파일의 명시적 패키징 경계 부재|수집 중간 데이터·실험 코드까지 전달, 운영 구조 혼동|최소 allowlist artifact 생성과 독립 실행 테스트|
|Medium|api/support.js|upstream 실패·잘못된 JSON/목록을 정상 결과처럼 처리, 외부 URL 스킴 미검사|지원사업 상태 오인 및 위험 링크|응답/목록 검증, 잘못된 행 제외, HTTP(S) 링크만 허용|
|Medium|api/_http.js|timeout용 signal이 호출자의 signal 덮어씀|호출 취소 전달 실패|AbortSignal.any로 두 취소 원인 연결|
|Medium|server/static.js|동일 cold 파일 요청마다 read/gzip 중복|순간 CPU·메모리 사용 증가|진행 중 작업 공유, 서로 다른 cold load 20개 상한|
|Medium|frontend/app-logic.js, logic/charts.js|첫 화면 timer와 Chart 인스턴스 unmount 정리 누락|해제 뒤 작업 및 자원 잔류|timer 취소, chart destroy와 참조 정리|
|Medium|app-logic.js, logic/screens.js, logic/views.js|요청/저장/리포트/여러 화면 책임 집중|변경 범위와 전역 결합 파악 어려움|기존 prototype 모듈 방식 안에서 책임별 분리|
|Medium|scripts/make-sums.mjs|기존 체크섬 목록만 갱신|새 파일이 무결성 검사에서 빠짐|현재 소스 파일을 재발견, 비밀파일/산출 디렉터리 제외|
|Medium|deploy/mysbizon.service|환경설정으로 운영 bind/proxy 설정이 흔들릴 수 있음|VPS에서 직접 공개하거나 신뢰 프록시 오설정 가능|unit에서 loopback/production/1-hop 고정, journald 출력·로그 속도 제한|
|Low|README.md, AGENTS.md, CLAUDE.md, SETUP.md 등|이전 구조와 완료 기록이 현재 설명과 혼재|잘못된 실행·삭제 판단|현재 구조로 재작성, 과거 문서는 docs/history 보관|
|Low|여러 프런트 모듈, frontend/vercel.json|지역 미사용 코드와 오래된 frontend-only 배포 설정|불필요한 코드·배포 혼동|참조와 런타임 분기를 확인한 항목만 제거|

보안·성능 확인: 정적 파일 경로/realpath 경계, 숨김 파일 차단, MIME 제한, CSP, JSON body 64KiB/10초 제한, rate-limit 및 idempotency 저장 상한, ETag/gzip/cache를 검토했습니다. 기존 안전장치를 유지하고 socket 유휴 30초 제한을 추가했습니다. API 키는 서버 환경변수로 받으며 확인 범위에서 실제 키 하드코딩은 발견하지 않았습니다. 요청 제한과 Origin 검사는 사용자 인증을 대신하지 않습니다. 브라우저 첫 로딩 구조나 데이터 계산은 변경하지 않았으며 성능 향상 수치/실서버 부하 처리량은 주장하지 않습니다.

## 2. 삭제한 것

- `frontend/vercel.json`: root Node API를 제공하지 않는 과거 frontend-only 설정. 현 운영·빌드 경로에서 쓰이지 않았습니다.
- root `verification.json`, `verification-syntax.json`: 현재 결과로 오인하지 않도록 `docs/history/`로 이동했습니다.
- app의 미사용 지역 arrow/chip 상수, 실제 MENU에 없는 `__bot` 분기, report의 미사용 지역 pick/chip/P, views의 무효 `void 0`/지역 go를 제거했습니다.
- server의 미사용 lead 제한 조건, 매 요청 파일 stat/dynamic import 래퍼와 이동 뒤 남은 주석을 제거했습니다.
- 삭제 근거는 `REMOVED-FILES.json`, 전체 파일별 분류·문자열 참조·Python import 근거는 별도 `audit/inventory-*.json`에 기록했습니다. 문자열 검색만으로 미사용을 단정하지 않았습니다.

원시 JSON과 v3의 같은 내용은 `backend/build_v3.py` 복사 입력/출력 관계가 있으므로 소스에 남겼습니다. `backend/app`은 수집기에서 import하는 경로가 있어 삭제하지 않았습니다. 미완 `api/market.js`는 소스 보관, 공개 라우트/배포 대상에서는 제외했습니다. 사용자 데이터나 기존 계산 기능은 삭제하지 않았습니다.

## 3. 리팩토링한 것

|Before|After|
|---|---|
|app-logic에 요청·저장·리포트 집중|logic/data.js, storage.js, report.js + app 상태/조합|
|screens에 홈·지역·가격 화면 혼합|home.js, 기존 market.js 확장, screens의 지역/구역 책임 유지|
|views에 비교·진단까지 집중|comparison.js, diagnosis.js 분리|
|화살표 스타일 중복|const.js의 동결 TREND_STYLES 재사용|
|테스트마다 모듈 순서 하드코딩|tests/logic-source.js가 실제 HTML shell 순서를 사용|
|요청 때 API 파일 탐색/import|공개 config/report/support 핸들러를 명시적으로 등록|
|전체 폴더 전달|allowlist runtime artifact + 파일별 SHA256 manifest|

HTML 조각의 script 순서와 prototype 조합을 함께 갱신했습니다. `frontend/index.html`은 builder로만 재생성했습니다. TS 원본이 없는 `dc-runtime.js`, 인쇄 런타임 `doc-page.js`, React/Chart vendor와 데이터의 바이트를 보존했습니다. CSS는 후속 UX 요청에 따라 수정했습니다. 신규 npm 패키지나 프레임워크는 추가하지 않았습니다.

## 4. 남겨둔 큰 파일

- app-logic 748줄: 상태 초기화와 모듈 조합, 화면 이동 등 진입점 책임이 남습니다. 더 분리하면 전역/prototype 의존 관계만 늘어날 수 있습니다.
- report 612줄: 리포트 단계·자료 구성·표시가 하나의 사용자 흐름입니다. 이번에는 독립 책임 추출까지만 하여 계산 순서와 closure를 보존했습니다.
- views 601줄, analysis 585줄: 템플릿에 대응하는 표시 모델과 분석 계산을 유지했습니다. 더 작은 추상화 전에 각 계산의 계약이 필요합니다.
- build_zone_intel.py 513줄, train.py 381줄: 수집·모델 산식 변경은 결과 의미를 바꿀 수 있어 그대로 보존했습니다.
- i18n 454줄: 번역 데이터와 화면 연결의 응집성이 있습니다. 단순 LOC 감소를 위해 쪼개지 않았습니다.

## 5. Production 구조

```text
클라이언트 → Render TLS 또는 VPS Nginx TLS
          → 단일 Node server.js
             ├─ /healthz
             ├─ /api/config, /api/report, /api/support
             └─ frontend 정적 HTML/JS/CSS/locales/vendor/v3 + zone_rent
```

Node 외부 npm 런타임 의존성은 0개입니다. server/, 필요한 api/ helper, 시작 시 데이터 validator, package와 라이선스가 포함됩니다. backend/Python/ML/수집기/테스트/HTML 원본 조각/중간 JSON/개발 문서는 runtime에 없습니다. Python은 소스 개발·데이터 재생성 시에만 필요합니다.

`npm run build:deploy -- EMPTY_DIRECTORY`가 HTML 일치와 데이터를 확인하고 명시한 파일만 복사합니다. 기존 비어 있지 않은 경로에는 덮어쓰지 않습니다. artifact 자체의 `node server.js`와 API/정적 경로를 테스트했습니다. 운영 환경변수는 `.env.example`와 배포 문서를 따라 별도로 설정합니다.

## 6. Render

`render.yaml`을 Node web service로 유지했습니다. Build는 `npm run check:html && npm run check:data && npm test && npm run build:deploy`, Start는 `node dist/server.js`, health 경로는 `/healthz`입니다. Node 24, HOST=0.0.0.0, 플랫폼 PORT를 사용합니다. ALLOWED_ORIGIN은 실 도메인을 입력하고 이메일은 기본 비활성입니다.

TRUST_PROXY_HOPS=0을 유지했습니다. 실제 Render 프록시 연결 구조를 확인하기 전 임의로 1로 올리지 않았습니다. 이 경우 IP 제한이 프록시 단위로 묶일 수 있으므로 운영 확인이 필요합니다. 실제 계정에서 Blueprint 생성·배포 성공을 확인한 것은 아닙니다.

## 7. Cafe24 VPS

권장 구조는 `/opt/mysbizon/releases/<release>` + `current` 심볼릭 링크, 비로그인 `mysbizon` 사용자, `/etc/mysbizon.env`, systemd 단일 Node, Nginx TLS입니다. 서비스는 127.0.0.1:3000과 신뢰 프록시 1홉을 고정하고 Nginx가 X-Forwarded-For를 덮어씁니다. 방화벽에서 Node 포트를 공개하지 않습니다.

```sh
# 소스에서 검사 및 새 릴리스 디렉터리 생성
npm run build:html
npm run check:data
npm test
npm run build:deploy -- /tmp/mysbizon-20260911
# VPS에 릴리스와 환경파일/unit을 설치한 뒤
sudo systemd-analyze verify /etc/systemd/system/mysbizon.service
sudo systemctl daemon-reload
sudo systemctl enable --now mysbizon
curl --fail http://127.0.0.1:3000/healthz
sudo nginx -t
sudo systemctl reload nginx
```

사용자·권한 생성부터 TLS, 로그 보존, 교체·롤백까지 정확한 순서는 `deploy/DEPLOYMENT.md`에 있습니다. 위 명령은 실제 VPS에서 실행하지 않았습니다. distro/Node 경로/도메인·인증서가 정해져야 적용할 수 있습니다.

## 8. 테스트 결과

- 원본 `npm test`: 38개 통과, 실패 0. 최종 `npm test`: 50개 통과, 실패 0. 기존 38개에 회귀 테스트 12개를 추가했습니다. HTTP 동시성/보안/데이터/UI/i18n/build 및 CSV·인쇄 동작을 포함합니다.

- `npm run check:html`: 성공. 원본에서는 Windows CLI가 실제 검사 없이 종료하는 결함이 있었으며, 수정본은 검사를 실행합니다. 원본의 HTML 일치 자체는 baseline 테스트로 확인했습니다.
- `npm run check:data`: 10개 핵심 데이터, 1,564개 구역·62개 업종·20261 분기 검증 성공.
- `node --check`: 57개 JS/MJS 성공. `python -m compileall -q backend`: 성공. 이는 Python 외부 라이브러리 설치/실제 수집·ML 통합 실행을 뜻하지 않습니다.
- 초기 리팩토링 단계에서 62업종 × 14화면 = 868개 view model 및 report payload가 일치했습니다. 이후 사용자가 요청한 선택 UI를 반영했으므로 최종 화면 전체의 동일성을 주장하지 않습니다. 최종본은 62업종 전체 ranking 및 report payload 동등성을 다시 확인했습니다. 함수 handler는 직렬화 비교에서 제외하므로 모든 사용자 동작의 전수 증명은 아닙니다.
- 54개 데이터/vendor 파일 바이트 동일; CSS·언어 사전은 후속 UX 요청에 따라 수정, backend Python 전체 바이트 동일.
- `npm run build:deploy -- ../mysbizon-runtime`: 성공. 별도 artifact의 시작·정적 파일·API·제외 파일·기존 폴더 덮어쓰기 거부를 자동 테스트했습니다.
- 브라우저 수동 확인: 검색·업종/구역 선택·상세 차트·본전 결과·리포트 단계·키 미설정 지원사업 안내·인쇄용 페이지 표시. CSS/리포트 표는 스크린샷으로 확인했습니다. OS 인쇄/PDF 저장, 실제 이메일/지원사업 키, 모바일 전 기기, 실 Render/Linux/TLS는 미검증입니다.

테스트 로그와 동등성·파일 검증 JSON은 전달물의 `audit/`에 있습니다. 네트워크 upstream과 이메일은 테스트에서 mock 처리했습니다.

## 9. 코드 규모 변화

|구분|Before|After|변화|
|---|---:|---:|---:|
|전체 source LOC|20,916|21,357|+441|
|frontend source LOC|9,388|9,430|+42|
|Node server/API LOC|691|717|+26|
|Python tooling LOC|9,996|10,075|+79|


LOC는 빈 줄·주석을 포함하는 물리적 소스 줄 수입니다. generated/vendor/data/docs는 제외합니다. 전체 소스 증가는 테스트·배포·감사 도구 추가 때문이며 줄 수 감소를 성과로 가장하지 않았습니다. Python 증가는 감사 도구 79줄이고 backend 코드는 동일합니다.

기존 운영의 실제 배포 파일 수/디스크 사용량은 접근하지 않아 모릅니다. 아래 Before는 제공 ZIP의 전체 프로젝트를 그대로 전달하는 경우의 비교 기준이며, 실제 기존 운영 측정값이 아닙니다. After는 새 artifact 실측입니다.

|배포 비교|파일 수|비압축 bytes|
|---|---:|---:|
|Before: 전체 원본 전달 기준|248|17,035,223|
|After: manifest 포함 runtime|72|2,401,150|

전체 원본 전달 기준 대비 비압축 용량 85.9% 감소했습니다. runtime에는 파일별 SHA256 manifest가 포함됩니다.

### 가장 큰 source file TOP 10 (물리적 줄 수)

|순위|Before 파일|LOC|After 파일|LOC|
|---|---|---:|---|---:|
|1|frontend/app-logic.js|1529|frontend/app-logic.js|748|
|2|frontend/logic/views.js|1105|frontend/logic/report.js|612|
|3|frontend/logic/screens.js|1013|frontend/logic/views.js|601|
|4|frontend/logic/analysis.js|585|frontend/logic/analysis.js|585|
|5|backend/build_zone_intel.py|513|backend/build_zone_intel.py|513|
|6|frontend/logic/i18n.js|454|frontend/logic/market.js|470|
|7|tests/i18n.test.js|437|frontend/logic/i18n.js|468|
|8|backend/app/ml/train.py|381|tests/i18n.test.js|434|
|9|frontend/logic/util.js|312|frontend/logic/home.js|430|
|10|backend/collect_bldprice.py|305|backend/app/ml/train.py|381|


|소스 LOC 제외 분류|Before 파일/bytes/lines|After 파일/bytes/lines|
|---|---:|---:|
|generated|1 / 148,964 / 2,391|1 / 147,450 / 2,372|
|vendor|6 / 454,149 / 2,926|6 / 454,149 / 2,926|
|data|79 / 15,069,689 / 10,787|79 / 15,100,055 / 11,179|


전체 파일별 분류·참조·중복 그룹·크기는 `audit/inventory-before.json`, `audit/inventory-after.json`으로 재검토할 수 있습니다. 소스 SHA256SUMS와 runtime DEPLOY-MANIFEST는 각각 다른 경계의 무결성을 검사합니다.

## 10. 남은 기술부채

1. dc-runtime의 TS 원본 및 doc-page의 현재 vendor 재현 빌드 경로가 저장소에 완비되어 있지 않습니다. 바이너리성 생성물을 임의 수정하지 않았습니다.
2. 프런트 전역/prototype 조합 결합과 큰 표시 모델이 남습니다. 기존 계산을 유지한 점진 분리이며 타입 시스템 도입은 하지 않았습니다.
3. rate-limit/idempotency는 프로세스 메모리이므로 재시작 시 소실되고 여러 인스턴스 간 공유되지 않습니다. 수신자 인증·강한 메일 남용 방지는 별도 요구 정의가 필요합니다.
4. 지원사업/이메일의 실제 자격증명·응답 계약과 Render 실 IP 전달 구조, VPS 경로·TLS·권한·로그 보존은 운영 환경에서 확인해야 합니다.
5. v3 13파일 중 시작 검증은 기존 핵심 10파일 중심입니다. 선택 데이터의 더 강한 스키마 및 업무적 정확성 검증이 남습니다.
6. 수집 workflow의 여러 continue-on-error는 일부 실패를 허용합니다. 마지막 freshness 검사는 실패할 수 있어 항상 green인 것은 아닙니다. 원천 API 변화·예측 방법론의 검증은 본 리팩토링 범위에서 수행하지 않았습니다.
7. 소스 보관 FastAPI/ML에는 광범위 CORS, 시작 시 DB 생성, synthetic fallback, 오래된 의존성 pin이 남습니다. 운영 artifact에서 제외했으며 별도 서비스로 공개하기에 안전하다고 인증하지 않았습니다.
8. api/market.js의 계획 기능, 일부 비동기 작업의 생명주기별 취소, 외부 오류 로그의 개인정보 최소화는 남아 있습니다.
9. vendor React 18.3.1/Chart 4.4.7을 보존했습니다. 공급망 전체의 최신 취약점 감사·업그레이드 회귀검증은 별도 작업입니다.

## 후속 요청 반영: PC·태블릿·모바일 UI

- 상권 비교: 구별 전체 목록, 이름 검색, 12개씩 더 보기, 선택 상태 표시, 최대 3곳 비교. 다른 구로 이동해도 담은 상권이 유지됩니다.
- 목록은 PC 3열(1100px 이상), 태블릿 2열(600~1099px), 모바일 1열입니다. 선택 메뉴는 높이 48px이며 화면 폭에 맞춰 배치됩니다. 1440×900, 820×1100, 390×844에서 브라우저 확인했습니다. 실물 모든 기기 검증은 아닙니다.
- 통합시세: 임대료/공실률은 조사 권역·상권, 소비지출은 구, 매출/개폐업 등은 업종 선택을 제공합니다. 데이터가 없는 구×업종 시계열을 만들어내지 않습니다.
- 차트 툴팁: 표시 애니메이션 제거, 가로 막대의 y축 선택, 테마에 맞는 글자 대비 수정. 코드 회귀 검사와 브라우저 툴팁 표시를 확인했습니다. 실제 hover-only 지연 시간은 계측하지 않았습니다.
- 토스·애플을 참고한 여백, 간결한 라벨, 정돈된 선택 카드 스타일을 새 선택 영역에 적용했습니다. 사이트 전체 디자인 교체는 아닙니다.
- 프런트 계산/원천 데이터와 vendor는 보존했습니다. CSS·화면 조각·언어 사전·생성 index는 사용자 후속 요청으로 변경했습니다. index는 빌드로만 생성했습니다.
- 데이터 수집의 단계적 질문 설계는 docs/UIUX-FEEDBACK.md, 회사 계정 이전과 추가 API는 deploy/API-MIGRATION.md에 정리했습니다. 실제 회사 계정 이전·사용자 정보 수집 서버 추가는 수행하지 않았습니다.

## 후속 고객 데이터 구현 — 2026-09-11

초기 리팩토링 보고서의 50개 테스트/무의존성/고객 DB 없음 설명은 해당 단계의 기록입니다. 후속 요청으로 pg, SQL 검증용 PGlite, 고객 수집 API, 암호화 저장 및 loopback 관리자 화면을 추가했습니다. 최신 검증은 55개 전체 테스트 통과와 SQL 저장·집계·마스킹·인증 차단·만료 삭제 회귀검사입니다. PostgreSQL WASM 엔진으로 SQL을 실행했으며 카페24 실서버/실DB 검증은 아닙니다. 실제 회사 DB 연결·마이그레이션·관리자 DNS 공개·백업 및 삭제 스케줄 설치는 미실행입니다. 고객 기능 활성 화면의 전체 브라우저/실물 기기 QA는 아직 남아 있습니다. 설정은 deploy/CUSTOMER-DATA.md, 남은 UX는 docs/NEXT-UX.md를 참고하세요.
