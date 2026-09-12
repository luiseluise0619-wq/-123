import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {openCustomerPool,CustomerStore,csv,tokenHash} from './customer-data.js';
import {createLimiter,securityHeaders} from './security.js';
import {readBody} from './response.js';

function parseCsv(value){
  if(!value) return [];
  return value.split(',').map((v)=>v.trim()).filter(Boolean).map(v=>v.toLowerCase());
}
function basePath(value){
  const raw=String(value||'').trim();
  if(!raw)return '';
  if(!/^\/[a-z0-9_-]{1,40}$/i.test(raw))throw new Error('Invalid admin base path');
  return raw;
}

export function customerAdminSettings(env=process.env){
  const port=Number(env.CUSTOMER_ADMIN_PORT||env.PORT||3102);
  return {
    ready:!!env.CUSTOMER_DATABASE_URL&&/^[a-f0-9]{64}$/i.test(env.CUSTOMER_DATA_KEY||'')&&/^[a-f0-9]{64}$/i.test(env.CUSTOMER_ADMIN_TOKEN||''),
    port,basePath:basePath(env.CUSTOMER_ADMIN_BASE_PATH),
  };
}

export function createAdminServer(store,token,port){
  if(!/^[a-f0-9]{64}$/i.test(token||''))throw new Error('CUSTOMER_ADMIN_TOKEN must be 32 random bytes in hex');
  const expected=tokenHash(token),limit=createLimiter();
  const allowedHosts=new Set(parseCsv(process.env.CUSTOMER_ADMIN_ALLOWED_HOSTS).map((v)=>v.toLowerCase()));
  if(allowedHosts.size===0){
    for(const host of ['127.0.0.1','localhost'])allowedHosts.add(port===0?host:`${host}:${port}`);
  }
  const allowedOrigins=new Set(parseCsv(process.env.CUSTOMER_ADMIN_ALLOWED_ORIGINS).map((v)=>v.replace(/^https?:\/\//,'').toLowerCase()));
  if(allowedOrigins.size===0)for(const host of allowedHosts)allowedOrigins.add(host);
  const publicMode = process.env.CUSTOMER_ADMIN_PUBLIC==='1';
  const prefix=basePath(process.env.CUSTOMER_ADMIN_BASE_PATH);
  return http.createServer(async(req,res)=>{
    securityHeaders(res);res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(!publicMode && !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'Local access only'});
      // Fixed loopback Host protects this local service from DNS rebinding.
      const host=(req.headers.host||'').toLowerCase();
      const hostBase=(host||'').split(':')[0];
      if(!host || (!allowedHosts.has(host) && !allowedHosts.has(hostBase))){
        return send(403,{error:'Invalid host'});
      }
      const wait=limit(req.socket.remoteAddress,120,60000);if(wait)return send(429,{error:'잠시 후 다시 시도해 주세요.'});
      const assetPath=prefix&&url.pathname.startsWith(prefix+'/')?url.pathname.slice(prefix.length):url.pathname;
      if(prefix&&url.pathname===prefix&&req.method==='GET'){res.writeHead(308,{Location:prefix+'/'});return res.end();}
      if(['/','/admin.js','/admin.css'].includes(assetPath)&&req.method==='GET'){
        const name=assetPath==='/'?'index.html':assetPath.slice(1);
        const body=await readFile(new URL('../admin/'+name,import.meta.url));
        res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return res.end(body);
      }
      if(req.method!=='POST')return send(405,{error:'허용되지 않은 요청입니다.'});
      if(req.headers.origin){
        const originHost=req.headers.origin.replace(/^https?:\/\//,'').toLowerCase().split('/')[0];
        const originBase=originHost.split(':')[0];
        if(!allowedOrigins.has(originHost) && !allowedOrigins.has(originBase)){
          return send(403,{error:'허용되지 않은 요청입니다.'});
        }
      }else if(!allowedOrigins.has(host) && !allowedOrigins.has(hostBase)){
        return send(403,{error:'허용되지 않은 요청입니다.'});
      }
      if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON required'});
      const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
      if(!timingSafeEqual(expected,tokenHash(supplied))){const blocked=limit('auth',5,60000);return send(blocked?429:401,{error:'관리자 키를 확인해 주세요.'});}
      if(limit('queries',60,60000))return send(429,{error:'잠시 후 다시 시도해 주세요.'});
      const body=JSON.parse(await readBody(req));
      const apiPath=prefix&&url.pathname.startsWith(prefix+'/api/')?url.pathname.slice(prefix.length):url.pathname;
      if(apiPath==='/api/list'){
        await store.audit(body.reveal===true?'view-email':'view-masked');
        return send(200,await store.list({before:body.before,reveal:body.reveal===true}));
      }
      if(apiPath==='/api/clicks'){await store.audit('view-clicks');return send(200,{rows:await store.clicks()});}
      if(apiPath==='/api/export'){
        await store.audit(body.reveal===true?'export-email':'export-masked');
        const rows=body.kind==='clicks'?await store.clicks():(await store.list({before:body.before,reveal:body.reveal===true})).rows;
        res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="customers.csv"'});return res.end(csv(rows));
      }
      if(apiPath==='/api/delete'){await store.audit('delete-submission');await store.remove(body.id);return send(200,{ok:true});}
      return send(404,{error:'Not found'});
    }catch{console.error('[customer-admin] request failed');if(!res.headersSent)send(400,{error:'요청을 처리하지 못했습니다.'});else res.end();}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const settings=customerAdminSettings();
  if(!settings.ready)throw new Error('Customer admin configuration is incomplete');
  const port=settings.port;
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid admin port');
  const bindHost=process.env.CUSTOMER_ADMIN_LISTEN_HOST || '127.0.0.1';
  const db=await openCustomerPool(),server=createAdminServer(new CustomerStore(db),process.env.CUSTOMER_ADMIN_TOKEN,port);
  server.requestTimeout=15000;server.headersTimeout=10000;server.setTimeout(15000,s=>s.destroy());
  server.listen(port,bindHost,()=>console.log('Customer admin listening on '+bindHost+':'+port));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>db.end().then(()=>process.exit(0))));
}
