import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../api/support.js';
import {integrationStatus,publicDataHandler,geminiHandler,endpoints,ronePresets} from '../api/integrations.js';

function response(){
  return {statusCode:0,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return body;}};
}
function restoreEnv(snapshot){for(const key of Object.keys(process.env))if(!(key in snapshot))delete process.env[key];Object.assign(process.env,snapshot);}

test('integration status exposes readiness but never credential values',()=>{
  const env={SEOUL_API_KEY:'seoul-secret',DATA_GO_KR_KEY:'data-secret',GEMINI_API_KEY:'gemini-secret',EXIM_API_KEY:'exim-secret',
    RONE_API_KEY:'rone-secret'};
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

test('R-ONE key exposes the fixed retail catalog without an upstream call',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  process.env.RONE_API_KEY='key';global.fetch=async()=>{throw new Error('unexpected fetch');};
  const res=response();await publicDataHandler({body:{provider:'rOne',action:'catalog'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.configured,true);assert.equal(res.body.defaultRegionCode,'500002');
  assert.deepEqual(res.body.catalog.map(v=>v.buildingType),['small','medium','collective']);
  assert.ok(res.body.catalog.every(v=>v.metrics.length===3));
});

test('R-ONE all selection queries only the nine allowlisted current tables',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  process.env.RONE_API_KEY='key';const called=[];
  global.fetch=async url=>{
    const parsed=new URL(String(url));called.push(parsed);
    const row={WRTTIME_IDTFR_ID:'202601',WRTTIME_DESC:'2026년 1분기',DTA_VAL:'12.3',UI_NM:'%',CLS_NM:'서울',ITM_NM:'값'};
    return new Response(JSON.stringify({SttsApiTblData:[{head:[{list_total_count:1},{RESULT:{CODE:'INFO-000'}}]},{row:[row]}]}),{status:200});
  };
  const res=response();await publicDataHandler({body:{provider:'rOne',startYear:'2026',endYear:'2026'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.datasets.length,9);assert.equal(called.length,9);
  const allowed=new Set(Object.values(ronePresets).flatMap(v=>Object.values(v.metrics).map(m=>m.statblId)));
  assert.deepEqual(new Set(called.map(v=>v.searchParams.get('STATBL_ID'))),allowed);
  assert.ok(called.every(v=>v.origin==='https://www.reb.or.kr'&&v.searchParams.get('DTACYCLE_CD')==='QY'
    &&v.searchParams.get('CLS_ID')==='500002'&&v.searchParams.get('ITM_ID')==='100001'));
  assert.equal(JSON.stringify(res.body).includes('key'),false);
});

test('R-ONE rejects table names outside the fixed catalog',async t=>{
  const oldFetch=global.fetch,env={...process.env};t.after(()=>{global.fetch=oldFetch;restoreEnv(env);});
  process.env.RONE_API_KEY='key';let fetched=false;global.fetch=async()=>{fetched=true;throw new Error('unexpected fetch');};
  const res=response();await publicDataHandler({body:{provider:'rOne',buildingType:'other'}},res);
  assert.equal(res.statusCode,400);assert.equal(fetched,false);
});
