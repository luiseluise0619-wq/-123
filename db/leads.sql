-- 이메일(리드) 수집 테이블. api/lead.js 가 첫 요청 때 자동 생성하지만, 수동 실행용으로도 둠.
CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT, org TEXT, purpose TEXT,
  item TEXT, item_type TEXT, region TEXT, industry TEXT, format TEXT,
  agreed BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  referrer TEXT, user_agent TEXT, ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
