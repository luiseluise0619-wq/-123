// Vercel 서버리스 함수 — AI 데이터 인사이트 생성(다중 제공자: Gemini·OpenAI·Anthropic).
// 핀 분석의 실제 수치를 받아, 일반 사용자가 10초 안에 이해할 문장으로 요약한다.
// 규칙(쉬운 말·결론부터·숫자·데이터/추측 구분·AI투 금지·정해진 출력형식)은 아래 SYSTEM 에 고정.
// 필요 환경변수(하나 이상): GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY
// 호출: POST /api/insight  { context, model }   model = "provider:모델명"(선택, 없으면 자동)
import { complete, anyConfigured } from "./_ai.js";

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
  "9. 사람이 직접 메모하듯 자연스러운 존댓말로. 기계적 나열·과한 접속사·같은 말 반복을 피하고, 각 항목은 구체적 숫자로 시작한다. 형식 라벨(한줄 요약 등) 외에 군더더기 수식어를 넣지 않는다.",
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

  if (!anyConfigured()) {
    return res.status(200).json({
      insight: "", configured: false,
      error: "AI 인사이트는 AI 키가 필요합니다. Vercel → Settings → Environment Variables 에 GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY 중 하나 이상을 추가하세요.",
    });
  }
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const context = (body && body.context ? String(body.context) : "").slice(0, 6000);
  if (!context) return res.status(400).json({ error: "context required" });
  const reqModel = body && body.model ? String(body.model).trim() : "";   // 사용자가 고른 "provider:모델"(있으면 최우선)

  const r2 = await complete({
    selected: reqModel,
    system: SYSTEM,
    user: "다음은 지도에서 클릭한 지점의 데이터다. 규칙대로 요약해라.\n\n" + context,
    temperature: 0.3, maxTokens: 700,
  });
  if (r2.text) return res.status(200).json({ insight: r2.text, model: r2.model, provider: r2.provider, configured: true });
  return res.status(200).json({ insight: "", configured: true, error: "AI 오류 — " + r2.error });
}
