# 유지보수 원칙과 현재 상태

현재 production은 `node server.js`(artifact 안 기준)입니다. Render는 `node dist/server.js`, Cafe24는 Nginx 뒤 단일 Node 프로세스입니다. FastAPI/ML/PostgreSQL은 현재 운영 의존성이 아닙니다. 이전 상세 논의는 docs/history/CLAUDE.md에 보관했으며 과거 계획을 현재 구현으로 해석하지 않습니다.

## 데이터와 UX

없는 통계는 만들지 않습니다. 실측/추정/가정/폴백을 구별합니다. 자격·매출·성공을 보장하지 않습니다. UI 디자인과 문구를 변경하지 않고 기존 계산을 보존합니다. 동적 template binding과 globalThis 참조를 고려하여 삭제 여부를 판단합니다.

## 보안과 변경 범위

키·개인정보를 코드나 공개 frontend에 넣지 않습니다. .env는 커밋하지 않습니다. 비밀값은 로그나 문서에 출력하지 않습니다. 실제 노출이 확인되면 키 교체가 필요합니다. 로컬의 가역적 코드 수정과 운영 서버/방화벽/DB 변경은 구분합니다. 운영 배포·메일 발송·DB 변경을 실제로 하지 않았다면 했다고 보고하지 않습니다.

## 원본과 배포

index.html은 screens 원본으로 재생성합니다. dc-runtime TS 원본은 첨부본에 없고 그 이유를 알 수 없으므로 artifact로 보존합니다. source repository에는 수집기와 실험 코드를 남기되 scripts/deploy-files.mjs 경계 밖 파일을 운영 artifact에 넣지 않습니다. 변경마다 check:html/check:data/npm test를 실행합니다.

## §25 살아있는 체크리스트

- dc-runtime/src TS와 재현 가능한 build 환경을 원저장소/작성자로부터 회수해야 함.
- Render의 실제 X-Forwarded-For 홉과 직접 접속 경계를 확인해야 함. 기본 TRUST_PROXY_HOPS=0은 프록시 IP 제한 공유 가능.
- 서울·공공데이터 상가정보·R-ONE·수출입은행·Gemini는 `api/integrations.js`, K-Startup은 `api/support.js`로 연결한다. 키는 서버 환경에만 둔다.
- R-ONE은 인증키 외에 조회할 통계표·주기·지역·항목 코드를 설정해야 한다. 실제 회사 키의 승인·한도와 운영 응답은 배포 후 확인한다.
- 메일은 기본 꺼짐. 실제 발신자 검증, 회사 개인정보 정책, 수신자 확인/봇 방어는 별도 운영 작업.
- rate limit/idempotency는 단일 프로세스 메모리. 재시작·복수 인스턴스 간 영속성 없음.
- v3 핵심 10개를 서버에서 검증하며 부가 3개는 클라이언트 guard. 부가 데이터 의미 검증 확장 여지 있음.
- 수집 워크플로에 다수 continue-on-error가 있으나 마지막 report_freshness 단계는 차단형. 부분 실패/기존 스냅샷 유지 상태를 구분해 모니터링해야 함.
- signals와 sales_forecast의 검증 기준이 다름. 통계 의미 변경 없이 이번에는 보존.
- 일회성 타이머 일부와 진행 중 프런트 요청의 통합 취소는 추가 개선 여지. 차트 종료 누수와 첫 paint 타이머는 정리됨.
- 서버 오류 redaction은 보조 방어이며 임의의 모든 PII 문자열 제거를 보장하지 않음.
- 실 VPS의 nginx -t/systemd 검증, TLS·방화벽·회전 로그·롤백·부하검증은 접근 가능한 운영 환경에서 필요.

## 고객 데이터 후속 요청

기존 Node 서버를 유지하며 PostgreSQL(pg)을 추가했습니다. 관리자 서버는 별도 loopback 프로세스이며 Nginx Basic Auth를 거쳐 같은 도메인의 `/admin/`으로만 공개합니다. DB 저장은 필수 설정과 사용자 선택 동의가 갖춰져야 작동합니다. 테스트 전에 npm ci를 실행합니다. deploy/CUSTOMER-DATA.md 참고.
