import { isIP } from 'node:net';
export function clientIp(req, trustedHops = Number(process.env.TRUST_PROXY_HOPS || 0)) {
  const direct = req.socket?.remoteAddress || 'unknown';
  if (!Number.isInteger(trustedHops) || trustedHops < 1 || trustedHops > 5) return direct;
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  // 프록시 수를 검증하고 Node 포트 직접 접근을 차단한 환경에서만 사용한다.
  const address = chain[chain.length - trustedHops];
  return isIP(address || '') ? address : direct;
}
export function createLimiter({ now = Date.now, maxKeys = 10000 } = {}) {
  const buckets = new Map();
  return (key, limit, windowMs) => {
    const time = now(); let bucket = buckets.get(key);
    if (!bucket || bucket.until <= time) {
      if (buckets.size >= maxKeys) for (const [k, v] of buckets) if (v.until <= time) buckets.delete(k);
      if (!buckets.has(key) && buckets.size >= maxKeys) return 60;
      bucket = { count: 0, until: time + windowMs }; buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.until-time)/1000));
    bucket.count++; return 0;
  };
}
export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // 실행 코드는 로컬 파일만 허용한다. 템플릿의 인라인 스타일만 허용한다.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'");
}
