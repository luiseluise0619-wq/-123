// Vercel/Node 서버리스 — 자료 다운로드 시 이메일(리드) 수집 → PostgreSQL(leads 테이블)에 저장.
// 개인정보(이메일)를 다루므로: 동의(agreed) 없으면 저장 안 함, IP는 원문 대신 해시로만 보관.
// 필요 환경변수:
//   DATABASE_URL  (필수)  Postgres 연결 문자열 (Neon/카페24). 예: postgres://user:pw@host/db?sslmode=require
//   LEAD_SALT     (선택)  IP 해시용 솔트(아무 문자열). 없으면 기본값.
//   ALLOWED_ORIGIN(선택)  지정 시 그 도메인만 허용.
// 프론트 호출: POST /api/lead  { email, agreed, item, region, industry, format, name?, org?, purpose?, marketing_opt_in? }
import pg from "pg";
import crypto from "node:crypto";
import { isAllowedOrigin, FORBIDDEN_MSG } from "./_origin.js";
import { safeError } from "./_err.js";

const { Pool } = pg;
const DB_URL = process.env.DATABASE_URL || "";
// Neon 등 클라우드 Postgres 는 SSL 필요. 로컬/sslmode=disable 이면 끔.
const ssl = !DB_URL || /sslmode=disable|localhost|127\.0\.0\.1/.test(DB_URL) ? false : { rejectUnauthorized: false };
// Pool 은 모듈 캐시로 재사용(요청마다 새로 안 만듦).
const pool = DB_URL ? new Pool({ connectionString: DB_URL, ssl, max: 3 }) : null;
// 유휴 커넥션이 끊기면(네트워크·DB 재시작) pg 가 pool 에 'error' 를 낸다.
// 리스너가 없으면 uncaught exception 이 되어 서버 프로세스가 통째로 죽는다. 반드시 흡수한다.
if (pool) pool.on("error", (e) => { console.error("[lead] pg pool error:", e && e.message); });

// IP 해시 솔트. 기본값("salt")은 공개된 값이라 해시를 되짚을 수 있다(IP 후보가 43억 개뿐이라
// 솔트를 알면 전수 대입이 가능하다 → 사실상 IP 원문 보관과 같아진다).
// 값을 여기서 바꾸면 이미 저장된 해시와 서로 달라져 같은 사람을 못 알아보므로 기본값은 그대로 두고,
// 미설정이라는 사실만 서버 로그에 남긴다(운영자가 채우면 그때부터 안전해진다).
if (!process.env.LEAD_SALT) {
  console.warn("[lead] LEAD_SALT 미설정 — 기본 솔트 사용 중. Vercel 환경변수에 임의 문자열을 넣어 주세요.");
}

// 테이블 자동 생성 1회.
// 불리언 플래그는 동시 요청에서 새기 쉽다(둘 다 false 를 보고 둘 다 DDL 을 던진다).
// '진행 중인 약속' 자체를 캐시하면 뒤에 온 요청은 그 약속을 기다린다.
// 실패하면 캐시를 비워, 다음 요청이 다시 시도할 수 있게 한다.
let ready = null;
function ensureTable() {
  if (!ready) ready = createTable().catch((e) => { ready = null; throw e; });
  return ready;
}
async function createTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT, org TEXT, purpose TEXT,
    item TEXT, item_type TEXT, region TEXT, industry TEXT, format TEXT,
    agreed BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    referrer TEXT, user_agent TEXT, ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at)`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cut = (v, n) => (v == null ? null : String(v).slice(0, n)); // 길이 제한

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // 최소 방어: 같은 사이트에서 온 요청만 허용(외부 스크립트 남용 차단)
  if (!isAllowedOrigin(req)) return res.status(403).json({ error: FORBIDDEN_MSG });

  if (!pool) return res.status(200).json({ ok: false, configured: false, error: "DATABASE_URL 미설정 — Neon/카페24 Postgres 연결 문자열을 환경변수에 추가하세요." });

  // body 가 없을 수 있다(Content-Type 누락, 빈 POST). 그대로 두면 b.email 에서 터진다.
  // building.js·kakao.js 와 같은 방어를 여기에도 둔다.
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (!b || typeof b !== "object") b = {};

  const email = String(b.email || "").trim().slice(0, 200);
  const agreed = b.agreed === true || b.agreed === "true";
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "이메일 형식이 올바르지 않습니다." });
  if (!agreed) return res.status(400).json({ ok: false, error: "개인정보 수집·이용 동의가 필요합니다." });

  // IP 는 원문 저장하지 않고 해시로만(개인정보 최소화)
  const ipRaw = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ipHash = ipRaw ? crypto.createHash("sha256").update((process.env.LEAD_SALT || "salt") + ipRaw).digest("hex").slice(0, 32) : null;

  try {
    await ensureTable();
    const q = `INSERT INTO leads
      (email,name,org,purpose,item,item_type,region,industry,format,agreed,marketing_opt_in,referrer,user_agent,ip_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`;
    const vals = [
      email, cut(b.name, 100), cut(b.org, 120), cut(b.purpose, 60),
      cut(b.item, 200), cut(b.item_type, 60), cut(b.region, 60), cut(b.industry, 60), cut(b.format, 20),
      agreed, b.marketing_opt_in === true,
      cut(b.referrer, 300), cut(req.headers["user-agent"], 300), ipHash,
    ];
    const r = await pool.query(q, vals);
    return res.status(200).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    // 내부 오류 원문(DB 호스트명·테이블/컬럼 이름)은 화면에 그대로 뜬다 → 로그로만 보낸다.
    return res.status(200).json({ ok: false, error: safeError("lead", e, "저장 실패") });
  }
}
