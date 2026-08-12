// Vercel 서버리스 — 이 키로 쓸 수 있는 Gemini 모델 목록(generateContent 지원)만 반환.
// 프론트의 모델 선택 드롭다운 채우기용. 키는 노출하지 않음.
export default async function handler(req, res) {
  const origin = req.headers.origin || "", host = req.headers.host || "";
  const allow = process.env.ALLOWED_ORIGIN;
  const sameSite = origin && (origin.endsWith(host) || (host && origin.includes(host.split(":")[0])));
  const okOrigin = allow ? origin === allow : (sameSite || origin.endsWith(".vercel.app") || !origin);
  if (!okOrigin) return res.status(403).json({ ok: false, models: [], error: "이 사이트에서만 사용할 수 있습니다." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(200).json({ ok: false, configured: false, models: [], error: "GEMINI_API_KEY 미설정" });
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`);
    const d = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, configured: true, models: [], error: (d && d.error && d.error.message) || String(r.status) });
    const models = (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((n) => /gemini/i.test(n) && !/(embedding|aqa|image|audio|tts)/i.test(n));
    // flash 우선, 그다음 이름순
    models.sort((a, b) => (/flash/i.test(b) - /flash/i.test(a)) || a.localeCompare(b));
    return res.status(200).json({ ok: true, configured: true, models });
  } catch (e) {
    return res.status(200).json({ ok: false, configured: true, models: [], error: String(e) });
  }
}
