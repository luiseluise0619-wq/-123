// 오류를 '밖으로' 내보낼 때 쓰는 공용 유틸.
//
// 왜 필요한가
//   여러 엔드포인트가 catch 에서 String(e) 를 그대로 응답에 담아 보냈다.
//   그 문자열은 화면에 그대로 뜬다(예: zone.html 의 리포트 신청 모달).
//   그런데 내부 오류 메시지에는 우리가 밖에 보이고 싶지 않은 것이 섞인다.
//     · DB 연결 실패: "getaddrinfo ENOTFOUND ep-xxxx-yyy.ap-northeast-1.aws.neon.tech"
//       → 우리 DB 호스트명이 그대로 노출된다.
//     · 상류 API 오류: 요청 URL 이 섞여 나오면 쿼리스트링의 키까지 함께 나간다.
//     · Postgres 오류: 테이블·컬럼·제약조건 이름이 그대로 나온다(스키마 노출).
//
// 원칙
//   서버 로그에는 전부 남긴다(운영자가 원인을 봐야 한다).
//   클라이언트에는 상황만 알린다(사용자가 할 수 있는 행동만).
//
// 화면 동작은 바뀌지 않는다 — 실패 시 오류 문구가 뜨는 것도, 그 자리도 그대로다.
// 문구 안에서 '내부 사정'만 빠진다.

// 키처럼 생긴 것을 가린다. 로그에도 키를 남기지 않기 위한 2차 방어.
//   key=... · serviceKey=... · Bearer xxx · x-api-key: xxx · postgres://user:pw@host
const SECRET_PATTERNS = [
  /([?&](?:key|serviceKey|apikey|api_key|access_token|token)=)[^&\s"']+/gi,
  /(Bearer\s+)[A-Za-z0-9._\-]+/gi,
  /(x-api-key['":\s]+)[A-Za-z0-9._\-]+/gi,
  /(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi,
];

/**
 * 문자열에서 키·비밀번호처럼 보이는 부분을 가린다. 로그용.
 *
 * 호스트명·테이블명까지 가리지는 않는다 — 그건 운영자가 원인을 보려면 필요한 정보이고,
 * 어차피 safeError 가 클라이언트로는 아무 detail 도 내보내지 않는다.
 * 여기서 가리는 건 '로그에도 남으면 안 되는 것'(키·비밀번호)뿐이다.
 */
export function redact(s) {
  let out = String(s == null ? "" : s);
  for (const re of SECRET_PATTERNS) {
    // replace 콜백의 인자는 (match, ...그룹들, offset, 전체문자열) 이다.
    // 그룹이 하나뿐인 패턴에서 두 번째 인자를 그룹으로 착각하면 offset 숫자가 붙어 나온다.
    out = out.replace(re, (...args) => {
      const groups = args.slice(1, -2).filter((g) => typeof g === "string");
      return groups[0] + "***" + (groups[1] || "");
    });
  }
  return out;
}

/**
 * 오류를 서버 로그에 남기고, 클라이언트에 줄 안전한 문구를 돌려준다.
 *
 *   return res.status(200).json({ ok:false, error: safeError("lead", e, "저장 실패") });
 *
 * @param tag     로그에서 어느 엔드포인트인지 구분할 이름
 * @param e       잡은 오류
 * @param userMsg 사용자에게 보일 앞머리(각 화면이 이미 쓰던 문구를 그대로 넘긴다)
 */
export function safeError(tag, e, userMsg) {
  const detail = redact((e && (e.stack || e.message)) || e);
  console.error(`[${tag}]`, detail);
  return `${userMsg}. 잠시 후 다시 시도해 주세요.`;
}
