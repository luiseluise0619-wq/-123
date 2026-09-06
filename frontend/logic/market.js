'use strict';
// 시장동향 — "지금 장사 환경이 어떻게 움직이고 있지?"
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
      {k:'all',    label:'전체'},
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

  // 사장님이 고른 관심지표. 처음엔 상권·부동산 넷으로 시작한다.
  marketWatch(){
    const w=this.state.mkWatch;
    if(Array.isArray(w)) return w;
    return ['rent','vacancy','sales','churn'];
  },
  marketToggle(k){
    const cur=this.marketWatch();
    const next = cur.indexOf(k)>=0 ? cur.filter(x=>x!==k) : [...cur,k];
    this.setState({mkWatch:next});
    try{ localStorage.setItem('mysbizon.mkWatch', JSON.stringify(next)); }catch(e){}
  },
  marketPick(k){
    // 관심지표에 없으면 고르는 순간 담는다 — 고른 걸 못 보는 일이 없게
    if(this.marketWatch().indexOf(k)<0) this.marketToggle(k);
    this.setState({mkSel:k});
  }
};

// 화면 — 카테고리 고르기 → 관심지표 → 큰 차트 하나
globalThis.MysbizonParts.market.marketView = function(){
  const S=this.state;
  const ALL=this.MARKET_INDICATORS();
  const CATS=this.MARKET_CATS();
  const cat=S.mkCat||'all';
  const watch=this.marketWatch();
  const byKey={}; ALL.forEach(i=>{ byKey[i.k]=i; });

  // 지금 보고 있는 지표. 관심지표 중 첫 번째를 기본으로 한다.
  const selKey=(S.mkSel && byKey[S.mkSel]) ? S.mkSel : (watch.find(k=>byKey[k]) || 'rent');
  const sel=byKey[selKey]||ALL[0];

  const chipStyle=on=>'flex:none;padding:9px 15px;border-radius:999px;font-size:13.5px;cursor:pointer;'
    +'white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;'
    +'transition:background .14s,color .14s;'
    +(on?'background:var(--color-primary);color:#FFFFFF;font-weight:600'
        :'background:var(--color-surface);color:var(--color-text-secondary)');

  // 관심지표 — 가로로 넘겨 본다. × 로 뺀다.
  // 위에서 카테고리를 고르면 그 갈래만 남는다('전체'면 다 보인다).
  const inCat=i=> cat==='all' || i.cat===cat;
  const chips=watch.map(k=>byKey[k]).filter(Boolean).filter(inCat).map(i=>({
    label:i.label,
    ready:!!i.ready,
    on:i.k===selKey,
    pick:()=>this.marketPick(i.k),
    remove:e=>{ if(e&&e.stopPropagation) e.stopPropagation(); this.marketToggle(i.k); },
    style:'flex:none;display:inline-flex;align-items:center;gap:8px;padding:10px 12px 10px 16px;'
      +'border-radius:999px;font-size:14px;cursor:pointer;white-space:nowrap;min-height:42px;'
      +'transition:background .14s,color .14s;'
      +(i.k===selKey
        ? 'background:var(--color-primary);color:#FFFFFF;font-weight:600'
        : 'background:var(--color-surface);color:var(--color-text-secondary)'),
    xStyle:'flex:none;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;'
      +'justify-content:center;font-size:13px;line-height:1;'
      +(i.k===selKey? 'background:rgba(255,255,255,.25);color:#FFFFFF'
                    : 'background:var(--color-surface-secondary);color:var(--color-text-muted)'),
    tagStyle:'flex:none;font-size:10.5px;font-weight:600;padding:2px 7px;border-radius:999px;'
      +(i.k===selKey? 'background:rgba(255,255,255,.22);color:#FFFFFF'
                    : 'background:var(--color-surface-secondary);color:var(--color-text-muted)')
  }));

  // 지표 추가 — 검색 + 카테고리별 체크 목록 (여기는 늘 전부 보여준다)
  const q=(S.mkQ||'').trim();
  const hitQ=i=> !q || (i.label+i.q+i.src).indexOf(q)>=0;
  const groups=CATS.filter(c=>c.k!=='all')
    .map(c=>({
      label:c.label,
      items:ALL.filter(i=>i.cat===c.k && hitQ(i)).map(i=>({
        label:i.label,
        ready:!!i.ready,
        state: watch.indexOf(i.k)>=0 ? '☑' : '☐',
        note: i.ready? i.src : '데이터 준비 중',
        toggle:()=>this.marketToggle(i.k),
        style:'display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:var(--r-sm);'
          +'cursor:pointer;min-width:0;transition:background .14s;'
          +(watch.indexOf(i.k)>=0? 'background:var(--color-primary-soft)':'background:var(--color-surface)')
      }))
    }))
    .filter(g=>g.items.length>0);

  const out={
    cats:CATS.map(c=>({label:c.label, pick:()=>this.setState({mkCat:c.k}), style:chipStyle(c.k===cat)})),
    catRail:this.rail('mkCat',{per:8}),
    chips, hasChips:chips.length>0,
    chipRail:this.rail('mkChip',{per:5}),
    addOpen:!!S.mkAdd,
    addLabel:S.mkAdd? '닫기' : '+ 관심지표 추가',
    toggleAdd:()=>this.setState({mkAdd:!S.mkAdd, mkQ:''}),
    q:S.mkQ||'',
    onQ:e=>this.setState({mkQ:e.target.value}),
    groups, hasGroups:groups.length>0,
    noHit: !!q && groups.length===0,
    noHitText:'‘'+q+'’와 맞는 지표가 없어요.',
    // 지금 보는 지표
    selKey, selLabel:sel.label, selQuestion:sel.q, selSrc:sel.src,
    ready:!!sel.ready,
    waiting:!sel.ready,
    waitTitle:this.t('mk.waitTitle',{name:sel.label}),
    waitText:this.t('mk.waitText',{src:sel.src}),
    empty:watch.length===0,
    emptyText:'관심지표를 하나도 담지 않으셨어요. 아래 [+ 관심지표 추가]에서 보고 싶은 걸 골라 보세요.',
    // 갈래를 골랐는데 그 갈래에 담아 둔 게 없을 때 — 빈 줄만 남기지 않는다
    catEmpty: watch.length>0 && chips.length===0,
    catEmptyText:this.t('mk.catEmpty',{cat:(CATS.find(c=>c.k===cat)||{label:''}).label})
  };
  return out;
};
