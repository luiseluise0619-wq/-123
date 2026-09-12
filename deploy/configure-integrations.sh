#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

ENV_FILE=/etc/mysbizon-node.env
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE does not exist." >&2; exit 1; }

upsert() {
  local name=$1 value=$2 line found=0 tmp
  tmp=$(mktemp /etc/mysbizon-node.env.XXXXXX)
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ $line == "$name="* ]]; then printf '%s=%s\n' "$name" "$value" >>"$tmp"; found=1
    else printf '%s\n' "$line" >>"$tmp"
    fi
  done <"$ENV_FILE"
  (( found )) || printf '%s=%s\n' "$name" "$value" >>"$tmp"
  install -o root -g root -m 600 "$tmp" "$ENV_FILE"
  rm -f "$tmp"
}

read_secret() {
  local name=$1 label=$2 value
  read -r -s -p "$label (없으면 Enter, 기존 값 유지): " value </dev/tty
  printf '\n' >/dev/tty
  [[ -z "$value" ]] || upsert "$name" "$value"
  unset value
}

echo "키는 화면에 표시되지 않으며 /etc/mysbizon-node.env에만 저장됩니다."
read_secret SEOUL_API_KEY "서울 열린데이터광장 키"
read_secret DATA_GO_KR_KEY "공공데이터포털 키 (K-Startup에서도 기본 사용)"
read_secret KSTARTUP_API_KEY "K-Startup에 별도 키를 쓸 때만 입력"
read_secret RONE_API_KEY "R-ONE 키"
read_secret EXIM_API_KEY "한국수출입은행 키"
read_secret GEMINI_API_KEY "Gemini 키"
upsert GEMINI_MODEL "gemini-3.8-flash"

if grep -q '^RONE_API_KEY=.' "$ENV_FILE"; then
  echo "R-ONE은 키 외에 조회할 통계표·지역·항목 코드가 필요합니다. 모르면 Enter로 건너뛰세요."
  for spec in \
    'RONE_STATBL_ID:R-ONE 통계표 코드' \
    'RONE_CYCLE:R-ONE 주기 코드(예: QY)' \
    'RONE_CLS_ID:R-ONE 지역 코드' \
    'RONE_ITM_ID:R-ONE 항목 코드'; do
    name=${spec%%:*}; label=${spec#*:}; read -r -p "$label: " value </dev/tty
    [[ -z "$value" ]] || upsert "$name" "$value"
  done
fi

systemctl restart mysbizon-node
for _ in {1..20}; do curl -fsS http://127.0.0.1:3000/healthz >/dev/null && break; sleep 0.25; done
curl -fsS http://127.0.0.1:3000/api/integrations
printf '\n설정 저장과 서비스 재시작이 끝났습니다. 키 값은 출력하지 않았습니다.\n'
