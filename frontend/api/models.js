// Vercel 서버리스 — 설정된 AI 제공자(Gemini·OpenAI·Anthropic)별로 쓸 수 있는 모델 목록 반환.
// 프론트 모델 선택 드롭다운 채우기용. 키는 노출하지 않음.
// 반환: { ok, configured, groups:[{provider,label,models:[...]}], models:["provider:model", ...] }
import { allModelGroups, anyConfigured } from "./_ai.js";
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";
import { safeError } from "./_err.js";

// 모델 목록은 자주 바뀌지 않는데(제공자가 새 모델을 내놓을 때뿐) 지금은 페이지를 열 때마다
// 상류 API 를 세 번 부른다. 인스턴스가 살아 있는 동안 짧게 재사용한다.
// 실패한 결과는 캐시하지 않는다 — 일시적 장애가 10분 동안 굳어 버리면 안 된다.
const CACHE_MS = 10 * 60 * 1000;
let cache = null; // { at, groups }

async function cachedGroups() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.groups;
  const groups = await allModelGroups();
  // 한 곳이라도 모델을 실제로 받아왔을 때만 캐시한다.
  if (groups.some((g) => (g.models || []).length)) cache = { at: Date.now(), groups };
  return groups;
}

export default async function handler(req, res) {
  if (!isAllowedOrigin(req, { allowMissing: true })) return res.status(403).json({ ok: false, groups: [], models: [], error: FORBIDDEN_MSG });

  if (!anyConfigured()) {
    return res.status(200).json({ ok: false, configured: false, groups: [], models: [], error: "AI 키 미설정(GEMINI/OPENAI/ANTHROPIC)" });
  }
  try {
    const groups = await cachedGroups();
    // 하위호환: "provider:model" 평면 목록도 함께 제공.
    const flat = [];
    groups.forEach((g) => (g.models || []).forEach((m) => flat.push(`${g.provider}:${m}`)));
    return res.status(200).json({ ok: true, configured: true, groups, models: flat });
  } catch (e) {
    return res.status(200).json({ ok: false, configured: true, groups: [], models: [], error: safeError("models", e, "모델 목록을 불러오지 못했습니다") });
  }
}
