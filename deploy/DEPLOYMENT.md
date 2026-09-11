# Render / Cafe24 Linux VPS 배포

이 문서는 실행 절차이며 이번 작업에서 운영 서버에 실행하지 않았습니다. Node 24, systemd와 Nginx를 사용할 수 있는 Linux VPS를 전제로 합니다.

## 릴리스 생성

소스 checkout에서 실행합니다.

```sh
npm ci
npm run build:html
npm run check:data
npm test
npm run build:deploy -- /tmp/mysbizon-20260911
```

결과의 모든 파일과 DEPLOY-MANIFEST.json을 전송합니다. deploy/의 service/conf 파일은 운영자가 별도로 설치할 구성 예시입니다. 서비스는 수집기/테스트/ML 없이 동작하며 고객 DB용 pg 의존성이 있어 운영 artifact에서 `npm ci --omit=dev`를 실행합니다.

## 최초 VPS 구성

아래는 Debian/Ubuntu 계열 예시입니다. 실제 Node 경로는 `command -v node`로 확인하고 unit의 `/usr/bin/node`와 맞춰야 합니다.

```sh
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin mysbizon
sudo install -d -o root -g root -m 755 /opt/mysbizon/releases
# artifact를 /opt/mysbizon/releases/20260911 에 업로드한 다음
sudo chown -R root:root /opt/mysbizon/releases/20260911
sudo find /opt/mysbizon/releases/20260911 -type d -exec chmod 755 {} +
sudo find /opt/mysbizon/releases/20260911 -type f -exec chmod 644 {} +
sudo install -o root -g root -m 600 .env.example /etc/mysbizon.env
sudoedit /etc/mysbizon.env
```

ALLOWED_ORIGIN을 실 도메인으로 바꿉니다. 키는 파일 안에서만 편집하고 쉘 명령/로그에 넣지 않습니다. EMAIL 기능은 검증 전 false를 유지합니다. root가 env를 읽어 서비스 프로세스에 전달하므로 비로그인 서비스 사용자에게 env 파일 읽기 권한을 줄 필요는 없습니다.

```sh
sudo ln -s /opt/mysbizon/releases/20260911 /opt/mysbizon/current
sudo install -m 644 deploy/mysbizon.service /etc/systemd/system/mysbizon.service
sudo systemd-analyze verify /etc/systemd/system/mysbizon.service
sudo systemctl daemon-reload
sudo systemctl enable --now mysbizon
curl --fail http://127.0.0.1:3000/healthz
```

unit은 production, loopback:3000, 신뢰 프록시 1홉을 고정합니다. 외부에서 Node에 직접 접근할 수 없어야 하며 Nginx는 X-Forwarded-For를 remote_addr로 덮어씁니다. MemoryMax=512M/TasksMax=128은 상한 예시이며 VPS 메모리에 맞게 조정합니다. CPU 강제 제한은 응답 지연과 장애 재시작을 유발할 수 있어 임의 추가하지 않았습니다.

## Nginx·TLS·로그

nginx.conf.example을 http 컨텍스트에 포함되는 설정 위치에 설치하고 도메인/인증서를 바꿉니다. 인증서는 서비스 도메인으로 먼저 발급받아야 합니다. HTTP는 HTTPS로 전환합니다. 외부 방화벽은 SSH 관리 경로와 80/443만 허용하고 3000은 열지 않습니다. 방화벽은 현재 SSH 접속을 잃지 않도록 별도 운영 창에서 검토합니다.

```sh
sudo nginx -t
sudo systemctl reload nginx
curl --fail https://your-domain.example/healthz
curl -I https://your-domain.example/
sudo ss -ltnp
sudo journalctl -u mysbizon --since '10 minutes ago'
```

static gzip/ETag/no-cache는 Node가 처리하며 Nginx proxy cache는 사용하지 않습니다. 기존처럼 HTML과 데이터는 재검증되어 릴리스 후 낡은 UI/수치가 장기간 남지 않습니다. access_log는 꺼져 있고 오류 로그에도 URL이 포함될 수 있으므로 수집 endpoint에 개인정보를 쿼리로 넣지 않습니다. OS 기본 Nginx logrotate와 journald의 SystemMaxUse/MaxRetentionSec를 확인하세요. 보존량은 디스크와 회사 정책에 맞춰 정하며 전역 journald 설정을 자동 변경하지 않습니다.

## 교체·롤백

새 artifact는 새 releases 디렉터리에서 검증한 뒤 current 링크를 바꿉니다. 아래는 GNU/Linux의 symlink 교체 예시이며 current가 실제 디렉터리가 아닌지 먼저 확인합니다.

```sh
readlink -f /opt/mysbizon/current
sudo ln -s /opt/mysbizon/releases/NEW_RELEASE /opt/mysbizon/current.next
sudo mv -Tf /opt/mysbizon/current.next /opt/mysbizon/current
sudo systemctl restart mysbizon
curl --fail http://127.0.0.1:3000/healthz
```

문제가 있으면 같은 과정에서 NEW_RELEASE 대신 직전 릴리스를 지정합니다. 기존 release는 검증 전 삭제하지 않습니다. 단일 프로세스 재시작이라 짧은 서비스 중단이 있을 수 있습니다. SIGTERM 후 서버는 idle 연결을 닫고 최대 15초 배수, systemd는 20초를 허용합니다. 실제 Linux 신호/프록시/TLS/방화벽 동작은 이 Windows 작업 환경에서 검증하지 않았습니다.

## Render

render.yaml의 검사/테스트/build:deploy와 node dist/server.js를 사용합니다. Node 버전 환경변수는 [Render 문서](https://render.com/docs/node-version), build 실패 시 기존 배포 유지 절차는 [배포 문서](https://render.com/docs/deploys)를 참고하세요. Render의 HOST/PORT를 VPS unit 값으로 덮어쓰지 마세요.

서버 requestTimeout과 socket timeout은 서로 다른 제한입니다([Node HTTP 문서](https://nodejs.org/api/http.html)). 이번 서버는 수신 30초/헤더 15초/keepalive 5초/유휴 socket 30초, API 본문 64KiB/10초와 외부 요청 10초를 사용합니다. Nginx proxy read 20초이며 정상 API 타임아웃보다 깁니다.

## 고객 데이터 추가 (후속 요청)

고객 설문·이메일 저장, 클릭 통계, SSH 접속 관리자 표·CSV를 추가했습니다. 기본은 비활성입니다. `deploy/CUSTOMER-DATA.md`의 설정·동의·보유 기간·관리자 접근 조건을 적용한 뒤 운영하세요. 실제 카페24 DB 연결은 미실행입니다.

직원 공개 접속이 필요하면 `deploy/nginx-admin-public.example`을 사용해 관리자 전용 서브도메인을 별도 vhost로 노출하고, 아래 환경변수를 추가하세요.

- `CUSTOMER_ADMIN_PUBLIC=1`
- `CUSTOMER_ADMIN_ALLOWED_HOSTS=admin.your-domain.example,127.0.0.1:3102`
- `CUSTOMER_ADMIN_ALLOWED_ORIGINS=https://admin.your-domain.example`
