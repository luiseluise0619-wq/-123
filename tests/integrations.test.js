import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../api/support.js';
import {integrationStatus,publicDataHandler,geminiHandler,endpoints} from '../api/integrations.js';

function response(){
  return {statusCode:0,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return body;}};
}
function restoreEnv(snapshot){for(const key of Object.keys(process.env))if(!(key in snapshot))delete process.env[key];Object.assign(process.env,snapshot);}

test('integration status exposes readiness but never credential values',()=>{
  const env={SEOUL_API_KEY:'seoul-secret',DATA_GO_KR_KEY:'data-secret',GEMINI_API_KEY:'gemini-secret',EXIM_API_KEY:'exim-secret',
    RONE_API_KEY:'rone-secret',RONE_STATBL_ID:'TABLE',RONE_CYCLE:'QY',RONE_CLS_ID:'1',RONE_ITM_ID:'2'};
  const status=integrationStatus(env),encoded=JSON.stringify(status);
  assert.equal(status.seoul.configured,true);assert.equal(status.rOne.configured,true);
  for(const secret of Object.values(env))assert.equal(encoded.includes(secret),false);
});

test('K-Startup uses the fixed official endpoint and current snake-case fields',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  delete process.env.SUPPORT_API_URL;process.env.KSTARTUP_API_KEY='encoded%2Bkey';delete process.env.DATA_GO_KR_KEY;
  let called='';global.fetch=async url=>{called=String(url);return new Response(JSON.stringify({data:[{biz_pbanc_nm:'서울 지원',pbanc_ntrp_nm:'서울기관',pbanc_rcpt_bgng_dt:'20990101',pbanc_rcpt_end_dt:'20991231',detl_pg_url:'https://www.k-startup.go.kr/test',supt_regin:'서울',aply_trgt_ctnt:'예비창업자',pbanc_ctnt:'설명'}]}),{status:200,headers:{'content-type':'application/json'}});};
  const res=response();await support({},res);
  assert.equal(called.startsWith(endpoints.KSTARTUP_URL+'?serviceKey=encoded%2Bkey&'),true);
  assert.equal(called.includes('cond%5Brcrt_prgs_yn%3A%3AEQ%5D=Y'),true);
  assert.equal(res.body.items[0].title,'서울 지원');assert.equal(res.body.items[0].region,'서울');
});

test('Export-Import Bank adapter uses the new official host and normalizes rates',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  process.env.EXIM_API_KEY='exim-secret';let called='';
  global.fetch=async url=>{called=String(url);return new Response(JSON.stringify([{cur_nm:'미국 달러',cur_unit:'USD',deal_bas_r:'1,300.00',bkpr:'1300',ttb:'1280',tts:'1320',result:1}]),{status:200});};
  const res=response();await publicDataHandler({body:{provider:'exportImportBank',date:'20990102'}},res);
  assert.equal(new URL(called).host,'oapi.koreaexim.go.kr');assert.equal(res.body.rates[0].code,'USD');
  assert.equal(JSON.stringify(res.body).includes('exim-secret'),false);
});

test('Gemini sends the key only in a header, disables storage and blocks obvious personal data',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  process.env.GEMINI_API_KEY='AIza-test-secret';process.env.GEMINI_MODEL='gemini-3.8-flash';let request;
  global.fetch=async(url,options)=>{request={url:String(url),options};return new Response(JSON.stringify({steps:[{type:'model_output',content:[{type:'text',text:'근거를 먼저 확인하세요.'}]}],usage:{total_tokens:10}}),{status:200});};
  const blocked=response();await geminiHandler({body:{question:'test@example.com 분석',evidence:{}}},blocked);assert.equal(blocked.statusCode,400);assert.equal(request,undefined);
  const res=response();await geminiHandler({body:{question:'이 상권을 설명해줘',evidence:{sales:100}}},res);
  assert.equal(request.url,endpoints.GEMINI_URL);assert.equal(request.url.includes('AIza'),false);
  assert.equal(request.options.headers['x-goog-api-key'],'AIza-test-secret');assert.equal(JSON.parse(request.options.body).store,false);
  assert.equal(res.body.answer,'근거를 먼저 확인하세요.');assert.equal(JSON.stringify(res.body).includes('AIza-test-secret'),false);
});

test('R-ONE does not pretend a key alone identifies a statistic',async t=>{
  const env={...process.env};t.after(()=>restoreEnv(env));
  process.env.RONE_API_KEY='key';for(const name of ['RONE_STATBL_ID','RONE_CYCLE','RONE_CLS_ID','RONE_ITM_ID'])delete process.env[name];
  const res=response();await publicDataHandler({body:{provider:'rOne'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.configured,false);assert.ok(res.body.needs.includes('RONE_STATBL_ID'));
});
