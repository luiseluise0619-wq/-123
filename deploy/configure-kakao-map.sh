#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo 'sudo로 실행해야 합니다.' >&2
  exit 1
fi

ENV_FILE=/etc/mysbizon-node.env
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE을 찾을 수 없습니다." >&2; exit 1; }
[[ -r /dev/tty ]] || { echo '키를 안전하게 입력할 터미널이 필요합니다.' >&2; exit 1; }

read -r -s -p '카카오 지도 JavaScript 키를 붙여넣고 Enter: ' KAKAO_KEY </dev/tty
printf '\n' >/dev/tty
if [[ ! $KAKAO_KEY =~ ^[A-Za-z0-9_-]{16,128}$ ]]; then
  unset KAKAO_KEY
  echo '키 형식이 맞지 않습니다. JavaScript 키를 다시 확인하세요.' >&2
  exit 1
fi

TMP=$(mktemp /etc/mysbizon-node.env.XXXXXX)
trap 'rm -f "$TMP"; unset KAKAO_KEY' EXIT
FOUND=0
while IFS= read -r LINE || [[ -n $LINE ]]; do
  if [[ $LINE == KAKAO_JAVASCRIPT_KEY=* ]]; then
    printf 'KAKAO_JAVASCRIPT_KEY=%s\n' "$KAKAO_KEY" >>"$TMP"
    FOUND=1
  else
    printf '%s\n' "$LINE" >>"$TMP"
  fi
done <"$ENV_FILE"
(( FOUND )) || printf 'KAKAO_JAVASCRIPT_KEY=%s\n' "$KAKAO_KEY" >>"$TMP"
install -o root -g root -m 600 "$TMP" "$ENV_FILE"
unset KAKAO_KEY

systemctl restart mysbizon-node
READY=0
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3000/healthz >/dev/null 2>&1; then READY=1; break; fi
  sleep 0.25
done
[[ $READY == 1 ]] || { systemctl --no-pager --full status mysbizon-node >&2 || true; exit 1; }

curl -fsS http://127.0.0.1:3000/api/config | python3 -c \
  'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d.get("kakaoMap",{}).get("enabled") is True else "카카오 지도 설정 확인 실패")'
echo '카카오 지도 키를 저장했고 서비스를 다시 시작했습니다. 키 값은 출력하지 않았습니다.'
