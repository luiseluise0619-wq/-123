#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi
command -v openssl >/dev/null || { echo "OpenSSL is missing." >&2; exit 1; }

SECRETS=/etc/mysbizon-customer-secrets
ADMIN_ENV=/etc/mysbizon-admin.env
DOMAIN=mysbizon.mycafe24.com
[[ -f "$SECRETS" && -f "$ADMIN_ENV" ]] || { echo "Customer admin is not installed." >&2; exit 1; }

upsert() {
  local file=$1 name=$2 value=$3 line found=0 tmp
  tmp=$(mktemp "${file}.XXXXXX")
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line == "$name="* ]]; then printf '%s=%s\n' "$name" "$value" >>"$tmp"; found=1
    else printf '%s\n' "$line" >>"$tmp"
    fi
  done <"$file"
  (( found )) || printf '%s=%s\n' "$name" "$value" >>"$tmp"
  install -o root -g root -m 600 "$tmp" "$file"
  rm -f "$tmp"
}

new_token=$(openssl rand -hex 32)
upsert "$SECRETS" CUSTOMER_ADMIN_TOKEN "$new_token"
upsert "$ADMIN_ENV" CUSTOMER_ADMIN_TOKEN "$new_token"
systemctl restart mysbizon-admin

ready=0
for _ in $(seq 1 30); do
  if curl -fsS -H "Host: $DOMAIN" http://127.0.0.1:3102/admin/ >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.25
done
[[ $ready == 1 ]] || { systemctl --no-pager --full status mysbizon-admin >&2 || true; exit 1; }

printf '새 2차 관리자 키: %s\n' "$new_token"
printf '이 값은 다시 표시되지 않습니다. 비밀번호 관리자에 저장하고 채팅에 붙이지 마세요.\n'
