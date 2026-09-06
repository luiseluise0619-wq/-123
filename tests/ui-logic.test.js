import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 브라우저는 index.html 의 <script> 순서대로 조각들을 먼저 읽고 app-logic.js 를 읽는다.
// 테스트도 같은 순서로 읽어야 실제와 같은 상태가 된다.
const LOGIC_PARTS=['const','i18n','theme','roman','util','design','rank','analysis','screens','chat','charts','carousel','market','views'];

function component() {
  const read=rel=>fs.readFileSync(new URL(rel,import.meta.url),'utf8');
  const source=LOGIC_PARTS.map(n=>read('../frontend/logic/'+n+'.js')).join('\n')
    +'\n'+read('../frontend/app-logic.js');
  const context={DCLogic:class {setState(value){this.state={...this.state,...value};}},window:{innerWidth:1200},console,URL,document:{documentElement:{getAttribute(){return null;}}},setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(source+';globalThis.Component=MysbizonLogic(DCLogic)',context);
  const instance=new context.Component();
  return {instance,context};
}
test('동점 순위는 입력 순서와 무관하고 한 개 표본은 중립 점수',()=>{
  const {instance:c}=component();
  c.state.zi={inds:['커피-음료'],zones:{a:{nm:'A',rows:[[0,10,90000000,5000]]},b:{nm:'B',rows:[[0,10,90000000,5000]]}},n_zones:2};
  const rows=c.rank().list;assert.equal(rows[0].score,rows[1].score);
  c.state.zi={...c.state.zi,zones:{a:c.state.zi.zones.a}};assert.equal(c.rank().list[0].score,50);
});
test('비정상 입력에서도 손익 계산이 NaN/Infinity/음수 고정비로 무너지지 않는다',()=>{
  const {instance:c}=component();
  for(const bad of [NaN,Infinity,-Infinity,-999,'bad',null,'']) {
    Object.assign(c.state,{area:bad,rent:bad,staffOv:bad,etcOv:bad,cogs:bad});
    const result=c.calc({per:90000000});
    for(const k of ['bep','fixed','labor','rev','profit'])assert.ok(Number.isFinite(result[k]),k);
    assert.ok(result.fixed>=0);assert.ok(result.area>=1);
  }
});
test('실데이터로 모든 화면 view model 생성과 미리보기 계산을 실행한다',()=>{
  const {instance:c,context}=component();
  const data=name=>JSON.parse(fs.readFileSync(new URL('../frontend/data/v3/'+name+'.json',import.meta.url),'utf8'));
  Object.assign(c.state,{zi:data('zone_industry'),sbi:data('sales_by_industry'),sti:data('stores_by_industry'),zgu:data('zone_gu').gu,zbd:data('zone_border').border,smap:data('seoul_map'),zlp:data('zone_livepop').zone,rentStats:data('rent'),salesHistory:data('sales_history'),income:data('income')});
  // rent state is also used as numeric user input by the original template; keep an input value here.
  for(const screen of ['home','hubZone','hubFine','find','diag','cmp','map','fineCmp','fineIntro','zone','price','report']) {
    c.state.screen=screen;assert.ok(c.renderVals(),screen);
  }
  let payload;
  context.sessionStorage={setItem(k,v){if(k==='mysbizon.report')payload=JSON.parse(v);}};
  context.location={href:''};
  c.renderVals().rp.preview();
  assert.ok(payload.bep.length);assert.ok(!payload.bep[1].value.startsWith('0만'));
  assert.equal(context.location.href,'report-print.html');
});

test('62개 업종·13개 화면을 실제 자료로 계산하며 비정상 숫자를 출력하지 않는다',()=>{
  const {instance:c}=component();const data=n=>JSON.parse(fs.readFileSync(new URL('../frontend/data/v3/'+n+'.json',import.meta.url),'utf8'));
  Object.assign(c.state,{zi:data('zone_industry'),sbi:data('sales_by_industry'),sti:data('stores_by_industry'),zgu:data('zone_gu').gu,zbd:data('zone_border').border,smap:data('seoul_map'),zlp:data('zone_livepop').zone,rentStats:data('rent'),salesHistory:data('sales_history'),income:data('income')});
  const screens=['home','hubZone','hubFine','find','diag','cmp','map','fineCmp','fineIntro','zone','price','report','region'];
  for(const ind of c.state.zi.inds){c.state.ind=ind;const ranked=c.rank();if(!ranked)continue;c.state.sel=ranked.list[0].id;c.state.zoneId=c.state.sel;
    for(const screen of screens){c.state.screen=screen;const view=c.renderVals();const json=JSON.stringify(view);assert.ok(!/NaN|Infinity|undefined/.test(json),ind+' '+screen);}
  }
});

test('자료 없음·지원하지 않는 업종에서도 오류 안내용 화면 생성',()=>{
  const {instance:c}=component();
  for(const ind of ['없는 업종','',null]){c.state.ind=ind;for(const screen of ['home','find','map','diag','price','report','region']){c.state.screen=screen;assert.ok(c.renderVals(),screen);}}
});

test('매출 시나리오는 손익만 바꾸고 같은 고정비의 본전선은 유지',()=>{
  const {instance:c}=component();const sample={per:300000000,unit:5000};
  c.state.scen='보통일 때';const normal=c.calc(sample);c.state.scen='적게 팔릴 때';const low=c.calc(sample);c.state.scen='잘될 때';const high=c.calc(sample);
  assert.equal(low.rev,normal.rev*.7);assert.equal(high.rev,normal.rev*1.3);assert.equal(low.bep,normal.bep);assert.ok(low.profit<normal.profit&&normal.profit<high.profit);
});
