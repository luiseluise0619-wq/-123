import http from 'node:http';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { vercelRes, readBody } from './response.js';
import { serveStatic } from './static.js';
import { clientIp, createLimiter, securityHeaders } from './security.js';
import { isAllowedOrigin } from '../api/_origin.js';
import { redact } from '../api/_err.js';

const PUBLIC_APIS = new Set(['report','config']);
export function createServer(root) {
  const limit = createLimiter(); let inFlight = 0;
  const server = http.createServer(async (req, res) => {
    securityHeaders(res);
    const json = (status, body) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(body)); };
    try {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch { return json(404, {error:'Not found'}); }
      if (/[\\\x00-\x1f\x7f%]/.test(pathname) || pathname.split('/').some(p => p === '..' || p.startsWith('.'))) return json(404,{error:'Not found'});
      if (pathname === '/healthz') return json(200,{ok:true});
      if (pathname.toLowerCase().startsWith('/api/')) {
        const name = pathname.slice(5);
        if (!PUBLIC_APIS.has(name)) return json(404,{error:'Not found'});
        const readOnly = name === 'config';
        if (req.method !== (readOnly ? 'GET' : 'POST')) return json(405,{error:readOnly?'GET only':'POST only'});
        if (!isAllowedOrigin(req,{allowMissing:readOnly})) return json(403,{error:'허용되지 않은 요청 출처입니다.'});
        const ip = clientIp(req);
        const wait = limit(`all:${ip}`,60,60000) || limit(`endpoint:${name}:${ip}`,(name==='report'?3:30),['lead','report'].includes(name)?3600000:60000)
          || limit(`global:${name}`,name==='report'?50:1000,3600000);
        if (wait) {res.setHeader('Retry-After',String(wait)); return json(429,{error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'});}
        if (inFlight >= 20) return json(503,{error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'});
        const file = path.join(root,'..','api',name+'.js');
        try { if (!(await stat(file)).isFile()) return json(404,{error:'Not found'}); }
        catch { return json(404,{error:'Not found'}); }
        inFlight++;
        try {
          if (!readOnly && String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json') return json(415,{error:'application/json required'});
          const body = readOnly ? '' : await readBody(req);
          const handler = (await import(pathToFileURL(file).href)).default;
          if (typeof handler !== 'function') throw new Error('Missing API handler');
          res.setHeader('Cache-Control','no-store');
          await handler({method:req.method,headers:req.headers,body,url:req.url,ip,query:Object.fromEntries(new URL(req.url,'http://localhost').searchParams)},vercelRes(res));
        } finally { inFlight--; }
        return;
      }
      if (!['GET','HEAD'].includes(req.method)) return json(405,{error:'GET only'});
      await serveStatic(root, pathname, res, req);
    } catch (error) {
      if (res.destroyed) return;
      if (res.headersSent) return res.end();
      if (error.status) return json(error.status,{error:error.message});
      console.error('[server]',redact(error.stack || error.message));
      return json(500,{error:'요청을 처리하지 못했습니다.'});
    }
  });
  server.requestTimeout=30000; server.headersTimeout=15000; server.keepAliveTimeout=5000;
  return server;
}
