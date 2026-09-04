// 외부 API 호출 공용 유틸.
//
// 왜 필요한가
//   상류(카카오·공공데이터포털·국세청)가 응답을 주지 않으면 fetch 는 기본적으로 무한정 기다린다.
//   서버리스 함수는 그 동안 살아 있고, 결국 플랫폼 제한 시간에 걸려 강제 종료된다.
//   그러면 우리가 준비한 정직한 오류 문구 대신 플랫폼의 504 가 사용자에게 간다.
//   (_ai.js 는 후보 모델을 여러 번 시도하느라 더 복잡한 예산 관리가 필요해 자체 구현을 쓴다.)
//
// 값의 근거
//   공공 API 는 느릴 때 5~8초가 나온다. 10초면 정상 응답은 통과하고 먹통은 걸러진다.
const DEFAULT_TIMEOUT_MS = 10000;

/** fetch 에 상한 시간을 붙인 것. 시간이 지나면 TimeoutError 로 throw 된다. */
export function fetchT(url, opts, timeoutMs) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  return fetch(url, { ...(opts || {}), signal: AbortSignal.timeout(ms) });
}

// data.go.kr 인증키는 Encoding(%2B…)·Decoding(원본) 두 형태로 발급된다.
// 어느 걸 넣어도 동작하게: 이미 인코딩돼 있으면 그대로, 아니면 encodeURIComponent.
// (그냥 URLSearchParams 에 넣으면 Encoding 형태가 %2B → %252B 로 이중 인코딩돼 키가 깨진다.)
export function encKey(k) {
  return /%[0-9A-Fa-f]{2}/.test(String(k)) ? String(k) : encodeURIComponent(String(k));
}

/**
 * Date → "YYYY-MM-DD" (지역 시간 기준).
 *
 * toISOString().slice(0,10) 을 쓰면 안 된다.
 * new Date(2026, 8, 30) 은 '지역 시간 자정'인데 toISOString 은 UTC 로 바꾼다.
 * 서버 TZ 가 Asia/Seoul 이면 2026-09-30 자정 → UTC 2026-09-29T15:00Z → "2026-09-29".
 * 마감일이 하루 앞당겨 보인다(지원 공고 화면에서는 그대로 틀린 정보가 된다).
 */
export function ymdLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
