// 다중 AI 제공자 공용 모듈 — Gemini · OpenAI · Anthropic(Claude).
// 세 엔드포인트(insight/chat/models)가 공유한다. 키는 서버 환경변수로만 보관하고 노출하지 않는다.
//   GEMINI_API_KEY     (선택)  aistudio.google.com/apikey
//   OPENAI_API_KEY     (선택)  platform.openai.com/api-keys
//   ANTHROPIC_API_KEY  (선택)  console.anthropic.com
//   *_MODEL            (선택)  각 제공자 기본 모델 강제 지정(쉼표로 여러 개)
// 파일명이 '_' 로 시작해 Vercel 이 이 파일을 API 경로로 만들지 않는다(공용 유틸).

const PRIORITY = ["gemini", "openai", "anthropic"];
const LABEL = { gemini: "Google Gemini", openai: "OpenAI", anthropic: "Anthropic Claude" };

// 제공자별 키 맵(설정된 것만).
function keys() {
  const k = {};
  if (process.env.GEMINI_API_KEY) k.gemini = process.env.GEMINI_API_KEY;
  if (process.env.OPENAI_API_KEY) k.openai = process.env.OPENAI_API_KEY;
  if (process.env.ANTHROPIC_API_KEY) k.anthropic = process.env.ANTHROPIC_API_KEY;
  return k;
}
export function anyConfigured() { return Object.keys(keys()).length > 0; }

// 프론트 드롭다운 값("provider:model") 또는 순수 모델명 → {provider, model}
export function parseModel(sel) {
  const s = String(sel || "").trim();
  if (!s) return { provider: "", model: "" };
  const i = s.indexOf(":");
  if (i > 0) {
    const p = s.slice(0, i).toLowerCase();
    if (PRIORITY.includes(p)) return { provider: p, model: s.slice(i + 1).trim() };
  }
  if (/^(gpt|o\d|chatgpt)/i.test(s)) return { provider: "openai", model: s };
  if (/^claude/i.test(s)) return { provider: "anthropic", model: s };
  if (/^gemini|^models\//i.test(s)) return { provider: "gemini", model: s.replace(/^models\//, "") };
  return { provider: "", model: s };
}

// 제공자별 기본 후보 모델(빠르고 저렴한 것 우선). *_MODEL 환경변수가 있으면 최우선.
function defaults(prov) {
  const env = { gemini: "GEMINI_MODEL", openai: "OPENAI_MODEL", anthropic: "ANTHROPIC_MODEL" }[prov];
  const base = {
    gemini: ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"],
    anthropic: ["claude-haiku-4-5", "claude-3-5-haiku-latest", "claude-3-5-sonnet-latest"],
  }[prov] || [];
  const list = [];
  if (env && process.env[env]) String(process.env[env]).split(",").forEach((m) => list.push(m.trim()));
  base.forEach((m) => { if (!list.includes(m)) list.push(m); });
  return list.filter(Boolean);
}

// ── 제공자별 단일 호출(성공 시 텍스트, 실패 시 throw) ──
async function callGemini(key, model, system, user, temperature, maxTokens) {
  // Gemini 2.5/3.x 는 추론(thinking) 모델이라 maxOutputTokens 를 사고에 다 써
  // 답변 텍스트가 비어 나올 수 있다 → thinkingBudget:0 으로 사고를 끄고 짧게 답하게 한다.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const mk = (noThink) => ({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: noThink
      ? { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } }
      : { temperature, maxOutputTokens: maxTokens },
  });
  const send = async (body) => {
    const rr = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const dd = await rr.json().catch(() => ({}));
    return { rr, dd };
  };
  let { rr: r, dd: d } = await send(mk(true));
  // thinkingConfig 를 지원하지 않는 모델이면 그 필드 빼고 재시도
  if (!r.ok && /thinking|generationConfig|unknown|not supported|INVALID_ARGUMENT/i.test(d?.error?.message || "")) {
    ({ rr: r, dd: d } = await send(mk(false)));
  }
  if (!r.ok) throw new Error(d?.error?.message || String(r.status));
  const parts = d?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("");
}

async function callOpenAI(key, model, system, user, temperature, maxTokens) {
  const base = { model, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  // 모델마다 지원 파라미터가 달라(추론 모델은 temperature 고정·max_completion_tokens 필수) 변형을 순차 시도.
  const variants = [
    { ...base, max_completion_tokens: maxTokens, temperature },
    { ...base, max_completion_tokens: maxTokens },
    { ...base, max_tokens: maxTokens, temperature },
    { ...base, max_tokens: maxTokens },
  ];
  let lastErr = "";
  for (const b of variants) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(b),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d?.choices?.[0]?.message?.content || "";
    lastErr = d?.error?.message || String(r.status);
    if (!/temperature|max_tokens|max_completion_tokens|unsupported|parameter/i.test(lastErr)) break; // 키·모델 오류면 즉시 중단
  }
  throw new Error(lastErr);
}

async function callAnthropic(key, model, system, user, temperature, maxTokens) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, temperature, messages: [{ role: "user", content: user }] }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || String(r.status));
  return (d?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

function callOne(prov, key, model, system, user, temperature, maxTokens) {
  if (prov === "gemini") return callGemini(key, model, system, user, temperature, maxTokens);
  if (prov === "openai") return callOpenAI(key, model, system, user, temperature, maxTokens);
  if (prov === "anthropic") return callAnthropic(key, model, system, user, temperature, maxTokens);
  return Promise.reject(new Error("알 수 없는 제공자: " + prov));
}

// ── 제공자별 사용 가능한 모델 목록(자가치유·드롭다운용) ──
export async function listModels(prov, key) {
  if (prov === "gemini") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || String(r.status));
    return (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((n) => /gemini/i.test(n) && !/(embedding|aqa|image|audio|tts|vision)/i.test(n));
  }
  if (prov === "openai") {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || String(r.status));
    return (d.data || []).map((m) => String(m.id))
      .filter((n) => /^(gpt-|o\d|chatgpt)/i.test(n) && !/(embedding|whisper|tts|audio|image|dall|moderation|realtime|transcribe|search|instruct)/i.test(n))
      .sort();
  }
  if (prov === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || String(r.status));
    return (d.data || []).map((m) => String(m.id)).filter(Boolean);
  }
  return [];
}

// 목록에서 빠른/저렴 모델 하나 선택.
function pickDefault(prov, listed) {
  if (!listed || !listed.length) return null;
  if (prov === "gemini") {
    const f = listed.filter((n) => /flash/i.test(n) && !/(thinking|exp|live|preview)/i.test(n)).sort().reverse();
    return f[0] || listed.find((n) => /gemini/i.test(n)) || listed[0];
  }
  if (prov === "openai") {
    return listed.find((n) => /mini/i.test(n)) || listed.find((n) => /gpt-4o|gpt-4\.1/i.test(n)) || listed[0];
  }
  if (prov === "anthropic") {
    return listed.find((n) => /haiku/i.test(n)) || listed.find((n) => /sonnet/i.test(n)) || listed[0];
  }
  return listed[0];
}

// 설정된 제공자들의 모델을 그룹으로 반환(models.js 용).
export async function allModelGroups() {
  const k = keys();
  const groups = [];
  for (const prov of PRIORITY) {
    if (!k[prov]) continue;
    try {
      const models = await listModels(prov, k[prov]);
      if (models.length) groups.push({ provider: prov, label: LABEL[prov], models });
    } catch (e) {
      groups.push({ provider: prov, label: LABEL[prov], models: [], error: String(e.message || e) });
    }
  }
  return groups;
}

// 통합 호출: 선택 모델(있으면 최우선) → 그 제공자 기본군 → 나머지 제공자 기본군 → 실시간 탐색.
// 반환: { text, model, provider, error }
export async function complete({ selected, system, user, temperature = 0.4, maxTokens = 700 }) {
  const k = keys();
  if (!Object.keys(k).length) return { text: "", model: "", provider: "", error: "설정된 AI 키가 없습니다(GEMINI/OPENAI/ANTHROPIC)." };

  const sel = parseModel(selected);
  const cand = [];
  const add = (provider, model) => { if (k[provider] && model) cand.push({ provider, model }); };
  if (sel.provider) add(sel.provider, sel.model);
  if (sel.provider) defaults(sel.provider).forEach((m) => add(sel.provider, m));
  PRIORITY.forEach((p) => defaults(p).forEach((m) => add(p, m)));

  const seen = new Set();
  const list = cand.filter((c) => { const key = c.provider + ":" + c.model; if (seen.has(key)) return false; seen.add(key); return true; });

  let err = "";
  for (const c of list) {
    try {
      const t = await callOne(c.provider, k[c.provider], c.model, system, user, temperature, maxTokens);
      if (t) return { text: t, model: c.model, provider: c.provider };
      err = `${c.provider}/${c.model}: 빈 응답`;
    } catch (e) {
      err = `${c.provider}/${c.model}: ${String(e.message || e)}`;
      // 인증 오류면 그 제공자 나머지 후보도 무의미 → 다음 제공자로(계속 진행).
    }
  }
  // 마지막 수단: 우선 제공자의 실시간 모델 탐색.
  const dprov = (sel.provider && k[sel.provider]) ? sel.provider : PRIORITY.find((p) => k[p]);
  if (dprov) {
    try {
      const listed = await listModels(dprov, k[dprov]);
      const m = pickDefault(dprov, listed);
      if (m) { const t = await callOne(dprov, k[dprov], m, system, user, temperature, maxTokens); if (t) return { text: t, model: m, provider: dprov }; }
    } catch (e) { err += ` | 탐색 실패(${dprov}): ${String(e.message || e)}`; }
  }
  return { text: "", model: "", provider: "", error: err || "모든 모델 호출 실패" };
}
