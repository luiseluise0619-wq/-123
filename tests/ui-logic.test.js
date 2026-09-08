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
  // 리포트 결과물(PDF·CSV·메일)에는 설문 답 + 지원사업 + 손익이 들어간다.
  // 화면(리포트 탭)에는 손익을 그리지 않는다 — 사장님 지시 2026-09-07.
  Object.assign(c.state,{rp_sido:'서울',rp_gu:'마포구',rp_ind:'커피-음료',
    rp_stage:'아직 준비 중이에요 (예비창업자)',rp_age:'만 39세 이하'});
  c.renderVals().rp.preview();
  assert.equal(context.location.href,'report-print.html');
  assert.ok(payload.survey.length,'설문 답이 담겨야 한다');
  assert.equal(payload.survey[0].value,'서울 마포구');
  assert.ok(payload.bep.length,'손익이 리포트 결과물에 담겨야 한다');
  assert.ok(!payload.bep[1].value.startsWith('0만'),'월매출 가정이 0 이면 안 된다');
  // 화면 쪽에는 손익 view model 이 없어야 한다(예전 rv 블록은 지웠다)
  assert.equal(c.renderVals().rp.rv,undefined,'리포트 화면에 손익이 되살아났다');
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

// 칸을 비우면 '0' 이 아니라 기본 가정으로 돌아가야 한다.
// 임대료를 비웠을 때 0 으로 치면 본전선이 1,523 → 908만원 으로 떨어지는데
// 화면 꼬리표는 그대로 '기본 400만원' 이라, 값과 설명이 어긋난다.
test('본전 계산 입력칸을 비우면 기본 가정으로 돌아간다',()=>{
  const {instance:c}=component();
  const sample={per:300000000,unit:5000};
  const base=c.calc(sample);
  for(const [k,read] of [['rent',r=>r.rent],['cogs',r=>r.cogs],['area',r=>r.area]]){
    const keep=c.state[k];
    c.state[k]='';                       // 칸을 비운 상태
    assert.equal(read(c.calc(sample)),read(base), k+' 를 비웠더니 기본 가정과 달라졌다');
    c.state[k]=null;
    assert.equal(read(c.calc(sample)),read(base), k+' 가 null 일 때 기본 가정과 달라졌다');
    c.state[k]=keep;
  }
  // 0 을 **직접 넣은** 것은 그대로 0 이어야 한다(비운 것과 다르다)
  c.state.rent=0;
  assert.equal(c.calc(sample).rent,0,'직접 넣은 0 이 기본값으로 바뀌면 안 된다');
});
test('공고 금액 글자에서 단위가 붙은 숫자만 읽는다',()=>{
  const {instance:c}=component();
  const cases=[['최대 5,000만원',5e7],['1억원',1e8],['1억 5,000만원',1.5e8],['3천만원',3e7],
    ['1,000~5,000만원',5e7],['1,000천원',1e6],['10000000원',1e7],
    // 단위가 없는 숫자를 금액으로 읽으면 안 된다 — 연도·업력·자부담 비율
    ['2026년 최대 300만원',3e6],['업력 3년 이내 최대 2억원',2e8],['최대 100만원(자부담 20%)',1e6],
    // 읽어낼 수 없으면 null. 0 원짜리 금액도 값으로 세지 않는다.
    ['별도 협의',null],['5000',null],['3년',null],['0원',null],['',null],[null,null],
    // 실제 공고에 나오는 꼴들
    ['1억5000만원',1.5e8],['5000만원~1억원',1e8],['총 사업비의 70% 이내, 최대 5천만원',5e7],
    ['최대 30,000천원',3e7],['4,000만 원 이내',4e7],['3억원 한도',3e8],['연 2.0% 이내',null],
    // 숫자 없이 단위만 쓴 꼴은 **일부러** 안 읽는다. '원'·'만' 은 보통 낱말에도 흔해서
    // (지원금·병원·만족) 숫자에 붙지 않은 단위를 금액으로 읽으면 엉뚱한 값이 나온다.
    ['천만원',null],['백만원',null]];
  for(const [text,want] of cases) assert.equal(c.wonParse(text),want,JSON.stringify(text));
});
test('최대 지원금은 화면에 뜬 공고에서만 뽑고, 못 읽으면 줄 자체가 없다',()=>{
  const {instance:c}=component();
  const item=(title,amount)=>({title,org:'테스트기관',amount,deadline:'2099-12-31',url:'https://example.com',
    target:'예비창업자',kind:'사업화',content:'',region:'서울'});
  c.state.screen='report'; c.state.rp_stage='아직 준비 중이에요 (예비창업자)';
  c.state.sp={ok:true,configured:true,items:[item('가',' 최대 3,000만원'),item('나','1억원'),item('다','별도 협의')]};
  const sp=c.renderVals().rp.sp;
  assert.equal(sp.hasMax,true); assert.equal(sp.maxAmount,'최대 1억원'); assert.equal(sp.maxFrom,'나');
  // 금액을 하나도 못 읽으면 아무 숫자도 만들지 않는다(§1)
  c.state.sp={ok:true,configured:true,items:[item('가','별도 협의'),item('나','')]};
  const sp2=c.renderVals().rp.sp;
  assert.equal(sp2.hasMax,false); assert.equal(sp2.maxAmount,'');
});
test('모양이 다른 자료 파일을 걸러 낸다',()=>{
  const {instance:c}=component();
  // 파싱은 되지만 모양이 다른 것들 — 수집기가 중간에 죽으면 실제로 이런 파일이 커밋된다.
  for(const bad of [null,undefined,0,'',[],'hello',{},{zones:{}},{zones:[],inds:[]},{inds:[]}])
    assert.equal(c.dataShapeOk('zi',bad),false,JSON.stringify(bad));
  assert.equal(c.dataShapeOk('zi',{zones:{a:{}},inds:['커피-음료']}),true);
  for(const bad of [{},{ind:5},{ind:[]},[]]) assert.equal(c.dataShapeOk('ind',bad),false);
  assert.equal(c.dataShapeOk('ind',{ind:{'커피-음료':{}}}),true);
  for(const bad of [{},{zone:[1,2]},'x']) assert.equal(c.dataShapeOk('zone',bad),false);
  assert.equal(c.dataShapeOk('zone',{zone:{a:1}}),true);
  assert.equal(c.dataShapeOk('gu',{gu:{a:'강남구'}}),true);
  assert.equal(c.dataShapeOk('gu',{gu:null}),false);
  // 지도는 좌표와 경계가 둘 다, 매출 추이는 업종값과 분기 목록이 짝으로 있어야 한다
  for(const bad of [{},{pts:{}},{gus:{}},{pts:[],gus:{}}]) assert.equal(c.dataShapeOk('map',bad),false);
  assert.equal(c.dataShapeOk('map',{pts:{a:[1,2]},gus:{'강남구':{d:'M0'}}}),true);
  for(const bad of [{},{ind:{}},{quarters:[]},{ind:{},quarters:'x'}]) assert.equal(c.dataShapeOk('hist',bad),false);
  assert.equal(c.dataShapeOk('hist',{ind:{'커피-음료':{}},quarters:['20261']}),true);
});
