import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from '../server/app.js';
import {createLimiter,clientIp} from '../server/security.js';
import {isAllowedOrigin} from '../api/_origin.js';
import {reportInput} from '../api/report.js';

test('출처의 스킴·포트·호스트를 정확히 비교하고 프리뷰 전체 허용을 제거',()=>{
  process.env.ALLOWED_ORIGIN='https://service.example';
  for(const origin of ['https://evil.example','http://service.example','https://service.example:444','https://service.example.evil','null'])assert.equal(isAllowedOrigin({headers:{origin,host:'service.example'}}),false);
  assert.equal(isAllowedOrigin({headers:{origin:'https://service.example',host:'service.example'}}),true);
  delete process.env.ALLOWED_ORIGIN;
  assert.equal(isAllowedOrigin({headers:{origin:'https://other.vercel.app',host:'mine.vercel.app'}}),false);
});
test('리포트 동의 false 문자열·잘못된 배열·과도한 항목 거부',()=>{
  assert.throws(()=>reportInput({email:'test@example.com',agreed:'false'}));
  assert.throws(()=>reportInput({email:'test@example.com',agreed:true,facts:{}}));
  assert.throws(()=>reportInput({email:'test@example.com',agreed:true,zones:Array(31).fill({})}));
  assert.equal(reportInput({email:'test@example.com',agreed:true}).headline,'상권 분석 리포트');
});
test('요청 제한 만료·메모리 상한·프록시 헤더 위조 방어',()=>{
  let time=0;const limit=createLimiter({now:()=>time,maxKeys:2});
  assert.equal(limit('one',2,1000),0);assert.equal(limit('one',2,1000),0);assert.equal(limit('one',2,1000),1);
  assert.equal(limit('two',2,1000),0);assert.equal(limit('three',2,1000),60);time=1001;assert.equal(limit('three',2,1000),0);
  const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-for':'1.2.3.4, 8.8.8.8'}};
  assert.equal(clientIp(req,0),'127.0.0.1');assert.equal(clientIp(req,1),'8.8.8.8');
});
test('운영 라우터: 소스 노출 회귀·본문 제한·JSON MIME·보안 헤더',async t=>{
  const root=fileURLToPath(new URL('../frontend',import.meta.url));
  const server=createServer(root);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base='http://127.0.0.1:'+server.address().port;
  process.env.ALLOWED_ORIGIN=base;
  for(const url of ['/%61pi/_origin.js','/%61pi/lead.js','/API/lead.js','/api/lead.js','/%2561pi/lead.js','/.env','/%2e%2e%2fpackage.json','/api/ch.at','/api/ch/at'])assert.equal((await fetch(base+url)).status,404,url);
  const home=await fetch(base+'/');assert.equal(home.status,200);assert.equal(home.headers.get('x-content-type-options'),'nosniff');assert.ok(home.headers.get('content-security-policy').includes("frame-ancestors 'none'"));assert.ok(home.headers.get('content-security-policy').includes("script-src 'self';"));assert.ok(!home.headers.get('content-security-policy').includes('unsafe-eval'));
  assert.equal((await fetch(base+'/api/report',{method:'POST',headers:{Origin:base},body:'{}'})).status,415);
  assert.equal((await fetch(base+'/api/report',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'x'.repeat(65537)})).status,413);
  assert.equal((await fetch(base+'/api/report',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'})).status,403);
});
