// Vercel 서버리스 — 설정된 AI 제공자(Gemini·OpenAI·Anthropic)별로 쓸 수 있는 모델 목록 반환.
// 프론트 모델 선택 드롭다운 채우기용. 키는 노출하지 않음.
// 반환: { ok, configured, groups:[{provider,label,models:[...]}], models:["provider:model", ...] }
import { allModelGroups, anyConfigured } from "./_ai.js";
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";

export default async function handler(req, res) {
  if (!isAllowedOrigin(req, { allowMissing: true })) return res.status(403).json({ ok: false, groups: [], models: [], error: FORBIDDEN_MSG });

  if (!anyConfigured()) {
    return res.status(200).json({ ok: false, configured: false, groups: [], models: [], error: "AI 키 미설정(GEMINI/OPENAI/ANTHROPIC)" });
  }
  try {
    const groups = await allModelGroups();
    // 하위호환: "provider:model" 평면 목록도 함께 제공.
    const flat = [];
    groups.forEach((g) => (g.models || []).forEach((m) => flat.push(`${g.provider}:${m}`)));
    return res.status(200).json({ ok: true, configured: true, groups, models: flat });
  } catch (e) {
    return res.status(200).json({ ok: false, configured: true, groups: [], models: [], error: String(e) });
  }
}
