// Vercel 서버리스 함수 — AI 상담 프록시(다중 제공자: Gemini·OpenAI·Anthropic).
// 프론트엔드에 API 키를 노출하지 않기 위해 서버에서 호출한다.
// 필요 환경변수(하나 이상): GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
// 프론트 호출: POST /api/chat  { message, context, model }
//   context = 현재 선택된 상권/업종의 실데이터 요약(있으면 근거로 사용)
//   model   = "provider:모델명"(선택, 없으면 자동)
import { complete, anyConfigured } from "./_ai.js";
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  // 최소 방어: 같은 사이트(브라우저)에서 온 요청만 허용 → 외부 스크립트의 토큰 남용 차단.
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: FORBIDDEN_MSG, reply: "요청 출처가 허용되지 않았습니다." });
  }
  if (!anyConfigured()) {
    return res.status(200).json({
      reply:
        "AI 상담을 쓰려면 AI 키가 필요합니다. Vercel → Settings → Environment Variables 에 " +
        "GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY 중 하나 이상을 추가하세요.",
      configured: false,
    });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const message = (body && body.message ? String(body.message) : "").slice(0, 2000);
  const context = (body && body.context ? String(body.context) : "").slice(0, 6000);
  const reqModel = body && body.model ? String(body.model).trim() : "";
  if (!message) return res.status(400).json({ error: "message required" });

  const system =
    "너는 한국 소상공인·예비창업자를 위한 상권 분석 상담사다. " +
    "어떤 질문이든 — 막연하거나 주제를 벗어나거나 엉뚱해도 — 절대 응답을 거부하지 말고, 늘 대화하듯 도움이 되게 답해라. " +
    "아래 '데이터'가 질문과 관련 있으면 그 수치를 근거로 답하고, 데이터에 없는 내용은 일반적인 창업·상권 상식으로 도와주되 '이건 데이터가 아니라 일반적인 조언'이라고 짧게 밝혀라. " +
    "다만 특정 자치구·업종의 구체적 수치(매출·객단가·폐업률 등)가 데이터에 없으면 지어내지 말고, '그 숫자는 데이터에 없다'고 한 뒤 어떻게 확인하면 되는지 알려줘라. " +
    "추정치는 추정이라고 밝혀라. 답은 한국어로, 짧고 실용적으로. 숫자에는 단위를 붙여라.\n\n" +
    "데이터:\n" + (context || "(현재 선택된 상권/업종 데이터 없음)");

  const r2 = await complete({ selected: reqModel, system, user: message, temperature: 0.4, maxTokens: 700 });
  if (r2.text) return res.status(200).json({ reply: r2.text, model: r2.model, provider: r2.provider, configured: true });
  return res.status(200).json({ reply: "AI 응답 오류: " + r2.error, configured: true, error: true });
}
