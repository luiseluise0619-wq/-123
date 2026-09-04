// 다중 AI 제공자 공용 모듈 — Gemini · OpenAI · Anthropic(Claude).
// 세 엔드포인트(insight/chat/models)가 공유한다. 키는 서버 환경변수로만 보관하고 노출하지 않는다.
//   GEMINI_API_KEY     (선택)  aistudio.google.com/apikey
//   OPENAI_API_KEY     (선택)  platform.openai.com/api-keys
//   ANTHROPIC_API_KEY  (선택)  console.anthropic.com
//   *_MODEL            (선택)  각 제공자 기본 모델 강제 지정(쉼표로 여러 개)
// 파일명이 '_' 로 시작해 Vercel 이 이 파일을 API 경로로 만들지 않는다(공용 유틸).
import { redact } from "./_err.js";

// 상류 API 가 응답을 주지 않으면 요청이 무한정 매달려 커넥션을 점유한다.
// 모든 외부 호출에 상한 시간을 둔다(Node 18+ / 브라우저 공통).
const UPSTREAM_TIMEOUT_MS = 20000;

// '한 번의 호출' 상한만으로는 부족하다.
// complete() 는 후보 모델을 9개 넘게 순차 시도하므로 최악이 20초 × 9 = 3분이다.
// 서버리스 함수 자체의 제한 시간을 먼저 넘겨 버리면 우리가 준비한 정직한 오류 문구 대신
// 플랫폼의 504 가 그대로 사용자에게 간다. 그래서 '전체 예산'을 따로 둔다.
//
// 기본값은 넉넉하게 잡는다 — 한 번의 상류 호출(20초)이 온전히 끝날 시간은 남겨야
// 지금 성공하던 요청이 새로 실패하지 않는다. 줄이려면 AI_BUDGET_MS 로 조정한다.
const TOTAL_BUDGET_MS = Math.max(5000, Number(process.env.AI_BUDGET_MS) || 25000);

// 남은 예산보다 긴 타임아웃은 의미가 없다(어차피 예산이 먼저 끝난다).
// 남은 시간에 맞춰 잘라 두면 마지막 호출도 '우리 손으로' 끝나 오류 문구를 돌려줄 수 있다.
//
// deadline 은 '언제까지'(Date.now() 기준 절대시각)를 인자로 넘겨받는다.
// 모듈 전역 변수로 두면 같은 인스턴스에서 요청 두 개가 겹칠 때 서로의 마감을 덮어쓴다.
const msLeft = (deadline) => (deadline ? deadline - Date.now() : UPSTREAM_TIMEOUT_MS);
const fx = (url, opts, deadline) =>
  fetch(url, { ...(opts || {}), signal: AbortSignal.timeout(Math.max(1000, Math.min(UPSTREAM_TIMEOUT_MS, msLeft(deadline)))) });

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
async function callGemini(key, model, system, user, temperature, maxTokens, deadline) {
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
    const rr = await fx(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, deadline);
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

async function callOpenAI(key, model, system, user, temperature, maxTokens, deadline) {
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
    const r = await fx("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(b),
    }, deadline);
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d?.choices?.[0]?.message?.content || "";
    lastErr = d?.error?.message || String(r.status);
    if (!/temperature|max_tokens|max_completion_tokens|unsupported|parameter/i.test(lastErr)) break; // 키·모델 오류면 즉시 중단
  }
  throw new Error(lastErr);
}

async function callAnthropic(key, model, system, user, temperature, maxTokens, deadline) {
  const r = await fx("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, temperature, messages: [{ role: "user", content: user }] }),
  }, deadline);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || String(r.status));
  return (d?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

function callOne(prov, key, model, system, user, temperature, maxTokens, deadline) {
  if (prov === "gemini") return callGemini(key, model, system, user, temperature, maxTokens, deadline);
  if (prov === "openai") return callOpenAI(key, model, system, user, temperature, maxTokens, deadline);
  if (prov === "anthropic") return callAnthropic(key, model, system, user, temperature, maxTokens, deadline);
  return Promise.reject(new Error("알 수 없는 제공자: " + prov));
}

// ── 제공자별 사용 가능한 모델 목록(자가치유·드롭다운용) ──
export async function listModels(prov, key, deadline) {
  if (prov === "gemini") {
    const r = await fx(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`, null, deadline);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || String(r.status));
    return (d.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name || "").replace(/^models\//, ""))
      .filter((n) => /gemini/i.test(n) && !/(embedding|aqa|image|audio|tts|vision)/i.test(n));
  }
  if (prov === "openai") {
    const r = await fx("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } }, deadline);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error?.message || String(r.status));
    return (d.data || []).map((m) => String(m.id))
      .filter((n) => /^(gpt-|o\d|chatgpt)/i.test(n) && !/(embedding|whisper|tts|audio|image|dall|moderation|realtime|transcribe|search|instruct)/i.test(n))
      .sort();
  }
  if (prov === "anthropic") {
    const r = await fx("https://api.anthropic.com/v1/models?limit=1000", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }, deadline);
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
// 제공자끼리는 서로를 기다릴 이유가 없다. 순차로 돌리면 셋 다 느릴 때 20초 × 3 이 되고,
// 그 사이 서버리스 함수 제한 시간을 넘겨 목록이 통째로 안 나온다. 동시에 부른다.
// (순서는 PRIORITY 로 다시 맞춘다 — 드롭다운에 뜨는 순서가 바뀌면 안 된다.)
export async function allModelGroups() {
  const k = keys();
  const provs = PRIORITY.filter((p) => k[p]);
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const settled = await Promise.all(provs.map(async (prov) => {
    try {
      const models = await listModels(prov, k[prov], deadline);
      return models.length ? { provider: prov, label: LABEL[prov], models } : null;
    } catch (e) {
      // 오류 원문에 요청 URL(= key 쿼리스트링)이 섞여 나올 수 있다 → 서버 로그에만 자세히 남긴다.
      console.error(`[models/${prov}]`, redact(String((e && e.stack) || (e && e.message) || e)));
      return { provider: prov, label: LABEL[prov], models: [], error: "목록을 불러오지 못했습니다." };
    }
  }));
  return settled.filter(Boolean);
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

  // 후보를 다 돌면 20초 × 9 = 3분이다. 전체 예산을 두고 시간이 남았을 때만 다음 후보로 간다.
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  // 남은 시간이 너무 적으면 새 호출을 시작해 봐야 도중에 끊긴다. 시작조차 하지 않는다.
  const canTry = () => msLeft(deadline) > 1500;

  let err = "";
  // 키가 잘못된 제공자는 남은 후보 모델을 아무리 더 시도해도 똑같이 실패한다.
  // 한 번 인증 오류가 나면 그 제공자를 통째로 건너뛴다(불필요한 유료 호출·지연 제거).
  const deadProviders = new Set();
  const isAuthError = (m) => /401|403|api key|unauthorized|invalid[_ ]?api|permission|forbidden/i.test(m);
  for (const c of list) {
    if (deadProviders.has(c.provider)) continue;
    if (!canTry()) { err = err || "시간 초과"; break; }
    try {
      const t = await callOne(c.provider, k[c.provider], c.model, system, user, temperature, maxTokens, deadline);
      if (t) return { text: t, model: c.model, provider: c.provider };
      err = `${c.provider}/${c.model}: 빈 응답`;
    } catch (e) {
      const msg = String(e && e.message || e);
      // 상류 오류 원문에는 요청 URL·키 조각이 섞일 수 있다. 자세한 것은 로그에만.
      console.error(`[ai/${c.provider}/${c.model}]`, redact((e && e.stack) || msg));
      err = `${c.provider}/${c.model}: ${redact(msg)}`;
      if (isAuthError(msg)) deadProviders.add(c.provider);
    }
  }
  // 마지막 수단: 우선 제공자의 실시간 모델 탐색.
  const alive = (p) => k[p] && !deadProviders.has(p);
  const dprov = (sel.provider && alive(sel.provider)) ? sel.provider : PRIORITY.find(alive);
  if (dprov && canTry()) {
    try {
      const listed = await listModels(dprov, k[dprov], deadline);
      const m = pickDefault(dprov, listed);
      if (m && canTry()) { const t = await callOne(dprov, k[dprov], m, system, user, temperature, maxTokens, deadline); if (t) return { text: t, model: m, provider: dprov }; }
    } catch (e) {
      console.error(`[ai/discover/${dprov}]`, redact((e && e.stack) || String(e && e.message || e)));
      err += ` | 탐색 실패(${dprov}): ${redact(String(e.message || e))}`;
    }
  }
  return { text: "", model: "", provider: "", error: err || "모든 모델 호출 실패" };
}
