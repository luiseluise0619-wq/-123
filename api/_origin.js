// Origin 검사는 인증이나 봇 차단 수단이 아니다.
function normalized(value) {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.origin : ''; }
  catch { return ''; }
}
export function isAllowedOrigin(req, { allowMissing = false } = {}) {
  const headers = req?.headers || {};
  const allowed = String(process.env.ALLOWED_ORIGIN || '').split(',').map(s => normalized(s.trim())).filter(Boolean);
  const origin = normalized(headers.origin);
  if (!headers.origin) return allowMissing && headers['sec-fetch-site'] !== 'cross-site';
  if (!origin) return false;
  if (allowed.length) return allowed.includes(origin);
  if (process.env.NODE_ENV === 'production') return false;
  const u = new URL(origin);
  return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && u.host === headers.host;
}
export const FORBIDDEN_MSG = '허용되지 않은 요청 출처입니다.';
