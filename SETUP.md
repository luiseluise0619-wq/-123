# 실행 설정

현재 기준은 Node 서버입니다. 과거 설정 설명은 docs/history/SETUP.md에 보관했습니다. 키를 프런트엔드에 넣지 마세요.

| 환경변수 | 의미 |
| --- | --- |
| NODE_ENV | 운영은 production; ALLOWED_ORIGIN 누락 시 시작 거부 |
| HOST / PORT | Render 0.0.0.0/제공 PORT, VPS 127.0.0.1/3000 |
| ALLOWED_ORIGIN | 정확한 https://호스트[:포트]; 여러 개면 쉼표 구분 |
| TRUST_PROXY_HOPS | 기본 0; 검증된 단일 Nginx 뒤에서는 1 |
| REPORT_EMAIL_ENABLED | 기본 false |
| BREVO_API_KEY | 이메일 발송 서버 전용 키 |
| REPORT_FROM_EMAIL / REPORT_FROM_NAME | 인증된 발신자 주소/표시 이름 |
| DATA_GO_KR_KEY | 지원사업/관련 수집기 키 |
| SUPPORT_API_URL | 지원사업 공고 제공자 endpoint; 실제 스키마 확인 필요 |

`.env.example`을 참고합니다. 서버는 env 파일을 자동으로 읽지 않습니다. 로컬은 `node --env-file=.env server.js`, VPS는 systemd EnvironmentFile을 사용합니다. VPS unit은 실행 시 NODE_ENV/HOST/PORT/TRUST_PROXY_HOPS를 고정합니다. Nginx 토폴로지를 바꾸면 unit도 같이 검토하세요.

## 데이터 수집

운영 Node에 pip 패키지를 설치할 필요가 없습니다. 격리된 수집 환경에서 `.github/workflows/refresh-dashboard.yml`의 단계와 변수명을 따릅니다. 수집 워크플로는 pandas/requests/pyproj/pyarrow를 사용합니다. backend/requirements.txt는 FastAPI/ML 실험 의존성까지 포함하므로 운영 설치 목록이 아닙니다.

주요 수집 키는 SEOUL_API_KEY(일부 경로 SEOUL_OPENDATA_API_KEY), DATA_GO_KR_KEY, LOCALDATA_KEY입니다. 서비스별 URL/오퍼레이션은 workflow와 backend/DATA_SOURCES.md, backend/COLLECTOR_UPGRADE.md를 참고합니다. 특정 키를 넣어도 미승인 공공 API는 활성화되지 않습니다.

```sh
cd backend
python build_v3.py
cd ..
npm run check:data
npm test
npm run build:deploy -- /tmp/mysbizon-new-release
```

위 build_v3는 선행 수집 산출물이 준비된 상태에서 실행합니다. 기존 자료를 보존하는 폴백이 있으므로 성공 종료만으로 최신 자료 확보를 판단하지 않습니다. workflow 마지막 report_freshness와 실제 updated/quarter를 확인하세요.

## 미연결 기능

api/market.js의 ECOS_KEY, KAMIS_KEY/KAMIS_ID, OPINET_KEY는 현재 운영에서 읽히지 않습니다. 키만 넣어서 연결됐다고 표시하지 않습니다. UI의 준비 중 목록과 기존 6개 공개 통계는 유지합니다. 지도의 도로/건물/외부지도 기능, 원자료 미제공 지역은 기존 준비 중 상태를 유지합니다.

실제 메일 발송·외부 공공 API 호출은 이번 검증에 포함되지 않았습니다. 모의 제공자 테스트와 키 없는 동작은 확인했습니다.
