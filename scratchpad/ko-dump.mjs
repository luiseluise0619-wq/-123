import fs from 'node:fs';
import vm from 'node:vm';
const R='/home/user/-123/';
const read = rel => fs.readFileSync(R+rel,'utf8');
const j = rel => JSON.parse(read(rel));
const KO=j('frontend/locales/ko.json'), EN=j('frontend/locales/en.json'), ZH=j('frontend/locales/zh-CN.json');
const LOGIC_PARTS = ['const','i18n','theme','roman','util','design','rank','analysis','screens','chat','charts','carousel','market','views'];
function component(locale){
  const source = LOGIC_PARTS.map(n=>read('frontend/logic/'+n+'.js')).join('\n')+'\n'+read('frontend/app-logic.js');
  const context={DCLogic:class{setState(v){this.state={...this.state,...v};}},window:{innerWidth:1200},console,URL,
    document:{documentElement:{getAttribute(){return null;}}},setTimeout,clearTimeout};
  vm.createContext(context);
  vm.runInContext(source+';globalThis.Component=MysbizonLogic(DCLogic)',context);
  const c=new context.Component(); c._dict={ko:KO,en:EN,'zh-CN':ZH}; c.state.locale=locale; return c;
}
function loaded(locale){
  const c=component(locale);
  const zlp=j('frontend/data/v3/zone_livepop.json').zone;
  Object.assign(c.state,{zi:j('frontend/data/v3/zone_industry.json'),sbi:j('frontend/data/v3/sales_by_industry.json'),
    sti:j('frontend/data/v3/stores_by_industry.json'),zgu:j('frontend/data/v3/zone_gu.json').gu,
    zbd:j('frontend/data/v3/zone_border.json').border,smap:j('frontend/data/v3/seoul_map.json'),
    zlp:Object.fromEntries(Object.entries(zlp||{}).filter(([,v])=>v&&Number.isFinite(v.tot)&&v.tot>0&&Array.isArray(v.age)&&v.age.length===6&&v.age.every(Number.isFinite))),
    rentStats:j('frontend/data/v3/rent.json'),salesHistory:j('frontend/data/v3/sales_history.json'),
    income:j('frontend/data/v3/income.json'),zchg:j('frontend/data/v3/zone_change.json'),zsim:j('frontend/data/v3/zone_sim.json').zone});
  return c;
}
const SCREEN_KEYS=['home','hubZone','zone','find','region','fineCmp','hubFine','fineIntro','map','fineDetail','sim','diag','price','report'];
function isPlainObject(v){if(!v||typeof v!=='object')return false;const p=Object.getPrototypeOf(v);return p===null||(p.constructor&&p.constructor.name==='Object');}
const MACHINE_KEY=k=>k==='v'||k==='raw'||/Value$/.test(k);
function koreanIn(v,acc,d,path){
  if(d>9)return acc;
  if(typeof v==='string'){ if(/[가-힣]/.test(v)) acc.push([v,path]); return acc; }
  if(Array.isArray(v)){v.forEach((x,i)=>koreanIn(x,acc,d+1,path));return acc;}
  if(isPlainObject(v)){for(const k in v) if(!MACHINE_KEY(k)) koreanIn(v[k],acc,d+1,path+'.'+k);return acc;}
  return acc;
}
const seed=loaded('ko'); const ids=Object.keys(seed.state.zi.zones||{});
const RP=10;
const surveyAt=n=>c=>{Object.assign(c.state,{rp_sido:'서울',rp_gu:'마포구',rp_ind:'커피-음료',rp_stage:'아직 준비 중이에요 (예비창업자)',rp_age:'만 39세 이하',rp_biz:'아직 안 했어요',rp_when:'6개월 안',rp_need:'사업화 자금',rp_cost:'입력함',rp_email:'a@b.com',rp_step:n});};
const picks=[c=>{},c=>{c.state.sel=ids[0];c.state.zoneId=ids[0];c.state.picks=ids.slice(0,3);},
  c=>{c.state.sel=ids[5];c.state.zoneId=ids[5];c.state.picks=ids.slice(2,5);c.state.ind='한식음식점';},
  ...Array.from({length:RP},(_,n)=>surveyAt(n))];
const found=new Map();
for(const screen of SCREEN_KEYS) for(const pick of picks){
  const c=loaded('ko'); c.state.screen=screen; pick(c);
  koreanIn(c.renderVals(),[],0,screen).forEach(([s,p])=>{ if(!found.has(s)) found.set(s,p); });
}
const out=[...found.entries()].sort((a,b)=>a[1].localeCompare(b[1])||a[0].localeCompare(b[0]));
console.log(out.length+' strings');
for(const [s,p] of out) console.log(p+'\t'+JSON.stringify(s));
