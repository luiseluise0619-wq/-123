'use strict';
// 통합시세 — "지금 장사 환경이 어떻게 움직이고 있지?"
//
// 임대료·공실만 보는 화면이 아니다. 창업에 영향을 주는 바깥 사정(환율·원자재·농축수산물·
// 금리·물가)을 한 곳에서 본다.
//
// 지금 실제로 연결된 것과 아직 아닌 것
//   연결됨  상권·부동산 6가지 — 임대료·공실률·업종별 매출·자치구 소비·개폐업·프랜차이즈 비중
//           (한국부동산원 임대동향조사 · 서울시 상권분석서비스 — 이미 수집해 둔 JSON)
//   준비 중 환율·금리·물가·농산물·축산물·수산물·에너지
//           상류 API 키가 아직 없다. 목록에서 지우지 않고 '데이터 준비 중'으로 남긴다(§22).
//           가짜 그래프를 그리지 않는다.
//
// 목록을 지우지 않는 이유
//   지우면 "이 서비스는 환율을 안 다루는구나"가 되어 버린다. 남겨 두면
//   "다루는데 아직 연결이 안 됐구나"가 된다. 둘은 다른 말이다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.market = {

  MARKET_CATS(){
    return [
      {k:'zone',   label:'상권·부동산'},
      {k:'fx',     label:'환율'},
      {k:'macro',  label:'금리·물가'},
      {k:'crop',   label:'농산물'},
      {k:'meat',   label:'축산물'},
      {k:'fish',   label:'수산물'},
      {k:'energy', label:'에너지'}
    ];
  },

  // 지표 카탈로그. ready:true 면 우리가 가진 자료로 그린다.
  // ready 가 없으면 상류 연결 대기 — 화면에는 남고 '데이터 준비 중'이 붙는다.
  //   src  : 어디서 오는 자료인지(사람이 읽는 출처)
  //   need : 연결에 필요한 것(사장님이 해주셔야 하는 일)
  MARKET_INDICATORS(){
    return [
      // ── 상권·부동산 (연결됨) — 기존 시세분석 6가지를 그대로 품는다
      {k:'rent',    cat:'zone', label:'상가 임대료',      q:'이 지역 임대료는 비싼 편인가요?', ready:true,  src:'한국부동산원 상업용부동산 임대동향조사'},
      {k:'vacancy', cat:'zone', label:'빈 상가 비율',      q:'빈 가게가 늘고 있나요?',        ready:true,  src:'한국부동산원 상업용부동산 임대동향조사'},
      {k:'sales',   cat:'zone', label:'장사별 매출 추이',   q:'이 장사 시장이 크고 있나요?',    ready:true,  src:'서울시 상권분석서비스'},
      {k:'spend',   cat:'zone', label:'자치구 소비 구성',   q:'사람들이 어디에 돈을 쓰나요?',   ready:true,  src:'서울시 자치구 가구 지출'},
      {k:'churn',   cat:'zone', label:'문 열고 닫는 수',    q:'새로 생기는 곳과 닫는 곳 중 어디가 많나요?', ready:true, src:'서울시 상권분석서비스'},
      {k:'fr',      cat:'zone', label:'프랜차이즈 비중',    q:'브랜드 가게가 얼마나 많나요?',   ready:true,  src:'서울시 상권분석서비스'},

      // ── 환율 (준비 중)
      {k:'usdkrw', cat:'fx', label:'USD/KRW', q:'최근 환율은 어떻게 움직였나요?', src:'한국은행 ECOS', need:'ECOS_KEY'},
      {k:'jpykrw', cat:'fx', label:'JPY/KRW', q:'엔화는 어떻게 움직였나요?',    src:'한국은행 ECOS', need:'ECOS_KEY'},
      {k:'cnykrw', cat:'fx', label:'CNY/KRW', q:'위안화는 어떻게 움직였나요?',   src:'한국은행 ECOS', need:'ECOS_KEY'},
      {k:'eurkrw', cat:'fx', label:'EUR/KRW', q:'유로는 어떻게 움직였나요?',    src:'한국은행 ECOS', need:'ECOS_KEY'},

      // ── 금리·물가 (준비 중)
      {k:'baserate', cat:'macro', label:'기준금리',   q:'금리는 오르고 있나요?',       src:'한국은행 ECOS', need:'ECOS_KEY'},
      {k:'cpi',      cat:'macro', label:'소비자물가', q:'물가는 얼마나 올랐나요?',      src:'한국은행 ECOS', need:'ECOS_KEY'},
      {k:'ppi',      cat:'macro', label:'생산자물가', q:'원가 압력이 커지고 있나요?',   src:'한국은행 ECOS', need:'ECOS_KEY'},

      // ── 농산물 (준비 중)
      {k:'rice',    cat:'crop', label:'쌀',    q:'쌀값은 어떻게 움직였나요?',   src:'aT KAMIS 농산물유통정보', need:'KAMIS_KEY'},
      {k:'cabbage', cat:'crop', label:'배추',  q:'배추값은 어떻게 움직였나요?', src:'aT KAMIS 농산물유통정보', need:'KAMIS_KEY'},
      {k:'onion',   cat:'crop', label:'양파',  q:'양파값은 어떻게 움직였나요?', src:'aT KAMIS 농산물유통정보', need:'KAMIS_KEY'},
      {k:'garlic',  cat:'crop', label:'마늘',  q:'마늘값은 어떻게 움직였나요?', src:'aT KAMIS 농산물유통정보', need:'KAMIS_KEY'},
      {k:'pepper',  cat:'crop', label:'고추',  q:'고춧값은 어떻게 움직였나요?', src:'aT KAMIS 농산물유통정보', need:'KAMIS_KEY'},

      // ── 축산물 (준비 중)
      {k:'pork',    cat:'meat', label:'돼지고기', q:'돼지고기값은 어떻게 움직였나요?', src:'축산물품질평가원', need:'KAMIS_KEY'},
      {k:'beef',    cat:'meat', label:'소고기',   q:'소고기값은 어떻게 움직였나요?',   src:'축산물품질평가원', need:'KAMIS_KEY'},
      {k:'chicken', cat:'meat', label:'닭고기',   q:'닭고기값은 어떻게 움직였나요?',   src:'축산물품질평가원', need:'KAMIS_KEY'},
      {k:'egg',     cat:'meat', label:'계란',     q:'계란값은 어떻게 움직였나요?',     src:'축산물품질평가원', need:'KAMIS_KEY'},

      // ── 수산물 (준비 중)
      {k:'squid',   cat:'fish', label:'오징어', q:'오징어값은 어떻게 움직였나요?', src:'aT KAMIS 수산물', need:'KAMIS_KEY'},
      {k:'mackerel',cat:'fish', label:'고등어', q:'고등어값은 어떻게 움직였나요?', src:'aT KAMIS 수산물', need:'KAMIS_KEY'},
      {k:'laver',   cat:'fish', label:'김',     q:'김값은 어떻게 움직였나요?',     src:'aT KAMIS 수산물', need:'KAMIS_KEY'},

      // ── 에너지 (준비 중)
      {k:'oil',     cat:'energy', label:'국제유가', q:'기름값은 어떻게 움직였나요?', src:'한국석유공사 오피넷', need:'OPINET_KEY'},
      {k:'gasoline',cat:'energy', label:'휘발유',   q:'휘발유값은 어떻게 움직였나요?', src:'한국석유공사 오피넷', need:'OPINET_KEY'},
      {k:'diesel',  cat:'energy', label:'경유',     q:'경윳값은 어떻게 움직였나요?',   src:'한국석유공사 오피넷', need:'OPINET_KEY'},
      {k:'lpg',     cat:'energy', label:'LPG',     q:'LPG 값은 어떻게 움직였나요?',   src:'한국석유공사 오피넷', need:'OPINET_KEY'}
    ];
  },

  // 지금 보는 지표 하나. 담아 두는 목록(관심지표)은 없앴다 —
  // 갈래가 왼쪽에 늘 세로로 보이므로 '담아 둘' 이유가 사라졌다.
  // 지표를 바꾸면 목록에서 고른 지역·업종(prPick)도 같이 푼다 —
  // 임대료에서 고른 상권 이름을 매출 화면이 그대로 물려받을 이유가 없다.
  marketPick(k){ this.setState({mkSel:k, prPick:null}); }
};

// 화면 — 왼쪽 세로 목록(갈래 → 지표)에서 하나를 고르고, 오른쪽에서 차트를 가로로 넘긴다.
// 고르는 곳이 한 군데뿐이라 '갈래'와 '지표'가 서로 어긋날 일이 없다.
globalThis.MysbizonParts.market.marketView = function(){
  const S=this.state;
  const ALL=this.MARKET_INDICATORS();
  const CATS=this.MARKET_CATS();
  const byKey={}; ALL.forEach(i=>{ byKey[i.k]=i; });

  // 지금 보는 지표. 처음 열면 상가 임대료.
  const selKey=(S.mkSel && byKey[S.mkSel]) ? S.mkSel : 'rent';
  const sel=byKey[selKey];
  // 갈래는 고른 지표를 따라간다 — 따로 고르게 하면 둘이 어긋난다
  const cat=sel.cat;

  const mob=this.bp()==='mobile';

  // 데스크톱 — 왼쪽 세로 목록(갈래 → 지표). 모바일 — 가로 탭 두 줄(§25·§26).
  const catStyle=on=> mob
    ? 'flex:none;scroll-snap-align:start;padding:9px 15px;border-radius:999px;cursor:pointer;'
      +'font-size:14px;white-space:nowrap;transition:background .14s,color .14s;'
      +(on?'background:var(--accent);color:#FFFFFF;font-weight:600'
          :'background:var(--surface);color:var(--ink2)')
    : 'display:block;padding:11px 13px;border-radius:var(--r-sm);cursor:pointer;font-size:14.5px;'
      +'font-weight:700;letter-spacing:-.01em;transition:color .14s;'
      +'overflow:hidden;text-overflow:ellipsis;'
      +(on?'color:var(--ink)':'color:var(--ink3)');
  const indStyle=on=> mob
    ? 'flex:none;scroll-snap-align:start;padding:6px 2px;cursor:pointer;font-size:14px;'
      +'white-space:nowrap;transition:color .14s;border-bottom:2px solid '
      +(on?'var(--accent);color:var(--ink);font-weight:700':'transparent;color:var(--ink3)')
    : 'display:block;margin-left:8px;padding:10px 13px;border-radius:var(--r-sm);cursor:pointer;'
      +'font-size:14.5px;transition:background .14s,color .14s;overflow:hidden;text-overflow:ellipsis;'
      +(on?'background:var(--accent-3);color:var(--accent);font-weight:700':'color:var(--ink2)');

  // 데스크톱 세로 목록 — 갈래를 누르면 그 갈래의 지표가 아래로 펼쳐진다
  const side=[];
  CATS.forEach(c=>{
    const items=ALL.filter(i=>i.cat===c.k);
    side.push({label:c.label, pick:()=>this.marketPick((items[0]||sel).k), style:catStyle(c.k===cat)});
    if(c.k===cat) items.forEach(i=>{
      side.push({label:i.label, pick:()=>this.marketPick(i.k), style:indStyle(i.k===selKey)});
    });
  });

  return {
    // 모바일은 가로 탭 두 줄, 데스크톱은 왼쪽 세로 목록 — 같은 목록을 모양만 바꾼다
    horiz:mob, vert:!mob,
    side,
    cats:CATS.map(c=>{
      const items=ALL.filter(i=>i.cat===c.k);
      return {label:c.label, pick:()=>this.marketPick((items[0]||sel).k), style:catStyle(c.k===cat)};
    }),
    inds:ALL.filter(i=>i.cat===cat).map(i=>({
      label:i.label, pick:()=>this.marketPick(i.k), style:indStyle(i.k===selKey)})),
    tabTrack:'display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;'
      +'scrollbar-width:none;padding:2px 0 6px;min-width:0',
    indTrack:'display:flex;gap:18px;overflow-x:auto;scroll-snap-type:x proximity;'
      +'scrollbar-width:none;padding:0 0 4px;min-width:0',
    cols:this.L('1fr','188px minmax(0,1fr)','224px minmax(0,1fr)'),
    gap:this.L('0','18px','24px'),
    sideStyle:this.ds('card')+';align-self:start;padding:10px;min-width:0',
    // 지금 보는 지표
    selKey, selLabel:sel.label, selQuestion:sel.q, selSrc:sel.src,
    ready:!!sel.ready,
    waiting:!sel.ready,
    waitTitle:this.t('mk.waitTitle',{name:this.tr(sel.label)}),
    waitText:this.t('mk.waitText',{src:this.tr(sel.src)})
  };
};
