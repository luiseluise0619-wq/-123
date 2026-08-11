// Vercel 서버리스 함수 — AI 데이터 인사이트 생성(Gemini).
// 핀 분석의 실제 수치를 받아, 일반 사용자가 10초 안에 이해할 문장으로 요약한다.
// 규칙(쉬운 말·결론부터·숫자·데이터/추측 구분·AI투 금지·정해진 출력형식)은 아래 SYSTEM 에 고정.
// 필요 환경변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택, 기본 gemini-2.0-flash)
// 호출: POST /api/insight  { context }   context = 핀 지점의 데이터 요약 텍스트

const SYSTEM = [
  "너는 데이터 분석 결과를 일반 사용자가 빠르게 이해하도록 설명하는 데이터 분석가다.",
  "사람이 데이터를 직접 보고 핵심을 정리해준 것처럼 자연스럽고 명확하게 쓴다.",
  "",
  "작성 규칙:",
  "1. 쉬운 단어만. 전문·통계 용어 금지. 꼭 필요하면 바로 뒤에 쉬운 말로 풀어준다.",
  "2. 결론부터. 가장 중요한 내용 → 근거 → 의미 순서.",
  "3. 짧게. 한 문장은 짧게. 한 문단 2~3문장. 전체 3~5개 핵심만.",
  "4. 숫자를 적극 사용(증가율·차이·최고/최저·순위·비중). 단, 주어진 데이터에 없는 숫자는 절대 만들지 않는다.",
  "5. 데이터로 확인되는 건 단정적으로. 원인·가능성은 '추정됩니다/가능성이 있습니다'로. 원인을 함부로 확정하지 않는다.",
  "6. 다음 AI투 표현 금지: 종합적으로 분석해보면 / 주목할 만한 점은 / 시사하는 바가 큽니다 / 유의미한 결과 / 다각도로 살펴보면 / 데이터 기반으로 확인 / 인사이트를 도출 / 긍정적인 시사점 / ~라고 볼 수 있습니다 / ~을 고려할 필요가 있습니다.",
  "7. 데이터에 없거나 '준비 중/데이터 없음'인 항목은 억지로 말하지 말고, 필요하면 '해당 데이터는 아직 없음'이라고만 짧게 적는다.",
  "8. 기준시점이 다른 값(유동인구 날짜·매출 분기 등)을 같은 시점으로 합치지 않는다.",
  "",
  "반드시 아래 형식 그대로 출력:",
  "한줄 요약",
  "[가장 중요한 결과 한 문장]",
  "",
  "주요 내용",
  "① [핵심]",
  "[숫자·근거 포함 쉬운 설명]",
  "② [핵심]",
  "[설명]",
  "③ [핵심]",
  "[설명]",
  "",
  "한줄 제안",
  "→ [데이터가 보여주는 방향 한 문장. 데이터로 판단 못 하는 건 단정하지 않는다.]",
].join("\n");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const origin = req.headers.origin || "";
  const host = req.headers.host || "";
  const allow = process.env.ALLOWED_ORIGIN;
  const sameSite = origin && (origin.endsWith(host) || (host && origin.includes(host.split(":")[0])));
  const okOrigin = allow ? origin === allow : (sameSite || origin.endsWith(".vercel.app") || !origin);
  if (!okOrigin) return res.status(403).json({ error: "이 사이트에서만 사용할 수 있습니다." });

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(200).json({
      insight: "", configured: false,
      error: "AI 인사이트는 GEMINI_API_KEY 가 필요합니다. Vercel → Settings → Environment Variables 에 추가하세요.",
    });
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const context = (body && body.context ? String(body.context) : "").slice(0, 6000);
  if (!context) return res.status(400).json({ error: "context required" });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: "다음은 지도에서 클릭한 지점의 데이터다. 규칙대로 요약해라.\n\n" + context }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 700 },
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(200).json({ insight: "", configured: true, error: "AI 오류: " + (data?.error?.message || r.status) });
    const insight = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "요약을 생성하지 못했습니다.";
    return res.status(200).json({ insight, configured: true });
  } catch (e) {
    return res.status(200).json({ insight: "", configured: true, error: "AI 호출 실패: " + String(e) });
  }
}
