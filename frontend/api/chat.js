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
  // 최소 방어: 같은 사이트(브라우저)에서 온 요청만 허용 → 외부 스크립트의 토큰 남용 차단.
  // ALLOWED_ORIGIN 환경변수를 지정하면 그 도메인만, 없으면 자기 배포 도메인(*.vercel.app 등)만 허용.
  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const allow = process.env.ALLOWED_ORIGIN;
  const sameSite = origin && (origin.endsWith(host) || (host && origin.includes(host.split(":")[0])));
  const okOrigin = allow ? origin === allow : (sameSite || origin.endsWith(".vercel.app"));
  if (!okOrigin) {
    return res.status(403).json({ error: "이 사이트에서만 사용할 수 있습니다.", reply: "요청 출처가 허용되지 않았습니다." });
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

  const payload = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  };
  const r2 = await callGemini(key, MODELS(), payload);
  if (r2.text) return res.status(200).json({ reply: r2.text, model: r2.model, configured: true });
  return res.status(200).json({ reply: "AI 응답 오류(모든 모델 실패): " + r2.error, configured: true, error: true });
}

// GEMINI_MODEL(있으면 우선) + 기본 후보군을 순서대로 시도(중복 제거).
function MODELS() {
  const list = [];
  if (process.env.GEMINI_MODEL) String(process.env.GEMINI_MODEL).split(",").forEach((m) => list.push(m.trim()));
  ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"].forEach((m) => { if (!list.includes(m)) list.push(m); });
  return list.filter(Boolean);
}
// 후보 모델을 차례로 호출 → 처음으로 성공한 결과 반환. 실패 사유는 누적.
async function callGemini(key, models, payload) {
  let err = "";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (r.ok) {
        const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        if (text) return { text, model };
        err = `${model}: 빈 응답`;
      } else {
        err = `${model}: ${data?.error?.message || r.status}`;
      }
    } catch (e) { err = `${model}: ${String(e)}`; }
  }
  return { text: "", model: "", error: err };
}
