import http from 'node:http';
import report from '../api/report.js';
import config from '../api/config.js';
import support from '../api/support.js';
import {statusHandler,publicDataHandler,geminiHandler} from '../api/integrations.js';
import {submitCustomer,recordClick,customerHandler} from '../api/customer.js';
import { vercelRes, readBody } from './response.js';
import { serveStatic } from './static.js';
import { clientIp, createLimiter, securityHeaders } from './security.js';
import { isAllowedOrigin } from '../api/_origin.js';
import { safeError } from '../api/_err.js';

const PUBLIC_APIS = new Map([['report', report], ['config', config], ['support', support],
  ['integrations',statusHandler],['public-data',publicDataHandler],['gemini',geminiHandler],
  ['customer-submit',submitCustomer],['customer-event',recordClick]]);
const READ_ONLY_APIS = new Set(['config','integrations']);
const API_LIMITS = Object.freeze({
  report:{perIp:3,window:3600000,global:50},
  gemini:{perIp:5,window:3600000,global:100},
  'public-data':{perIp:20,window:60000,global:1000},
});
export function createServer(root,{customerStore}={}) {
  const handlers=new Map(PUBLIC_APIS);
  if(customerStore){
    handlers.set('customer-submit',customerHandler('submit',customerStore));
    handlers.set('customer-event',customerHandler('event',customerStore));
    handlers.set('config',(_req,res)=>res.status(200).json({reportEmailEnabled:false,customerData:customerStore.settings}));
  }
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
        const readOnly = READ_ONLY_APIS.has(name);
        if (req.method !== (readOnly ? 'GET' : 'POST')) {
          res.setHeader('Allow', readOnly ? 'GET' : 'POST');
          return json(405,{error:readOnly?'GET only':'POST only'});
        }
        if (!isAllowedOrigin(req,{allowMissing:readOnly})) return json(403,{error:'허용되지 않은 요청 출처입니다.'});
        const ip = clientIp(req);
        const limits=API_LIMITS[name]||{perIp:30,window:60000,global:1000};
        const wait = limit(`all:${ip}`,60,60000) || limit(`endpoint:${name}:${ip}`,limits.perIp,limits.window)
          || limit(`global:${name}`,limits.global,3600000);
        if (wait) {res.setHeader('Retry-After',String(wait)); return json(429,{error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'});}
        if (inFlight >= 20) return json(503,{error:'요청이 많습니다. 잠시 후 다시 시도해 주세요.'});
        inFlight++;
        try {
          if (!readOnly && String(req.headers['content-type']||'').split(';')[0].trim().toLowerCase()!=='application/json') return json(415,{error:'application/json required'});
          const body = readOnly ? '' : await readBody(req);
          const handler = handlers.get(name);
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
      safeError('server',error,'요청 실패');
      return json(500,{error:'요청을 처리하지 못했습니다.'});
    }
  });
  server.requestTimeout=30000; server.headersTimeout=15000; server.keepAliveTimeout=5000;
  // Bound inactive response sockets too; requestTimeout only covers receiving requests.
  server.setTimeout(30000, socket => socket.destroy());
  return server;
}
