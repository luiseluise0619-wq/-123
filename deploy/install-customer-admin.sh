#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi
command -v psql >/dev/null || { echo "PostgreSQL client is missing." >&2; exit 1; }
command -v openssl >/dev/null || { echo "OpenSSL is missing." >&2; exit 1; }

DOMAIN=mysbizon.mycafe24.com
RELEASE=/opt/mysbizon-node/current
RUNTIME=/opt/mysbizon-node/runtime/node-v22.23.2/bin/node
SECRETS=/etc/mysbizon-customer-secrets
WEB_ENV=/etc/mysbizon-node.env
ADMIN_ENV=/etc/mysbizon-admin.env
HTPASSWD=/etc/nginx/.htpasswd-mysbizon-admin
SITE=/etc/nginx/sites-available/mysbizon
SNIPPET=/etc/nginx/snippets/mysbizon-admin-location.conf
SITE_BACKUP=
SNIPPET_BACKUP=

rollback_nginx() {
  local status=$?
  if [[ $status -ne 0 && -n "$SITE_BACKUP" && -f "$SITE_BACKUP" ]]; then
    cp "$SITE_BACKUP" "$SITE"
  fi
  if [[ $status -ne 0 && -n "$SNIPPET_BACKUP" && -f "$SNIPPET_BACKUP" ]]; then cp "$SNIPPET_BACKUP" "$SNIPPET"; fi
  if [[ $status -ne 0 && -n "$SNIPPET_BACKUP" && ! -s "$SNIPPET_BACKUP" ]]; then rm -f "$SNIPPET"; fi
  if [[ $status -ne 0 && ( -n "$SITE_BACKUP" || -n "$SNIPPET_BACKUP" ) ]]; then
    nginx -t >/dev/null 2>&1 && systemctl reload nginx || true
    echo "관리자 설치가 중단되어 Nginx 설정을 이전 상태로 복구했습니다." >&2
  fi
  exit "$status"
}
trap rollback_nginx ERR

[[ -x "$RUNTIME" && -f "$RELEASE/server/customer-admin.js" && -f "$RELEASE/deploy/customer-schema.sql" ]] || {
  echo "Deploy the current release before installing customer admin." >&2; exit 1;
}

if [[ ! -f "$SECRETS" ]]; then
  umask 077
  {
    printf 'DB_WEB_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'DB_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'CUSTOMER_DATA_KEY=%s\n' "$(openssl rand -hex 32)"
    printf 'CUSTOMER_ADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)"
  } >"$SECRETS"
fi
chown root:root "$SECRETS"; chmod 600 "$SECRETS"
# shellcheck disable=SC1090
source "$SECRETS"

sudo -u postgres psql --set ON_ERROR_STOP=1 \
  --set web_password="$DB_WEB_PASSWORD" --set admin_password="$DB_ADMIN_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE mysbizon_customer_owner NOLOGIN')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='mysbizon_customer_owner') \gexec
SELECT format('CREATE ROLE mysbizon_customer_web LOGIN PASSWORD %L', :'web_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='mysbizon_customer_web') \gexec
SELECT format('CREATE ROLE mysbizon_customer_admin LOGIN PASSWORD %L', :'admin_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='mysbizon_customer_admin') \gexec
ALTER ROLE mysbizon_customer_web PASSWORD :'web_password';
ALTER ROLE mysbizon_customer_admin PASSWORD :'admin_password';
SELECT 'CREATE DATABASE mysbizon_customer OWNER mysbizon_customer_owner'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='mysbizon_customer') \gexec
SQL

sudo -u postgres psql --set ON_ERROR_STOP=1 -d mysbizon_customer -f "$RELEASE/deploy/customer-schema.sql"
sudo -u postgres psql --set ON_ERROR_STOP=1 -d mysbizon_customer <<'SQL'
ALTER TABLE customer_submissions OWNER TO mysbizon_customer_owner;
ALTER TABLE customer_clicks OWNER TO mysbizon_customer_owner;
ALTER TABLE customer_admin_audit OWNER TO mysbizon_customer_owner;
ALTER SEQUENCE customer_admin_audit_id_seq OWNER TO mysbizon_customer_owner;
REVOKE ALL ON DATABASE mysbizon_customer FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE mysbizon_customer TO mysbizon_customer_web,mysbizon_customer_admin;
GRANT USAGE ON SCHEMA public TO mysbizon_customer_web,mysbizon_customer_admin;
GRANT INSERT ON customer_submissions TO mysbizon_customer_web;
GRANT SELECT(id) ON customer_submissions TO mysbizon_customer_web;
GRANT INSERT,UPDATE(count),SELECT(day,event,device,count) ON customer_clicks TO mysbizon_customer_web;
GRANT SELECT,DELETE ON customer_submissions,customer_clicks,customer_admin_audit TO mysbizon_customer_admin;
GRANT INSERT ON customer_admin_audit TO mysbizon_customer_admin;
GRANT USAGE,SELECT ON SEQUENCE customer_admin_audit_id_seq TO mysbizon_customer_admin;
SQL

upsert() {
  local file=$1 name=$2 value=$3 line found=0 tmp
  touch "$file"; tmp=$(mktemp "${file}.XXXXXX")
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line == "$name="* ]]; then printf '%s=%s\n' "$name" "$value" >>"$tmp"; found=1
    else printf '%s\n' "$line" >>"$tmp"
    fi
  done <"$file"
  (( found )) || printf '%s=%s\n' "$name" "$value" >>"$tmp"
  install -o root -g root -m 600 "$tmp" "$file"; rm -f "$tmp"
}

upsert "$WEB_ENV" CUSTOMER_DATABASE_URL "postgresql://mysbizon_customer_web:${DB_WEB_PASSWORD}@127.0.0.1:5432/mysbizon_customer"
upsert "$WEB_ENV" CUSTOMER_DATA_KEY "$CUSTOMER_DATA_KEY"
upsert "$WEB_ENV" CUSTOMER_DATA_ENABLED "false"
upsert "$WEB_ENV" CUSTOMER_RETENTION_DAYS "90"

install -o root -g root -m 600 /dev/null "$ADMIN_ENV"
upsert "$ADMIN_ENV" CUSTOMER_DATABASE_URL "postgresql://mysbizon_customer_admin:${DB_ADMIN_PASSWORD}@127.0.0.1:5432/mysbizon_customer"
upsert "$ADMIN_ENV" CUSTOMER_DATA_KEY "$CUSTOMER_DATA_KEY"
upsert "$ADMIN_ENV" CUSTOMER_DATA_ENABLED "false"
upsert "$ADMIN_ENV" CUSTOMER_RETENTION_DAYS "90"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_TOKEN "$CUSTOMER_ADMIN_TOKEN"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_PORT "3102"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_LISTEN_HOST "127.0.0.1"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_PUBLIC "1"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_BASE_PATH "/admin"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_ALLOWED_HOSTS "$DOMAIN,127.0.0.1:3102"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_ALLOWED_ORIGINS "https://$DOMAIN"

if [[ ! -f "$HTPASSWD" ]]; then
  read -r -s -p "관리자 URL 1차 비밀번호(14자 이상): " WEB_PASSWORD </dev/tty; printf '\n' >/dev/tty
  [[ ${#WEB_PASSWORD} -ge 14 ]] || { echo "Password must be at least 14 characters." >&2; exit 1; }
  HASH=$(printf '%s' "$WEB_PASSWORD" | openssl passwd -6 -stdin)
  printf 'mysbizon-admin:%s\n' "$HASH" >"$HTPASSWD"
  unset WEB_PASSWORD HASH
fi
chown root:www-data "$HTPASSWD"; chmod 640 "$HTPASSWD"
install -d -o root -g root -m 755 /etc/nginx/snippets
SNIPPET_BACKUP=$(mktemp /tmp/mysbizon-admin-snippet.XXXXXX)
if [[ -f "$SNIPPET" ]]; then cp "$SNIPPET" "$SNIPPET_BACKUP"; fi

cat > /etc/systemd/system/mysbizon-admin.service <<EOF
[Unit]
Description=Mysbizon customer admin
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=mysbizon-node
Group=mysbizon-node
WorkingDirectory=$RELEASE
EnvironmentFile=$ADMIN_ENV
ExecStart=$RUNTIME server/customer-admin.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
UMask=0077
MemoryMax=256M
TasksMax=64
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mysbizon-admin

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/mysbizon-customer-purge.service <<EOF
[Unit]
Description=Mysbizon expired customer data purge
After=postgresql.service

[Service]
Type=oneshot
User=mysbizon-node
Group=mysbizon-node
WorkingDirectory=$RELEASE
EnvironmentFile=$ADMIN_ENV
ExecStart=$RUNTIME scripts/customer-purge.mjs
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictNamespaces=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
UMask=0077
MemoryMax=256M
TasksMax=64
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mysbizon-customer-purge
EOF

cat > /etc/systemd/system/mysbizon-customer-purge.timer <<'EOF'
[Unit]
Description=Run Mysbizon customer retention purge daily

[Timer]
OnCalendar=daily
RandomizedDelaySec=1h
Persistent=true

[Install]
WantedBy=timers.target
EOF

cat >"$SNIPPET" <<'EOF'
location = /admin { return 308 /admin/; }
location ^~ /admin/ {
    auth_basic "MYSBIZON staff";
    auth_basic_user_file /etc/nginx/.htpasswd-mysbizon-admin;
    limit_except GET POST { deny all; }
    client_max_body_size 64k;
    proxy_pass http://127.0.0.1:3102;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 20s;
}
EOF

if ! grep -qF 'include /etc/nginx/snippets/mysbizon-admin-location.conf;' "$SITE"; then
  SITE_BACKUP="${SITE}.before-admin-$(date +%Y%m%d%H%M%S)"
  cp "$SITE" "$SITE_BACKUP"
  SITE="$SITE" python3 - <<'PY'
from pathlib import Path
import os
p=Path(os.environ['SITE']); text=p.read_text()
marker='    # --- Welcome fallback ---'
if text.count(marker)!=1: raise SystemExit('Expected one Nginx welcome marker')
text=text.replace(marker,'    include /etc/nginx/snippets/mysbizon-admin-location.conf;\n\n'+marker)
p.write_text(text)
PY
fi

systemd-analyze verify /etc/systemd/system/mysbizon-admin.service /etc/systemd/system/mysbizon-customer-purge.service /etc/systemd/system/mysbizon-customer-purge.timer
systemctl daemon-reload
systemctl enable --now mysbizon-admin
systemctl enable --now mysbizon-customer-purge.timer
admin_ready=0
for _ in $(seq 1 30); do
  if curl -fsS -H "Host: $DOMAIN" http://127.0.0.1:3102/admin/ >/dev/null 2>&1; then admin_ready=1; break; fi
  sleep 0.25
done
[[ $admin_ready == 1 ]] || { systemctl --no-pager --full status mysbizon-admin >&2 || true; exit 1; }
nginx -t
systemctl reload nginx
systemctl restart mysbizon-node
trap - ERR
rm -f "$SNIPPET_BACKUP"

printf '\n관리자 주소: https://%s/admin/\n' "$DOMAIN"
printf '1차 사용자명: mysbizon-admin\n'
printf '2차 관리자 키(안전한 비밀번호 관리자에 보관): %s\n' "$CUSTOMER_ADMIN_TOKEN"
printf '고객 수집은 개인정보 문구를 확정할 때까지 꺼 둔 상태입니다.\n'
