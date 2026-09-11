import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {customerSettings,openCustomerPool,CustomerStore,csv,tokenHash} from './customer-data.js';
import {createLimiter,securityHeaders} from './security.js';
import {readBody} from './response.js';

export function createAdminServer(store,token,port){
  if(!/^[a-f0-9]{64}$/i.test(token||''))throw new Error('CUSTOMER_ADMIN_TOKEN must be 32 random bytes in hex');
  const expected=tokenHash(token),limit=createLimiter();
  return http.createServer(async(req,res)=>{
    securityHeaders(res);res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'Local access only'});
      // Fixed loopback Host protects this local service from DNS rebinding.
      if(![`127.0.0.1:${port||req.socket.localPort}`,`localhost:${port||req.socket.localPort}`].includes(req.headers.host))return send(403,{error:'Invalid host'});
      const wait=limit(req.socket.remoteAddress,120,60000);if(wait)return send(429,{error:'잠시 후 다시 시도해 주세요.'});
      if(['/','/admin.js','/admin.css'].includes(url.pathname)&&req.method==='GET'){
        const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const body=await readFile(new URL('../admin/'+name,import.meta.url));
        res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return res.end(body);
      }
      if(req.method!=='POST'||req.headers.origin!==`http://${req.headers.host}`)return send(403,{error:'허용되지 않은 요청입니다.'});
      if(req.headers['content-type']!=='application/json')return send(415,{error:'JSON required'});
      const supplied=String(req.headers.authorization||'').replace(/^Bearer /,'');
      if(!timingSafeEqual(expected,tokenHash(supplied))){const blocked=limit('auth',5,60000);return send(blocked?429:401,{error:'관리자 키를 확인해 주세요.'});}
      if(limit('queries',60,60000))return send(429,{error:'잠시 후 다시 시도해 주세요.'});
      const body=JSON.parse(await readBody(req));
      if(url.pathname==='/api/list'){
        await store.audit(body.reveal===true?'view-email':'view-masked');
        return send(200,await store.list({before:body.before,reveal:body.reveal===true}));
      }
      if(url.pathname==='/api/clicks'){await store.audit('view-clicks');return send(200,{rows:await store.clicks()});}
      if(url.pathname==='/api/export'){
        await store.audit(body.reveal===true?'export-email':'export-masked');
        const rows=body.kind==='clicks'?await store.clicks():(await store.list({before:body.before,reveal:body.reveal===true})).rows;
        res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="customers.csv"'});return res.end(csv(rows));
      }
      if(url.pathname==='/api/delete'){await store.audit('delete-submission');await store.remove(body.id);return send(200,{ok:true});}
      return send(404,{error:'Not found'});
    }catch{console.error('[customer-admin] request failed');if(!res.headersSent)send(400,{error:'요청을 처리하지 못했습니다.'});else res.end();}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(!customerSettings().enabled)throw new Error('Customer data configuration is incomplete');
  const port=Number(process.env.CUSTOMER_ADMIN_PORT||3102);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid admin port');
  const db=await openCustomerPool(),server=createAdminServer(new CustomerStore(db),process.env.CUSTOMER_ADMIN_TOKEN,port);
  server.requestTimeout=15000;server.headersTimeout=10000;server.setTimeout(15000,s=>s.destroy());
  server.listen(port,'127.0.0.1',()=>console.log('Customer admin listening on loopback port '+port));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>db.end().then(()=>process.exit(0))));
}
