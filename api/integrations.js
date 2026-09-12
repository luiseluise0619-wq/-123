// External data adapters used by the public Node service.
//
// Credentials are read only from the server environment. Public callers choose
// from fixed providers and datasets; they can never supply an upstream URL.
import {fetchT,encKey,ymdLocal,boundedJson} from './_http.js';
import {parseBody} from './_request.js';
import {safeError} from './_err.js';

const KSTARTUP_URL='https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01';
const RONE_URL='https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do';
const EXIM_URL='https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';
const GEMINI_URL='https://generativelanguage.googleapis.com/v1beta/interactions';
const DATAGO_STORE_URL='https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong';
const SEOUL_BASE='http://openapi.seoul.go.kr:8088';

const SEOUL_DATASETS=Object.freeze({
  sales:'VwsmTrdarSelngQq',
  stores:'VwsmTrdarStorQq',
  floatingPopulation:'VwsmTrdarFlpopQq',
  residentPopulation:'VwsmTrdarRepopQq',
  workingPopulation:'VwsmTrdarWrcPopltnQq',
  facilities:'VwsmTrdarFcltyQq',
  changeIndex:'VwsmTrdarIxQq',
  apartments:'InfoTrdarAptQq',
  districtSpending:'VwsmSignguNcmCnsmpW',
});

const memoryCache=new Map();
function fromCache(key){
  const hit=memoryCache.get(key);
  if(!hit||hit.expires<=Date.now()){memoryCache.delete(key);return null;}
  return hit.value;
}
function saveCache(key,value,ttl=10*60*1000){
  if(memoryCache.size>=100)memoryCache.delete(memoryCache.keys().next().value);
  memoryCache.set(key,{value,expires:Date.now()+ttl});
  return value;
}

function send(res,status,body){return res.status(status).json(body);}
function keyFor(name,env=process.env){return String(env[name]||'').trim();}
function positiveInt(value,fallback,max){const n=Number(value);return Number.isInteger(n)&&n>0?Math.min(n,max):fallback;}
function validQuarter(value){return /^20\d{2}[1-4]$/.test(String(value||''))?String(value):'';}
function validYmd(value){return /^20\d{6}$/.test(String(value||''))?String(value):'';}

export function integrationStatus(env=process.env){
  const dataGo=!!keyFor('DATA_GO_KR_KEY',env),roneKey=!!keyFor('RONE_API_KEY',env);
  const roneSeries=['RONE_STATBL_ID','RONE_CYCLE','RONE_CLS_ID','RONE_ITM_ID'].every(k=>!!keyFor(k,env));
  return {
    seoul:{configured:!!keyFor('SEOUL_API_KEY',env),keyOnly:true},
    dataGoKr:{configured:dataGo,keyOnly:false,note:'이용 신청한 API별 주소가 필요합니다. 상가정보 어댑터는 포함되어 있습니다.'},
    kStartup:{configured:!!(keyFor('KSTARTUP_API_KEY',env)||keyFor('DATA_GO_KR_KEY',env)),keyOnly:true},
    rOne:{configured:roneKey&&roneSeries,keyOnly:false,note:'인증키와 조회할 통계표·지역·항목 코드가 필요합니다.'},
    exportImportBank:{configured:!!keyFor('EXIM_API_KEY',env),keyOnly:true},
    gemini:{configured:!!keyFor('GEMINI_API_KEY',env),keyOnly:true},
  };
}

export function statusHandler(_req,res){return send(res,200,{ok:true,providers:integrationStatus()});}

async function seoul(body){
  const key=keyFor('SEOUL_API_KEY');
  if(!key)return {ok:false,configured:false,provider:'seoul'};
  const service=SEOUL_DATASETS[body.dataset];
  if(!service)throw new Error('INVALID_DATASET');
  const start=positiveInt(body.start,1,1000),end=Math.max(start,positiveInt(body.end,Math.min(start+99,1000),1000));
  const quarter=validQuarter(body.quarter);
  const segments=quarter?`/${quarter}`:'';
  const cacheKey=`seoul:${body.dataset}:${start}:${end}:${quarter}`;
  const cached=fromCache(cacheKey);if(cached)return {...cached,cached:true};
  // Seoul's official endpoint currently documents HTTP on port 8088. The key
  // stays server-side and this low-privilege credential must be dedicated to it.
  const response=await fetchT(`${SEOUL_BASE}/${encKey(key)}/json/${service}/${start}/${end}${segments}/`);
  if(!response.ok)throw new Error('SEOUL_HTTP_'+response.status);
  const json=await boundedJson(response),root=json?.[service],code=root?.RESULT?.CODE;
  if(code&&code!=='INFO-000')throw new Error('SEOUL_RESULT_'+code);
  const result={ok:true,configured:true,provider:'seoul',dataset:body.dataset,
    total:Number(root?.list_total_count||0),rows:Array.isArray(root?.row)?root.row:[],quarter:quarter||null};
  return saveCache(cacheKey,result);
}

async function dataGoStores(body){
  const key=keyFor('DATA_GO_KR_KEY');
  if(!key)return {ok:false,configured:false,provider:'dataGoKr'};
  const sigunguCode=String(body.sigunguCode||'');
  if(!/^11\d{3}$/.test(sigunguCode))throw new Error('INVALID_SIGUNGU');
  const page=positiveInt(body.page,1,10000),rows=positiveInt(body.rows,100,100);
  const cacheKey=`datago:stores:${sigunguCode}:${page}:${rows}`;
  const cached=fromCache(cacheKey);if(cached)return {...cached,cached:true};
  const query=`serviceKey=${encKey(key)}&`+new URLSearchParams({divId:'signguCd',key:sigunguCode,pageNo:String(page),numOfRows:String(rows),type:'json'});
  const response=await fetchT(`${DATAGO_STORE_URL}?${query}`);
  if(!response.ok)throw new Error('DATAGO_HTTP_'+response.status);
  const json=await boundedJson(response),root=json?.body||json?.response?.body||{};
  const list=root?.items?.item||root?.items||[];
  const result={ok:true,configured:true,provider:'dataGoKr',dataset:'stores',sigunguCode,
    total:Number(root.totalCount||0),rows:Array.isArray(list)?list:[]};
  return saveCache(cacheKey,result);
}

async function exportImportBank(body){
  const key=keyFor('EXIM_API_KEY');
  if(!key)return {ok:false,configured:false,provider:'exportImportBank'};
  const today=new Date(),date=validYmd(body.date)||ymdLocal(today).replaceAll('-','');
  const cacheKey=`exim:${date}`;const cached=fromCache(cacheKey);if(cached)return {...cached,cached:true};
  const query=`authkey=${encKey(key)}&`+new URLSearchParams({searchdate:date,data:'AP01'});
  const response=await fetchT(`${EXIM_URL}?${query}`);
  if(!response.ok)throw new Error('EXIM_HTTP_'+response.status);
  const json=await boundedJson(response,500_000),rows=Array.isArray(json)?json:[];
  const rates=rows.filter(v=>v&&typeof v==='object').map(v=>({
    currency:String(v.cur_nm||''),code:String(v.cur_unit||''),unit:Number(v.cur_unit?.match?.(/\((\d+)\)/)?.[1]||1),
    dealBaseRate:String(v.deal_bas_r||''),bookBaseRate:String(v.bkpr||''),
    buyingRate:String(v.ttb||''),sellingRate:String(v.tts||''),result:Number(v.result||0),
  }));
  return saveCache(cacheKey,{ok:true,configured:true,provider:'exportImportBank',date,rates},60*60*1000);
}

async function rOne(body){
  const key=keyFor('RONE_API_KEY'),stat=keyFor('RONE_STATBL_ID'),cycle=keyFor('RONE_CYCLE'),cls=keyFor('RONE_CLS_ID'),item=keyFor('RONE_ITM_ID');
  if(!key||!stat||!cycle||!cls||!item)return {ok:false,configured:false,provider:'rOne',needs:['RONE_API_KEY','RONE_STATBL_ID','RONE_CYCLE','RONE_CLS_ID','RONE_ITM_ID']};
  if(!/^[A-Z0-9_]{3,40}$/i.test(stat)||!/^[A-Z0-9]{1,8}$/i.test(cycle)||!/^[0-9A-Z_-]{1,30}$/i.test(cls)||!/^[0-9A-Z_*-]{1,30}$/i.test(item))throw new Error('INVALID_RONE_CONFIG');
  const year=new Date().getFullYear(),start=String(body.startYear||year-2),end=String(body.endYear||year);
  if(!/^20\d{2}$/.test(start)||!/^20\d{2}$/.test(end))throw new Error('INVALID_YEAR');
  const cacheKey=`rone:${stat}:${cycle}:${cls}:${item}:${start}:${end}`;const cached=fromCache(cacheKey);if(cached)return {...cached,cached:true};
  const query=new URLSearchParams({Type:'json',pIndex:'1',pSize:'400',STATBL_ID:stat,DTACYCLE_CD:cycle,CLS_ID:cls,ITM_ID:item,START_WRTTIME:start,END_WRTTIME:end});
  const response=await fetchT(`${RONE_URL}?KEY=${encKey(key)}&${query}`);
  if(!response.ok)throw new Error('RONE_HTTP_'+response.status);
  const json=await boundedJson(response),parts=json?.SttsApiTblData||[];
  if(json?.RESULT?.CODE||parts?.[0]?.head?.find?.(v=>v.RESULT)?.RESULT?.CODE?.startsWith('ERROR'))throw new Error('RONE_RESULT_ERROR');
  const rows=parts?.[1]?.row||[];
  const series=(Array.isArray(rows)?rows:[]).map(v=>({time:String(v.WRTTIME_IDTFR_ID||''),value:Number(v.DTA_VAL),unit:String(v.UI_NM||''),region:String(v.CLS_NM||''),item:String(v.ITM_NM||'')})).filter(v=>v.time&&Number.isFinite(v.value));
  return saveCache(cacheKey,{ok:true,configured:true,provider:'rOne',series},60*60*1000);
}

export async function publicDataHandler(req,res){
  const body=parseBody(req.body),provider=String(body.provider||'');
  try{
    const value=provider==='seoul'?await seoul(body)
      :provider==='dataGoKr'?await dataGoStores(body)
      :provider==='exportImportBank'?await exportImportBank(body)
      :provider==='rOne'?await rOne(body)
      :null;
    if(!value)return send(res,400,{ok:false,error:'지원하지 않는 데이터 원천입니다.'});
    return send(res,200,value);
  }catch(e){
    if(/^INVALID_/.test(e.message))return send(res,400,{ok:false,error:'조회 조건을 확인해 주세요.'});
    safeError('public-data',e,'외부 자료 조회 실패');
    return send(res,200,{ok:false,configured:!!integrationStatus()[provider]?.configured,provider,error:'자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'});
  }
}

function includesPersonalData(value){
  const text=typeof value==='string'?value:JSON.stringify(value||{});
  return /[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,}|\b01[016789][- ]?\d{3,4}[- ]?\d{4}\b|\b\d{6}[- ]?[1-4]\d{6}\b/.test(text);
}
function geminiText(json){
  const out=[];
  for(const step of json?.steps||[])if(step?.type==='model_output')for(const part of step.content||[])if(part?.type==='text'&&part.text)out.push(part.text);
  return out.join('\n').trim();
}

export async function geminiHandler(req,res){
  const key=keyFor('GEMINI_API_KEY');
  if(!key)return send(res,200,{ok:false,configured:false,error:'AI 분석을 준비 중이에요.'});
  const body=parseBody(req.body),question=String(body.question||'').trim(),evidence=body.evidence??{};
  const evidenceText=typeof evidence==='string'?evidence:JSON.stringify(evidence);
  if(!question||question.length>600||evidenceText.length>12_000)return send(res,400,{ok:false,error:'질문이나 근거 데이터의 길이를 확인해 주세요.'});
  if(includesPersonalData(question)||includesPersonalData(evidence))return send(res,400,{ok:false,error:'이메일·전화번호 같은 개인정보는 AI 분석에 보낼 수 없습니다.'});
  const model=keyFor('GEMINI_MODEL')||'gemini-3.8-flash';
  if(!/^[a-z0-9._-]{3,80}$/i.test(model))return send(res,503,{ok:false,error:'AI 모델 설정을 확인해 주세요.'});
  const input=['당신은 소상공인 상권 데이터 해설자입니다. 제공된 근거에 없는 수치나 사실을 만들지 마세요.',
    '예측은 가능성으로 표현하고, 결론·근거·바로 할 일·한계를 짧고 자연스러운 한국어로 답하세요.',
    `질문: ${question}`,`근거 데이터: ${evidenceText}`].join('\n\n');
  try{
    const response=await fetchT(GEMINI_URL,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({model,store:false,input})},20_000);
    if(!response.ok)throw new Error('GEMINI_HTTP_'+response.status);
    const json=await boundedJson(response,1_000_000),answer=geminiText(json);
    if(!answer)throw new Error('GEMINI_EMPTY');
    return send(res,200,{ok:true,configured:true,model,answer,usage:{totalTokens:Number(json?.usage?.total_tokens||0)}});
  }catch(e){safeError('gemini',e,'AI 분석 실패');return send(res,200,{ok:false,configured:true,error:'AI 답변을 만들지 못했어요. 잠시 후 다시 시도해 주세요.'});}
}

export const endpoints=Object.freeze({KSTARTUP_URL,RONE_URL,EXIM_URL,GEMINI_URL,DATAGO_STORE_URL,SEOUL_BASE});
