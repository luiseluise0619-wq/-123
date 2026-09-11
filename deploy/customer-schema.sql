-- Apply explicitly with a schema-owner account. The web process never runs migrations.
CREATE TABLE IF NOT EXISTS customer_submissions (
  id uuid PRIMARY KEY,
  payload text NOT NULL,
  privacy_version varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS customer_submissions_created ON customer_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS customer_submissions_expiry ON customer_submissions(expires_at);
CREATE TABLE IF NOT EXISTS customer_clicks (
  day date NOT NULL, event varchar(50) NOT NULL, device varchar(10) NOT NULL,
  count bigint NOT NULL CHECK(count>0), PRIMARY KEY(day,event,device)
);
CREATE TABLE IF NOT EXISTS customer_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action varchar(40) NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
