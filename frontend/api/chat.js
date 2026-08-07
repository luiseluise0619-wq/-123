// Vercel 서버리스 함수 — Gemini AI 상담 프록시.
// 프론트엔드에 API 키를 노출하지 않기 위해 서버에서 호출한다.
// 필요 환경변수(Vercel → Settings → Environment Variables):
//   GEMINI_API_KEY   (필수)  aistudio.google.com/apikey 에서 발급
//   GEMINI_MODEL     (선택)  기본 gemini-2.0-flash
//
// 프론트 호출: POST /api/chat  { message, context }
//   context = 현재 선택된 상권/업종의 실데이터 요약(있으면 근거로 사용)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(200).json({
      reply:
        "AI 상담을 쓰려면 Gemini API 키가 필요합니다. Vercel → Settings → Environment Variables 에 " +
        "GEMINI_API_KEY 를 추가하세요 (aistudio.google.com/apikey 에서 무료 발급).",
      configured: false,
    });
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const message = (body && body.message ? String(body.message) : "").slice(0, 2000);
  const context = (body && body.context ? String(body.context) : "").slice(0, 6000);
  if (!message) return res.status(400).json({ error: "message required" });

  const system =
    "너는 한국 소상공인·자영업자를 위한 상권 분석 상담사다. " +
    "아래 '데이터'에 있는 실제 공공통계 수치에만 근거해 답하고, 없는 수치는 지어내지 말고 '데이터에 없음'이라고 말해라. " +
    "추정치는 추정이라고 밝혀라. 답은 한국어로, 짧고 실용적으로. 숫자에는 단위를 붙여라.\n\n" +
    "데이터:\n" + (context || "(현재 선택된 상권/업종 데이터 없음)");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(200).json({
        reply: "AI 응답 오류: " + (data?.error?.message || r.status),
        configured: true, error: true,
      });
    }
    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "응답을 생성하지 못했습니다.";
    return res.status(200).json({ reply, configured: true });
  } catch (e) {
    return res.status(200).json({ reply: "AI 호출 실패: " + String(e), configured: true, error: true });
  }
}
