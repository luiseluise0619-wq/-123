import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {buildDeployment} from '../scripts/build-deploy.mjs';
import {BUNDLE_SOURCES} from '../scripts/build-assets.mjs';
import {createServer} from '../server/app.js';
import support from '../api/support.js';
import {fetchT} from '../api/_http.js';

const root = fileURLToPath(new URL('../',import.meta.url));
test('HTML build CLI actually runs on Windows and Linux',()=>{
  const result=spawnSync(process.execPath,['scripts/build-html.mjs','--check'],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/index.html/);
});

test('browser script order loads every prototype part; unmount destroys charts',async()=>{
  const html=await readFile(path.join(root,'frontend/index.html'),'utf8');
  const publicScripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m=>m[1]);
  assert.ok(publicScripts.includes('./app.bundle.js?v=1'));assert.ok(publicScripts.length<=8);
  const context=vm.createContext({console,window:{},document:{},clearTimeout,
    DCLogic:class {setState(v){this.state={...this.state,...v};}}});
  for(const src of BUNDLE_SOURCES.filter(src=>src!=='dc-runtime.js')) {
    vm.runInContext(await readFile(path.join(root,'frontend',src),'utf8'),context,{filename:src});
  }
  const Component=vm.runInContext('MysbizonLogic(DCLogic)',context);
  const c=new Component(); let destroyed=0;
  c._chartInst={one:{destroy(){destroyed++;}},two:{destroy(){destroyed++;}}};
  c.componentWillUnmount();
  assert.equal(destroyed,2);
  assert.equal(Object.keys(c._chartInst).length,0);
  for(const name of ['loadData','saveSurvey','home','reportView','priceView','zoneCompare','fillComparisonView']) {
    assert.equal(typeof c[name],'function',name);
  }
});

test('upstream timeout preserves caller cancellation',async t=>{
  const old=global.fetch;t.after(()=>{global.fetch=old;});
  const controller=new AbortController();let signal;
  global.fetch=async (url,options)=>{signal=options.signal;return {};};
  await fetchT('https://example.test',{signal:controller.signal});
  controller.abort();assert.equal(signal.aborted,true);
});

test('support rejects failed upstream and strips executable links',async t=>{
  const old=global.fetch,env={...process.env};
  t.after(()=>{global.fetch=old;process.env=env;});
  Object.assign(process.env,{DATA_GO_KR_KEY:'test-only'});
  const call=async()=>{let body;await support({}, {status(){return this;},json(v){body=v;}});return body;};
  global.fetch=async()=>({ok:false,status:503});
  assert.equal((await call()).ok,false);
  global.fetch=async()=>({ok:true,json:async()=>({data:[null,{title:'safe',url:'https://example.test/apply'},{title:'bad',url:'javascript:alert(1)'}]})});
  const result=await call();
  assert.equal(result.ok,true);assert.equal(result.items.length,2);
  assert.equal(result.items[0].url,'https://example.test/apply');
  assert.equal(result.items[1].url,'');
});

test('deploy artifact starts independently and excludes collectors, templates and dormant API',async t=>{
  const temp=await mkdtemp(path.join(tmpdir(),'mysbizon-release-'));
  const result=await buildDeployment(temp);
  assert.ok(result.files>30);
  const names=await readdir(temp);assert.ok(!names.includes('backend'));
  await assert.rejects(readFile(path.join(temp,'api/market.js')));
  await assert.rejects(readFile(path.join(temp,'frontend/screens/01-home.html')));
  await assert.rejects(buildDeployment(temp),/empty release directory/);
  const module=await import(new URL('file:///'+path.join(temp,'server/app.js').replaceAll('\\','/')).href);
  const server=module.createServer(path.join(temp,'frontend'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base='http://127.0.0.1:'+server.address().port;
  for(const url of ['/','/healthz','/api/config','/api/integrations','/report-print.html','/privacy','/app.bundle.js','/data/v3/zone_industry.json']) {
    const response=await fetch(base+url);assert.equal(response.status,200,url);await response.arrayBuffer();
  }
  for(const url of ['/api/market','/vercel.json','/zone_intel.json','/screens/01-home.html','/logic/home.js']) {
    assert.equal((await fetch(base+url)).status,404,url);
  }
});

test('router enforces concurrency before awaiting and preserves API method/rate limits',async t=>{
  const old=global.fetch,env={...process.env};
  const server=createServer(path.join(root,'frontend'));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{global.fetch=old;process.env=env;server.closeAllConnections();await new Promise(r=>server.close(r));});
  const base='http://127.0.0.1:'+server.address().port;
  Object.assign(process.env,{ALLOWED_ORIGIN:base,DATA_GO_KR_KEY:'test-only'});
  global.fetch=async(url,options)=>{
    if(String(url).startsWith(base))return old(url,options);
    await new Promise(r=>setTimeout(r,100));
    return {ok:true,json:async()=>({data:[]})};
  };
  const headers={Origin:base,'Content-Type':'application/json'};
  const results=await Promise.all(Array.from({length:25},()=>fetch(base+'/api/support',{method:'POST',headers,body:'{}'})));
  assert.ok(results.some(r=>r.status===503));
  assert.ok(results.filter(r=>r.status===200).length<=20);
  for(let i=0;i<6;i++)await fetch(base+'/api/support',{method:'POST',headers,body:'{}'});
  assert.equal((await fetch(base+'/api/support',{method:'POST',headers,body:'{}'})).status,429);
  const wrong=await fetch(base+'/api/report');assert.equal(wrong.status,405);assert.equal(wrong.headers.get('allow'),'POST');
  assert.equal((await fetch(base+'/%ZZ')).status,404);
});
