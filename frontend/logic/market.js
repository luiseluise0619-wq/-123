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

  marketFilter(label, choices, selected, apply){
    return {
      label:this.t(label), value:String(Math.max(0, choices.findIndex(o=>o.key===selected))),
      options:choices.map((o,i)=>({value:String(i), label:o.label})),
      change:e=>{ const i=Number(e.target.value); if(Number.isInteger(i)&&choices[i]) apply(choices[i].key); }
    };
  },

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
      +(on?'background:var(--accent);color:var(--on-accent);font-weight:600'
          :'background:var(--surface);color:var(--ink2)')
    : 'display:block;padding:11px 13px;border-radius:var(--r-sm);cursor:pointer;font-size:14.5px;'
      +'font-weight:700;letter-spacing:-.01em;transition:color .14s;'
      +'overflow:hidden;text-overflow:ellipsis;'
      +(on?'color:var(--ink)':'color:var(--ink3)');
  const indStyle=on=> mob
    ? 'flex:none;scroll-snap-align:start;padding:6px 12px;min-width:44px;text-align:center;cursor:pointer;font-size:14px;'
      +'white-space:nowrap;transition:color .14s;border-bottom:2px solid '
      +(on?'var(--accent);color:var(--ink);font-weight:700':'transparent;color:var(--ink3)')
    : 'display:block;margin-left:8px;padding:10px 13px;border-radius:var(--r-sm);cursor:pointer;'
      +'font-size:14.5px;transition:background .14s,color .14s;overflow:hidden;text-overflow:ellipsis;'
      +(on?'background:var(--accent-3);color:var(--accent-hover);font-weight:700':'color:var(--ink2)');

  // 연결된 지표가 하나도 없는 갈래는 목록에 안 세운다 — 누르면 '준비 중'만 뜨는 항목 22개가
  // 목록을 세 배로 늘리고 있었다. 대신 아래 한 줄로 무엇이 준비 중인지 말한다(지어내지 않는다 §1).
  const readyCats=CATS.filter(c=>ALL.some(i=>i.cat===c.k&&i.ready));
  const waitCats=CATS.filter(c=>!ALL.some(i=>i.cat===c.k&&i.ready));
  // 데스크톱 세로 목록 — 갈래를 누르면 그 갈래의 지표가 아래로 펼쳐진다
  const side=[];
  readyCats.forEach(c=>{
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
    hasWaitingNote:waitCats.length>0,
    waitingNote:this.t('mk.waitingCats',{names:waitCats.map(c=>this.tr(c.label)).join(' · ')}),
    cats:readyCats.map(c=>{
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

// 공개 통계 기반 시세 화면. 외부 market API는 연결하지 않는다.
globalThis.MysbizonParts.market.priceView = function(){
    const PRICE_CATS=globalThis.MysbizonConst.PRICE_CATS;
    const S=this.state;
    // 세로 목록에서 고른 지표가 우리 자료로 그릴 수 있는 것이면 그것을 따른다.
    // (환율·농산물처럼 아직 연결 안 된 지표는 여기 오지 않고 '준비 중' 카드가 뜬다.)
    const cat=(S.mkSel && PRICE_CATS.some(c=>c.k===S.mkSel)) ? S.mkSel : (S.prCat||'rent');
    const meta=PRICE_CATS.find(c=>c.k===cat)||PRICE_CATS[0];
    const R=S.rentStats, HI=S.salesHistory, ST=S.sti, IC=S.income;
    const out={
      cat, catLabel:meta.label, when:meta.when,
      title:'', now:'', nowLabel:'', delta:'', deltaStyle:'display:none',
      charts:[], hasCharts:false, note:'', missing:'', hasMissing:false,
      list:[], listTitle:'', hasList:false, filters:[], filterNote:'',
      // 자료를 못 불러와 일찍 돌아가는 갈래에서도 값이 비지 않게 미리 넣어 둔다
      chartCount:'', noteBox:this.dataNote('pr','',[]),
      rail:this.rail('price', {per:1, peek:false, arrows:true})
    };
    const C=[];   // 이 카테고리의 차트들
    const push=(id,opt)=>{ const c=this.chartCard(id,opt); if(c) C.push(c); };

    // ── 임대료 · 공실률 (한국부동산원 임대동향조사) ────────────────
    if(cat==='rent'||cat==='vacancy'){
      if(!R||!Array.isArray(R.quarters)||!R.quarters.length||!R.zones){
        out.note='임대료 자료를 아직 불러오지 못했어요.'; return out;
      }
      const isRent=cat==='rent';
      const allZones=Object.values(R.zones);
      const gwons=[...new Set(allZones.map(o=>o.gwon).filter(Boolean))];
      const gwon=gwons.includes(S.prGwon)?S.prGwon:'';
      const zones=gwon?allZones.filter(o=>o.gwon===gwon):allZones;
      // 여기는 '통합'시세다 — 기본은 서울 전체다. 목록 첫 줄(명동)이 기본일 이유가 없다.
      // 아래 목록에서 상권을 고르면 그때 그 상권으로 바뀐다.
      const wanted=S.prZone||S.prPick;
      const z=zones.find(o=>o.nm===wanted)||(gwon?zones[0]:null);
      const seoulName=this.t('pr.seoulAll');
      out.filters=[
        this.marketFilter('market.area',[{key:'',label:seoulName},...gwons.map(g=>({key:g,label:this.placeName(g)}))],gwon,
          g=>this.setState({prGwon:g,prZone:null,prPick:null})),
        this.marketFilter('market.zone',[...(!gwon?[{key:'',label:seoulName}]:[]),...zones.map(o=>({key:o.nm,label:this.placeName(o.nm)}))],z?z.nm:'',
          n=>this.setState({prZone:n,prPick:n||null}))
      ];
      out.filterNote=this.t('market.rentScope');
      const subjectName = z? this.placeName(z.nm) : seoulName;
      const trend=(z? (isRent? z.rent_trend : z.vacancy_trend)
                    : (R.seoul? (isRent? R.seoul.rent_trend : R.seoul.vacancy_trend) : []))||[];
      const qs=R.quarters, qLabel=q=>String(q).replace('년 ','.').replace('분기','Q');
      const val=z? (isRent? z.rent : z.vacancy)
                 : (R.seoul? (isRent? R.seoul.rent : R.seoul.vacancy) : null);
      const first=trend[0], last=trend[trend.length-1];
      const d=(isFinite(first)&&isFinite(last))? last-first : null;

      out.title=subjectName+' · '+this.t(isRent?'pr.rentUnit':'pr.vacancy');
      out.now=(val==null?'—':(isRent? this.manF(val,1) : val.toFixed(1)+'%'));
      out.nowLabel=qs[qs.length-1];
      if(d!=null){
        // 임차인에게 임대료 상승은 나쁜 값이다 — 부호가 아니라 뜻으로 색을 정한다
        const bad=isRent? d>0 : d>0;
        out.delta=(d>0?'▲ ':'▼ ')+(isRent? this.manF(Math.abs(d),1) : Math.abs(d).toFixed(1)+'%p')
          +' · '+this.t('pr.vs2y');
        out.deltaStyle='font-size:13.5px;font-weight:700;line-height:1.4;color:'
          +(Math.abs(d)<0.05?'var(--ink3)':(bad?'var(--warn)':'var(--good)'));
      }
      // ① 이 상권의 추이
      push('pr-trend',{type:'line',
        title:this.t(isRent?'pr.trendRent':'pr.trendVac',{name:subjectName}),
        sub:this.t(isRent?'pr.rentUnit':'pr.vacancy'),
        unit:isRent?'만원':'%', period:qs[0]+' ~ '+qs[qs.length-1], height:230,
        labels:qs.map(qLabel), datasets:[{label:subjectName, data:trend}]});
      // ② 상권별 비교 — 상위 12곳
      const rankBy=zones.slice().filter(o=>isFinite(isRent?o.rent:o.vacancy))
        .sort((a,b)=> (isRent? b.rent-a.rent : b.vacancy-a.vacancy)).slice(0,12);
      push('pr-zones',{type:'hbar', title:this.t(isRent?'pr.cmpRent':'pr.cmpVac'),
        sub:'높은 순 '+rankBy.length+'곳', unit:isRent?'만원':'%', period:qs[qs.length-1], height:300,
        labels:rankBy.map(o=>this.placeName(o.nm)),
        datasets:[{label:this.t(isRent?'pr.rentUnit':'pr.vacancy'),
          data:rankBy.map(o=>isRent?o.rent:o.vacancy),
          colors:rankBy.map(o=>o.nm===(z&&z.nm)?'on':'')}]});
      // ③ 서울 전체 추이 — 이 상권이 흐름을 따라가는지 견준다
      if(R.seoul && z){
        const st=isRent?R.seoul.rent_trend:R.seoul.vacancy_trend;
        push('pr-seoul',{type:'line', title:this.t(isRent?'pr.seoulRent':'pr.seoulVac'),
          sub:'같은 기간 서울 평균', unit:isRent?'만원':'%',
          period:qs[0]+' ~ '+qs[qs.length-1], height:230,
          labels:qs.map(qLabel), datasets:[{label:'서울 평균', data:st}]});
      }
      // ④ 임대료를 볼 때 공실률도 같이 본다(반대도 마찬가지) — 서로 다른 질문
      if(z){
        const other=isRent? z.vacancy_trend : z.rent_trend;
        push('pr-other',{type:'line',
          title:this.t(isRent?'pr.trendVac':'pr.trendRent',{name:this.placeName(z.nm)}),
          sub:isRent?'임대료가 오를 때 빈 상가도 느는지':'공실이 늘 때 임대료가 내리는지',
          unit:isRent?'%':'만원', period:qs[0]+' ~ '+qs[qs.length-1], height:230,
          labels:qs.map(qLabel), datasets:[{label:this.placeName(z.nm), data:other||[]}]});
      }
      const rowStyle=on=>'display:flex;align-items:center;gap:12px;padding:12px 14px;'
        +'border-radius:var(--r-sm);cursor:pointer;'+(on?'background:var(--accent-3)':'');
      out.listTitle='상권 '+zones.length+'곳';
      out.list=[
        // 맨 위는 언제나 서울 전체 — 상권을 골랐다가 종합으로 되돌아올 수 있어야 한다
        ...(R.seoul&&!gwon? [{name:seoulName, meta:'',
            value:(isRent? this.manF(R.seoul.rent||0,1) : (R.seoul.vacancy||0).toFixed(1)+'%'),
            pick:()=>this.setState({prPick:null,prZone:null}), style:rowStyle(!z)}] : []),
        ...zones.slice().sort((a,b)=>(isRent?b.rent-a.rent:b.vacancy-a.vacancy)).map(o=>({
          name:this.placeName(o.nm), meta:this.placeName(o.gwon||''),
          value:(isRent? this.manF(o.rent||0,1) : (o.vacancy||0).toFixed(1)+'%'),
          pick:()=>this.setState({prPick:o.nm,prZone:o.nm}),
          style:rowStyle(o.nm===(z&&z.nm))}))];
      out.note='한국부동산원 상업용부동산 임대동향조사(중대형 상가). '+R.unit
        +'. 이 조사의 상권 구획은 서울시 상권분석의 상권 1,564곳과 다른 지리라, 권역 수준의 참고값이에요.';
    }

    // ── 업종별 매출 추이 (서울 전체) ──────────────────────────────
    else if(cat==='sales'){
      if(!HI||!HI.ind){ out.note='매출 추이 자료를 아직 불러오지 못했어요.'; return out; }
      const inds=Object.keys(HI.ind);
      const pick=[S.prIndustry,S.prPick,S.ind].find(n=>HI.ind[n])||inds[0];
      out.filters=[this.marketFilter('market.industry',inds.map(n=>({key:n,label:this.indName(n)})),pick,
        n=>this.setState({prIndustry:n,prPick:n}))];
      out.filterNote=this.t('market.seoulScope');
      const qs=HI.quarters, series=qs.map(q=>HI.ind[pick][q]??null);
      const qLabel=q=>String(q).slice(0,4)+'.'+String(q).slice(4)+'Q';
      const cur=series.filter(v=>v!=null).slice(-1)[0];
      const prev=series.filter(v=>v!=null).slice(-5)[0];
      // 업종 이름이 앞에 붙으면 통째로는 사전에서 못 찾는다 — 조각마다 옮긴 뒤 잇는다
      out.title=this.tr(this.indName(pick))+' · '+this.tr('서울 전체 분기 매출');
      out.now=this.won(cur);
      out.nowLabel=this.qtr(qs[qs.length-1]);
      if(cur&&prev){
        const g=Math.round((cur-prev)/prev*100);
        out.delta=(g>0?'▲ ':'▼ ')+Math.abs(g)+'% · 1년 전 대비';
        out.deltaStyle='font-size:13.5px;font-weight:700;line-height:1.4;color:'
          +(Math.abs(g)<3?'var(--ink3)':(g>0?'var(--good)':'var(--warn)'));
      }
      push('pr-sales-trend',{type:'line', title:this.tr(this.indName(pick))+' '+this.tr('매출 추이'),
        sub:'서울 전체 분기 합계', unit:'원',
        period:this.qtr(qs[0])+' ~ '+this.qtr(qs[qs.length-1]), height:250,
        labels:qs.map(qLabel), datasets:[{label:this.indName(pick), data:series}]});
      // 최근 분기 업종 비교 — 다른 질문(어느 업종이 큰가)
      const lastQ=qs[qs.length-1];
      const top=inds.map(n=>({n, v:HI.ind[n][lastQ]})).filter(o=>isFinite(o.v))
        .sort((a,b)=>b.v-a.v).slice(0,12);
      push('pr-sales-rank',{type:'hbar', title:'업종별 매출 비교', sub:'최근 분기 상위 12개',
        unit:'원', period:this.qtr(lastQ), height:300,
        labels:top.map(o=>this.indName(o.n)),
        datasets:[{label:'분기 매출', data:top.map(o=>o.v),
          colors:top.map(o=>o.n===pick?'on':'')}]});
      // 성장률 — 또 다른 질문(어느 업종이 크고 있는가)
      const grow=inds.map(n=>{
        const a=HI.ind[n][qs[qs.length-5]], b=HI.ind[n][lastQ];
        return (isFinite(a)&&isFinite(b)&&a>0)? {n, g:(b-a)/a*100} : null;
      }).filter(Boolean).sort((a,b)=>b.g-a.g);
      const growShow=[...grow.slice(0,6), ...grow.slice(-6)];
      push('pr-sales-growth',{type:'hbar', title:'1년 새 매출이 는 업종 · 준 업종',
        sub:'위 6개는 늘고, 아래 6개는 줄었어요', unit:'%',
        period:this.qtr(qs[qs.length-5])+' → '+this.qtr(lastQ), height:320,
        labels:growShow.map(o=>this.indName(o.n)),
        datasets:[{label:'1년 증감', data:growShow.map(o=>Math.round(o.g*10)/10),
          colors:growShow.map(o=>o.g>=0?'on':'warn')}]});
      out.listTitle='업종 '+inds.length+'가지';
      out.list=inds.map(n=>({
        name:this.indName(n), meta:'',
        value:this.won(HI.ind[n][lastQ]),
        pick:()=>this.setState({prPick:n,prIndustry:n}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(n===pick?'background:var(--accent-3)':'')}));
      out.note='서울시 상권분석서비스 분기 매출을 업종별로 합친 값이에요. 상권 하나가 아니라 서울 전체 기준이에요.';
    }

    // ── 개·폐업 ────────────────────────────────────────────────────
    else if(cat==='churn'){
      if(!ST||!ST.ind){ out.note='개·폐업 자료를 아직 불러오지 못했어요.'; return out; }
      const rows=Object.keys(ST.ind).map(n=>({name:this.indName(n), raw:n, ...ST.ind[n]}))
        .filter(o=>isFinite(o.opened)&&isFinite(o.closed));
      const mine=rows.find(o=>o.raw===(S.prIndustry||S.ind))||rows[0];
      if(!mine) return out;
      out.filters=[this.marketFilter('market.industry',rows.map(o=>({key:o.raw,label:o.name})),mine.raw,
        n=>this.setState({prIndustry:n}))];
      out.filterNote=this.t('market.seoulScope');
      out.title=this.tr(mine.name)+' · '+this.tr('3개월 동안');
      const net=mine.opened-mine.closed;
      out.now=(net>0?'+':'')+net.toLocaleString()+'곳';
      out.nowLabel='새로 연 곳 − 문 닫은 곳 · 서울 전체';
      out.delta=net>=0?'가게가 늘고 있어요':'가게가 줄고 있어요';
      out.deltaStyle='font-size:13.5px;font-weight:700;line-height:1.4;color:'+(net>=0?'var(--good)':'var(--warn)');
      const byChurn=rows.slice().sort((a,b)=>(b.opened+b.closed)-(a.opened+a.closed)).slice(0,12);
      push('pr-churn',{type:'bar', title:'업종별 개업 · 폐업', sub:'움직임이 큰 12개 업종',
        unit:'곳', period:this.qtr(ST.quarter)+' · '+this.tr('3개월'), height:280,
        labels:byChurn.map(o=>o.name),
        datasets:[{label:'새로 연 곳', data:byChurn.map(o=>o.opened)},
                  {label:'문 닫은 곳', data:byChurn.map(o=>o.closed)}]});
      const rate=rows.filter(o=>isFinite(o.close_rate)).sort((a,b)=>b.close_rate-a.close_rate).slice(0,12);
      push('pr-close-rate',{type:'hbar', title:'폐업률이 높은 업종', sub:'전체 점포 대비 폐업 비율',
        unit:'%', period:this.qtr(ST.quarter), height:300,
        labels:rate.map(o=>o.name),
        datasets:[{label:'폐업률', data:rate.map(o=>o.close_rate),
          colors:rate.map(o=>o.raw===mine.raw?'on':'warn')}]});
      const net12=rows.map(o=>({name:o.name, raw:o.raw, v:o.opened-o.closed}))
        .sort((a,b)=>b.v-a.v);
      const netShow=[...net12.slice(0,6), ...net12.slice(-6)];
      push('pr-net',{type:'hbar', title:'가게가 느는 업종 · 주는 업종', sub:'새로 연 곳 − 문 닫은 곳',
        unit:'곳', period:this.qtr(ST.quarter)+' · '+this.tr('3개월'), height:320,
        labels:netShow.map(o=>o.name),
        datasets:[{label:'순증감', data:netShow.map(o=>o.v),
          colors:netShow.map(o=>o.v>=0?'on':'warn')}]});
      out.note='서울 전체 기준이라 상권을 바꿔도 변하지 않아요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 이 자료로 구분되지 않아요.';
    }

    // ── 프랜차이즈 비중 ────────────────────────────────────────────
    else if(cat==='fr'){
      if(!ST||!ST.ind){ out.note='프랜차이즈 자료를 아직 불러오지 못했어요.'; return out; }
      const rows=Object.keys(ST.ind).map(n=>({name:this.indName(n), raw:n, ...ST.ind[n]}))
        .filter(o=>isFinite(o.fr_share));
      const mine=rows.find(o=>o.raw===(S.prIndustry||S.ind))||rows[0];
      if(!mine) return out;
      out.filters=[this.marketFilter('market.industry',rows.map(o=>({key:o.raw,label:o.name})),mine.raw,
        n=>this.setState({prIndustry:n}))];
      out.filterNote=this.t('market.seoulScope');
      const top=rows.slice().sort((a,b)=>b.fr_share-a.fr_share).slice(0,14);
      out.title='업종별 프랜차이즈 비중';
      out.now=mine? mine.fr_share+'%' : (top[0].fr_share+'%');
      out.nowLabel=mine? this.indName(mine.raw) : top[0].name;
      push('pr-fr',{type:'hbar', title:'프랜차이즈 비중이 높은 업종', sub:'전체 점포 중 프랜차이즈 비율',
        unit:'%', period:this.qtr(ST.quarter), height:340,
        labels:top.map(o=>o.name),
        datasets:[{label:'프랜차이즈 비중', data:top.map(o=>o.fr_share),
          colors:top.map(o=>o.raw===mine.raw?'on':'')}]});
      const big=rows.slice().sort((a,b)=>b.stores-a.stores).slice(0,12);
      push('pr-fr-stores',{type:'hbar', title:'점포 수가 많은 업종', sub:'프랜차이즈 비중과 함께 보면 경쟁 성격이 보여요',
        unit:'곳', period:this.qtr(ST.quarter), height:300,
        labels:big.map(o=>o.name),
        datasets:[{label:'전체 점포 수', data:big.map(o=>o.stores),
          colors:big.map(o=>o.raw===mine.raw?'on':'')}]});
      out.note='서울 전체 기준이에요. 프랜차이즈 비중이 높은 업종은 개인 가게가 브랜드와 바로 부딪힌다는 뜻이에요.';
    }

    // ── 자치구 소비 구성 ───────────────────────────────────────────
    else {
      if(!IC||!IC.gu){ out.note='소비 자료를 아직 불러오지 못했어요.'; return out; }
      const gus=Object.keys(IC.gu);
      const pick=[S.prGu,S.prPick,S.rp_gu].find(g=>IC.gu[g])||gus[0];
      out.filters=[this.marketFilter('market.gu',gus.map(g=>({key:g,label:this.placeName(g)})),pick,
        g=>this.setState({prGu:g,prPick:g}))];
      out.filterNote=this.t('market.spendScope');
      const spend=(IC.gu[pick]&&IC.gu[pick].spend)||[];
      const sorted=spend.slice().sort((a,b)=>b.pct-a.pct);
      out.title=this.placeName(pick)+' · '+this.tr('가구가 돈을 쓰는 곳');
      out.now=sorted.length? this.tr(sorted[0].name) : '—';
      out.nowLabel=sorted.length? this.tr('가장 큰 항목 '+sorted[0].pct+'%') : '';
      push('pr-spend',{type:'doughnut', title:this.placeName(pick)+' '+this.tr('소비 구성'), sub:'가구 지출에서 차지하는 비율',
        unit:'%', period:this.qtr(IC.quarter), height:300,
        labels:sorted.map(o=>this.tr(o.name)), datasets:[{label:'비율', data:sorted.map(o=>o.pct)}]});
      // 같은 항목을 자치구끼리 견준다 — 다른 질문
      const key=sorted.length? sorted.find(o=>o.name==='음식')||sorted[0] : null;
      if(key){
        const cross=gus.map(g=>{
          const it=((IC.gu[g]||{}).spend||[]).find(x=>x.name===key.name);
          return it? {g, v:it.pct} : null;
        }).filter(Boolean).sort((a,b)=>b.v-a.v);
        push('pr-spend-gu',{type:'hbar', title:this.t('pr.spendByGu',{name:this.tr(key.name)}),
          sub:'같은 항목을 자치구끼리 견줘요', unit:'%', period:this.qtr(IC.quarter), height:340,
          labels:cross.map(o=>this.placeName(o.g)), datasets:[{label:this.tr(key.name)+' '+this.tr('비중'), data:cross.map(o=>o.v),
            colors:cross.map(o=>o.g===pick?'on':'')}]});
      }
      out.listTitle=this.tr('자치구 '+gus.length+'곳');
      out.list=gus.map(g=>({
        name:this.placeName(g), meta:'',
        value:this.tr((((IC.gu[g]||{}).spend||[]).slice().sort((a,b)=>b.pct-a.pct)[0]||{}).name||'—'),
        pick:()=>this.setState({prPick:g,prGu:g}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(g===pick?'background:var(--accent-3)':'')}));
      // 25개 구 중 5개가 원자료에 없다. 말없이 20곳만 보여주면 자기 구를 찾던 분은
      // 앱이 고장 난 줄 안다 — 왜 없는지 적는다(§1 데이터 정직성).
      const allGu=[...new Set(Object.values(S.zgu||{}))].filter(Boolean);
      const missing=allGu.filter(g=>!IC.gu[g]);
      // 이어 붙인 뒤에는 사전이 통째로는 못 찾는다 — 조각마다 옮긴 뒤 잇는다
      out.note=this.tr(IC.income_note||'자치구 단위 가구 지출 구성이에요. 상권 하나의 값은 아니에요.')
        +(missing.length? ' '+this.t('pr.guMissing',{n:missing.length,
            names:missing.map(g=>this.placeName(g)).join(' · ')}) : '');
    }

    out.charts=C; out.hasCharts=C.length>0;
    out.chartCount=this.t('mk.chartCount',{n:C.length});
    // 긴 회색 문단을 그대로 두지 않는다(§5·§6) — 첫 문장만 두고 나머지는 접는다
    out.noteBox=(()=>{
      const t=(out.note||'').trim();
      if(!t) return this.dataNote('pr','',[]);
      const i=t.indexOf('. ')>=0? t.indexOf('. ')+1 : t.length;
      const head=t.slice(0,i).trim(), rest=t.slice(i).trim();
      return this.dataNote('pr', head, rest? [['자세히', rest]] : []);
    })();
    out.hasList=out.list.length>0;
    // 한 화면에 차트 하나. 옆으로 넘겨 다음 질문으로 간다(§8·§21)
    // 데스크톱은 세로 메뉴 옆 좁은 칸이라 꽉 채우고, 모바일은 다음 장이 10% 걸치게 둔다(§9).
    out.rail=this.rail('price', {per:1, peek:false, arrows:true});
    return out;
  };
