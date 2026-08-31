// 공용 origin 검사 — 각 엔드포인트에 중복 구현돼 있던 동일 로직을 한 곳으로 통합.
// 목적: 외부 스크립트가 우리 API 키(AI·카카오·공공데이터)를 소진하지 못하게 막는다.
//
// 정책
//   1) ALLOWED_ORIGIN 환경변수가 있으면 그 도메인만 허용(가장 엄격).
//   2) 없으면 같은 사이트(Origin 이 요청 host 와 일치) 또는 *.vercel.app(프리뷰 배포) 허용.
//   3) Origin 헤더가 아예 없는 요청(curl·서버 스크립트)은 기본 차단.
//      단 브라우저는 "같은 출처 GET"에는 Origin 을 보내지 않으므로,
//      GET 전용 엔드포인트만 allowMissing:true 로 예외를 둔다.
//      (키를 소비하는 POST 는 반드시 기본값 false 로 두어 curl 남용을 막는다)
//
// 파일명이 '_' 로 시작해 Vercel 이 API 경로로 노출하지 않는다(공용 유틸).
export function isAllowedOrigin(req, { allowMissing = false } = {}) {
  const h = (req && req.headers) || {};
  const origin = h.origin || "";
  const host = h.host || "";
  const allow = process.env.ALLOWED_ORIGIN;

  if (allow) return origin === allow;
  if (!origin) return allowMissing;

  const sameSite = origin.endsWith(host) || (!!host && origin.includes(host.split(":")[0]));
  return sameSite || origin.endsWith(".vercel.app");
}

// 거절 응답은 엔드포인트마다 형태가 조금씩 달라 본문은 각 파일에서 만든다.
export const FORBIDDEN_MSG = "이 사이트에서만 사용할 수 있습니다.";
