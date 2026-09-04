// 공용 origin 검사 — 각 엔드포인트에 중복 구현돼 있던 동일 로직을 한 곳으로 통합.
// 목적: 외부 스크립트가 우리 API 키(AI·카카오·공공데이터)를 소진하지 못하게 막는다.
//
// 정책
//   1) ALLOWED_ORIGIN 환경변수가 있으면 그 도메인만 허용(가장 엄격 — 운영에서는 이걸 쓴다).
//   2) 없으면 같은 사이트(Origin 의 호스트 === 요청 host) 허용.
//   3) 프리뷰 배포끼리(양쪽 다 *.vercel.app)도 허용 — 개발 중 프리뷰에서 API 를 부를 수 있게.
//   4) Origin 헤더가 아예 없는 요청(curl·서버 스크립트)은 기본 차단.
//      단 브라우저는 "같은 출처 GET"에는 Origin 을 보내지 않으므로,
//      GET 전용 엔드포인트만 allowMissing:true 로 예외를 둔다.
//      (키를 소비하는 POST 는 반드시 기본값 false 로 두어 curl 남용을 막는다)
//
// 왜 문자열 포함 검사가 아니라 호스트를 파싱해 정확히 비교하는가
//   예전 구현은 origin.endsWith(host) 와 origin.includes(host) 를 썼다. 둘 다 뚫린다.
//     host = "sanggwon.example.com" 일 때
//       "https://evilsanggwon.example.com"     ← endsWith 통과(앞에 아무거나 붙이면 됨)
//       "https://sanggwon.example.com.evil.kr" ← includes 통과(뒤에 아무거나 붙이면 됨)
//   둘 다 공격자가 5분이면 등록할 수 있는 도메인이다. 통과하면 그 페이지가
//   우리 Gemini·카카오 키를 마음대로 쓴다(요금은 우리가 낸다).
//   그래서 호스트명만 뽑아 '완전히 같은지'로 판정한다.
//
// 파일명이 '_' 로 시작해 Vercel 이 API 경로로 노출하지 않는다(공용 유틸).

// "https://a.com:443/" → "a.com"  /  잘못된 값이면 ""
function hostOf(originOrHost) {
  const s = String(originOrHost || "").trim().toLowerCase();
  if (!s) return "";
  try {
    // Origin 은 스킴을 포함한다. host 헤더는 안 한다 → 없으면 붙여서 같은 파서로 처리.
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : "http://" + s).hostname;
  } catch {
    return "";
  }
}

const isPreview = (h) => h.endsWith(".vercel.app");

if (!process.env.ALLOWED_ORIGIN) {
  // 운영에서는 이 값을 넣는 것이 가장 확실한 잠금이다. 없으면 아래 규칙으로 동작하는데,
  // 사이트 자체가 *.vercel.app 도메인이면 남의 *.vercel.app 페이지도 통과할 수 있다.
  console.warn("[origin] ALLOWED_ORIGIN 미설정 — 운영 도메인을 넣어 두면 외부 호출을 완전히 막을 수 있습니다.");
}

export function isAllowedOrigin(req, { allowMissing = false } = {}) {
  const h = (req && req.headers) || {};
  const allow = process.env.ALLOWED_ORIGIN;

  const originHost = hostOf(h.origin);
  const reqHost = hostOf(h.host);

  if (allow) {
    // 설정값 형태가 제각각이다("https://a.com" · "a.com" · 끝 슬래시).
    // 스킴까지 적어 뒀으면 스킴도 지킨다(https 로 잠근 걸 http 가 통과하면 안 된다).
    // 호스트만 적어 뒀으면 호스트로만 비교한다.
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(String(allow).trim());
    if (hasScheme) {
      const norm = (v) => { try { return new URL(String(v).trim()).origin.toLowerCase(); } catch { return ""; } };
      const a = norm(allow);
      return !!a && norm(h.origin) === a;
    }
    const allowHost = hostOf(allow);
    return !!allowHost && originHost === allowHost;
  }
  if (!h.origin) return allowMissing;
  if (!originHost || !reqHost) return false;

  if (originHost === reqHost) return true;
  // 프리뷰 배포끼리만. 운영 도메인(커스텀 도메인)에서는 남의 vercel.app 을 받지 않는다.
  return isPreview(reqHost) && isPreview(originHost);
}

// 거절 응답은 엔드포인트마다 형태가 조금씩 달라 본문은 각 파일에서 만든다.
export const FORBIDDEN_MSG = "이 사이트에서만 사용할 수 있습니다.";
