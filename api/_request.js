/** Node의 JSON 문자열과 Vercel의 파싱된 본문을 같은 객체로 정규화한다. */
export function parseBody(body) {
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return {}; }
  }
  return body && typeof body === "object" ? body : {};
}

/** 응답 형식은 기존 API 계약(405, POST only)을 유지한다. */
export function requirePost(req, res) {
  if (req.method === "POST") return true;
  res.status(405).json({ error: "POST only" });
  return false;
}
