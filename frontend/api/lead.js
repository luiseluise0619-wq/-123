// Vercel/Node 서버리스 — 자료 다운로드 시 이메일(리드) 수집 → PostgreSQL(leads 테이블)에 저장.
// 개인정보(이메일)를 다루므로: 동의(agreed) 없으면 저장 안 함, IP는 원문 대신 해시로만 보관.
// 필요 환경변수:
//   DATABASE_URL  (필수)  Postgres 연결 문자열 (Neon/카페24). 예: postgres://user:pw@host/db?sslmode=require
//   LEAD_SALT     (선택)  IP 해시용 솔트(아무 문자열). 없으면 기본값.
//   ALLOWED_ORIGIN(선택)  지정 시 그 도메인만 허용.
// 프론트 호출: POST /api/lead  { email, agreed, item, region, industry, format, name?, org?, purpose?, marketing_opt_in? }
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const DB_URL = process.env.DATABASE_URL || "";
// Neon 등 클라우드 Postgres 는 SSL 필요. 로컬/sslmode=disable 이면 끔.
const ssl = !DB_URL || /sslmode=disable|localhost|127\.0\.0\.1/.test(DB_URL) ? false : { rejectUnauthorized: false };
// Pool 은 모듈 캐시로 재사용(요청마다 새로 안 만듦).
const pool = DB_URL ? new Pool({ connectionString: DB_URL, ssl, max: 3 }) : null;

let ready = false; // 테이블 자동 생성 1회
async function ensureTable() {
  if (ready) return;
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
  ready = true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cut = (v, n) => (v == null ? null : String(v).slice(0, n)); // 길이 제한

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // 최소 방어: 같은 사이트에서 온 요청만 허용(외부 스크립트 남용 차단)
  const origin = req.headers.origin || "", host = req.headers.host || "";
  const allow = process.env.ALLOWED_ORIGIN;
  const sameSite = origin && (origin.endsWith(host) || (host && origin.includes(host.split(":")[0])));
  const okOrigin = allow ? origin === allow : (sameSite || origin.endsWith(".vercel.app") || origin.endsWith(".onrender.com"));
  if (!okOrigin) return res.status(403).json({ error: "이 사이트에서만 사용할 수 있습니다." });

  if (!pool) return res.status(200).json({ ok: false, configured: false, error: "DATABASE_URL 미설정 — Neon/카페24 Postgres 연결 문자열을 환경변수에 추가하세요." });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }

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
    return res.status(200).json({ ok: false, error: "저장 실패: " + String(e && e.message || e) });
  }
}
