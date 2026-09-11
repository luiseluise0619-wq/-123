# 사장님인사이트 — 소스와 배포

운영 서버는 Node.js 표준 라이브러리 기반 정적 UI + API입니다. Render와 Cafe24 Linux VPS 모두 같은 서버를 사용합니다. FastAPI/ML은 소스에 보관한 실험·개발 코드이며 운영에서 실행하지 않습니다. Vercel 정적 배포는 현재 지원 경로가 아닙니다.

## 개발·검증

Node 22~24 지원 범위, 이번 검증은 Node 24.19.0 / Windows에서 수행했습니다. 외부 npm 의존성은 없습니다.

```sh
npm run build:html
npm run check:html
npm run check:data
npm test
npm start
```

`http://localhost:3000`을 엽니다. `.env`를 자동으로 읽지 않으므로 필요하면 `node --env-file=.env server.js`로 시작합니다.

## 책임과 원본

| 경로 | 역할 |
| --- | --- |
| `server.js` → `server/app.js` | 데이터 검증, 정적 파일, 공개 API, 종료 처리 |
| `api/config.js`, `report.js`, `support.js` | GET 설정 / POST 메일 / POST 지원사업 |
| `frontend/screens/*.html` | HTML 원본; `scripts/build-html.mjs`의 ORDER로 조립 |
| `frontend/index.html` | 생성물. 직접 수정하지 않음 |
| `frontend/app-logic.js` | state, lifecycle, 메뉴, 공통 화면 값, 모듈 결합 |
| `frontend/logic/data.js`, `storage.js` | 요청과 필수/선택 데이터 정책, 브라우저 저장 |
| `frontend/logic/home.js`, `screens.js` | 홈 검색, 지역 비교·지역 업종·자치구 분석 |
| `frontend/logic/report.js` | 설문과 지원사업 표시, CSV/인쇄/메일 출력 |
| `frontend/logic/views.js`, `diagnosis.js`, `comparison.js` | 후보·지도·상세, 본전 계산 화면, 담은 상권 비교 |
| `frontend/logic/market.js` | 시세 갈래와 공개 통계 표시 |
| 나머지 `frontend/logic/*.js` | 계산·순위·형식·i18n·테마·차트·carousel |
| `frontend/report-print.html` | 저장된 리포트의 인쇄/PDF 화면 |
| `frontend/dc-runtime.js` | 원본 TS가 없는 생성/vendor artifact. 수정하지 않음 |
| `backend/`, `.github/workflows/` | 데이터 생성·수집 및 보관한 실험 코드 |
| `scripts/deploy-files.mjs` | 검토한 배포 파일 경계 |

모듈은 `globalThis.MysbizonParts`에 등록하고 Component prototype에 결합합니다. 같은 이름은 예외로 검출합니다. 새 모듈은 `_shell-head.html`과 결합 목록을 함께 갱신해야 합니다. 공통 테스트 로더는 shell 순서를 읽으며 `tests/refactor.test.js`가 실제 HTML 스크립트 순서로도 결합을 검사합니다.

## 소스와 배포 artifact

```sh
npm run build:deploy
# 또는 매번 새 빈 경로 지정
npm run build:deploy -- /tmp/mysbizon-release-20260911
```

기본 결과는 `dist/`입니다. 기존 디렉터리가 비어 있지 않으면 덮어쓰지 않고 실패합니다. 새 릴리스 경로를 사용하세요. artifact는 `server.js`, `server/`, 공개 API와 의존 helper, `scripts/validate-data.mjs`, 필요한 frontend와 라이선스를 포함합니다. `DEPLOY-MANIFEST.json`에 각 파일 크기와 SHA-256을 기록합니다. artifact 안에서 `npm start` 또는 `node server.js`로 실행합니다. 테스트·수집·재빌드는 소스에서 실행합니다.

Python, ML 모델, 중간 JSON/GeoJSON, 화면 원본 조각, 테스트, 문서는 runtime artifact에서 제외합니다. source에서 `node server.js`를 바로 실행하면 frontend 안의 중간 파일도 정적 접근 가능하므로 운영은 artifact를 사용하세요.

## 데이터 갱신

실제 클라이언트는 최초 `data/v3` 12개와 루트 `zone_rent.json`을 요청하고, `openings.json`은 상세/내 가게 화면에서 지연 요청합니다. v3에는 총 13개 파일이 있으며 시작 검증은 핵심 10개를 검사합니다. 부가 파일은 클라이언트 shape guard/폴백을 사용합니다.

수집기 → `frontend/` 중간 자료 → `backend/build_v3.py` → `frontend/data/v3/` → 검증 → 새 artifact 순서입니다. `build_seoul_dataset.py`가 `app.data.collectors.seoul_trdar_client`를 import하므로 `backend/app` 전체를 삭제하면 안 됩니다. `.github/workflows/refresh-dashboard.yml`이 세부 실행 순서를 정의합니다. 오래된 `build_bundle.py`는 과거 지도 번들 경로도 유지하며 현재 Node UI의 로드 대상은 아닙니다.

수집기 네트워크 실행은 별도 환경에서 수행합니다. 이번 리팩토링은 원본 JSON과 계산식을 변경하지 않았습니다. 스키마 검증은 자료의 진위나 통계적 정확성을 증명하지 않습니다. 새 데이터는 새 릴리스에서 검증 후 배포합니다.

## Render

`render.yaml`: Node 24, `npm run check:html && npm run check:data && npm test && npm run build:deploy`, `node dist/server.js`, `/healthz`. `ALLOWED_ORIGIN`은 실제 HTTPS origin으로 지정하고 HOST는 `0.0.0.0`, PORT는 Render 값을 사용합니다. 생성 HTML이 원본과 다르면 배포 검사가 실패하므로 변경 후 빌드 결과도 커밋하세요.

기존 Dashboard 설정은 YAML 수정만으로 자동 변경된다고 가정하지 마세요. 실제 서비스를 확인해 위 명령을 반영해야 합니다. `TRUST_PROXY_HOPS=0`을 유지했고, 실제 Render 프록시 홉을 확인하기 전 임의로 1로 바꾸지 않습니다. 0이면 프록시 뒤 사용자가 IP 제한을 공유할 수 있습니다.

## Cafe24 VPS

HTTPS → Nginx → `127.0.0.1:3000` → 단일 Node 프로세스입니다. Node 실행·systemd·Nginx 설치가 가능한 Linux VPS를 전제로 합니다. 제품명에 Python이 있다는 이유로 FastAPI로 이전할 필요가 없습니다. 절차·롤백은 [DEPLOYMENT.md](deploy/DEPLOYMENT.md)를 따릅니다.

## API와 보안 범위

| 경로 | 메서드 | 동작 |
| --- | --- | --- |
| `/healthz` | 상태 확인 | 프로세스 상태; 외부 제공자 상태까지 검증하지 않음 |
| `/api/config` | GET | 이메일 기능 활성 여부; 비밀키 반환 없음 |
| `/api/support` | POST JSON | 공개 공고. 키 없으면 configured:false |
| `/api/report` | POST JSON | 동의·이메일·Idempotency-Key 검증; 기본 발송 꺼짐 |

`api/market.js`는 의도적으로 미연결이며 소스에만 보관합니다. `/api/market`은 404입니다. 출처 제한은 인증/봇 방어가 아닙니다. 요청 제한과 메일 중복 방지는 단일 프로세스 메모리이며 재시작 시 초기화됩니다. 수신자 인증·다중 인스턴스 공유 제한은 구현되어 있지 않습니다.

정적 응답에는 CSP, MIME 제한, realpath 경계, no-cache 재검증, gzip이 적용됩니다. inline style은 기존 템플릿을 위해 허용합니다. 코드와 비밀 파일은 공개 frontend 밖에 둡니다. 운영 로그에는 요청 본문·메일 주소를 기록하지 않습니다.

설정은 [SETUP.md](SETUP.md), 변경 검토는 [AUDIT.md](AUDIT.md)를 참고하세요. `docs/history/`는 이전 시점의 증거이며 현재 배포 지침이 아닙니다.
