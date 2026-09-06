'use strict';
// 다국어 — 한국어 / English / 中文(简体)
//
// 어떻게 도는가
//   locales/*.json 을 시작할 때 한 번 받아 둔다. t('nav.market') 처럼 키로 찾는다.
//   컴포넌트 안에 if(lang==='ko') 를 쓰지 않는다. 문구는 전부 사전에 있다.
//   사전에 없는 키는 한국어로 떨어지고(fallback), 그것도 없으면 키를 그대로 보여준다
//   — 조용히 빈칸이 되면 '번역이 빠졌다'는 걸 아무도 모른다.
//
// 지금 어디까지 번역됐나 (정직하게)
//   메뉴·화면 제목·설명·버튼·입력 안내·설정창·빈 상태·오류·차트 제목 일부까지.
//   상권 이름, 업종 이름, 그리고 데이터에서 만들어지는 긴 해석 문장은 아직 한국어다.
//   원자료가 한국어이고(서울시 상권분석서비스), 문장이 조사·어순에 묶여 있어
//   기계적으로 바꾸면 틀린 문장이 된다. 남은 범위는 README 와 보고에 적어 둔다.
//
// 숫자·날짜
//   Intl.NumberFormat / Intl.DateTimeFormat 을 공용 함수로만 쓴다(§35).
//   화면마다 따로 만들지 않는다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.i18n = {

  LOCALES(){
    return [
      {k:'ko',    label:'한국어', short:'KR'},
      {k:'en',    label:'English', short:'EN'},
      {k:'zh-CN', label:'中文',   short:'中文'}
    ];
  },

  locale(){ return this.state.locale || 'ko'; },

  loadLocales(){
    // ko 는 아래에 심어 두어 첫 화면이 키로 보이지 않게 한다.
    this._dict = this._dict || {ko:this.KO_BASE()};
    this.LOCALES().forEach(l=>{
      if(l.k==='ko') return;
      fetch('./locales/'+l.k+'.json')
        .then(r=>r.ok?r.json():null)
        .then(j=>{ if(j){ this._dict[l.k]=j; this.forceUpdate(); } })
        .catch(()=>{});
    });
    let saved=null;
    try{ saved=JSON.parse(localStorage.getItem('mysbizon.theme')||'{}').locale; }catch(e){}
    if(saved && this.LOCALES().some(l=>l.k===saved)) { this.setState({locale:saved}); return; }
    // 사장님이 고른 적이 없으면 브라우저 언어를 첫 값으로 쓴다(고른 값이 항상 이긴다)
    const nav=(typeof navigator!=='undefined' && navigator.language)||'ko';
    const guess = nav.startsWith('zh') ? 'zh-CN' : (nav.startsWith('en') ? 'en' : 'ko');
    if(guess!=='ko') this.setState({locale:guess});
  },

  setLocale(k){
    this.setState({locale:k});
    try{
      const cur=JSON.parse(localStorage.getItem('mysbizon.theme')||'{}');
      localStorage.setItem('mysbizon.theme', JSON.stringify({...cur, locale:k}));
    }catch(e){}
  },

  // 문구 하나. vars 로 {n} 같은 자리를 채운다.
  t(key, vars){
    const d=this._dict||{ko:this.KO_BASE()};
    const L=this.locale();
    let s = (d[L] && d[L][key]) != null ? d[L][key]
          : (d.ko && d.ko[key]) != null ? d.ko[key]
          : key;
    if(vars) for(const k in vars) s=String(s).split('{'+k+'}').join(vars[k]);
    return s;
  },

  // ── 숫자·날짜 (§35) ─────────────────────────────────────────
  // 화면마다 toLocaleString 을 직접 부르지 않는다. 여기만 쓴다.
  nfmt(v, opt){
    if(v==null||!isFinite(v)) return '—';
    try{ return new Intl.NumberFormat(this.locale(), opt||{}).format(v); }
    catch(e){ return String(v); }
  },
  // 큰 금액. 한국어는 만·억, 영어는 M/B, 중국어는 万·亿.
  money(v){
    if(v==null||!isFinite(v)) return '—';
    const L=this.locale(), a=Math.abs(v), sign=v<0?'-':'';
    if(L==='en'){
      if(a>=1e9) return sign+'KRW '+this.nfmt(a/1e9,{maximumFractionDigits:1})+'B';
      if(a>=1e6) return sign+'KRW '+this.nfmt(a/1e6,{maximumFractionDigits:1})+'M';
      if(a>=1e3) return sign+'KRW '+this.nfmt(a/1e3,{maximumFractionDigits:0})+'K';
      return sign+'KRW '+this.nfmt(a);
    }
    if(L==='zh-CN'){
      if(a>=1e8) return sign+this.nfmt(a/1e8,{maximumFractionDigits:1})+'亿韩元';
      if(a>=1e4) return sign+this.nfmt(a/1e4,{maximumFractionDigits:0})+'万韩元';
      return sign+this.nfmt(a)+'韩元';
    }
    if(a>=1e8) return sign+this.nfmt(a/1e8,{maximumFractionDigits:a>=1e9?0:1})+'억';
    return sign+this.nfmt(Math.round(a/1e4))+'만';
  },
  dfmt(d){
    const dt=(d instanceof Date)?d:new Date(d);
    if(isNaN(dt)) return '—';
    try{ return new Intl.DateTimeFormat(this.locale(),
      {year:'numeric',month:'short',day:'numeric'}).format(dt); }
    catch(e){ return String(d); }
  },

  // 한국어 원본. 이 목록이 곧 '번역해야 할 것'의 정의다.
  KO_BASE(){
    return {
      'nav.zone':'상권분석','nav.fine':'정밀분석','nav.sim':'정밀비교',
      'nav.market':'시장동향','nav.report':'리포트',
      'menu.zoneCompare':'지역비교','menu.find':'후보지','menu.compare':'비교분석',
      'menu.sweep':'자치구 훑기','menu.map':'지도','menu.detail':'정밀분석',
      'menu.sim':'정밀비교','menu.bep':'본전 계산',

      'home.eyebrow':'내 장사의 시작, 데이터로 한 걸음 더',
      'home.title':'어떤 동네에서 시작해 볼까요?',
      'home.sub':'업종을 고르면 동네를 비교하고, 내 조건에 맞는 본전선을 확인할 수 있어요.',
      'home.location':'위치','home.locationAny':'서울 전체',
      'home.industry':'어떤 장사를 생각하시나요?','home.industryHint':'예: 카페, 편의점',
      'home.start':'동네 찾아보기','home.popular':'인기 검색',

      'common.search':'검색','common.clear':'지우기','common.close':'닫기',
      'common.more':'더 보기','common.less':'접기','common.reset':'기본값으로 복원',
      'common.loading':'불러오는 중이에요','common.error':'데이터를 읽지 못했어요',
      'common.retry':'다시 시도','common.noData':'데이터 없음','common.preparing':'데이터 준비 중',
      'common.estimate':'(추정)','common.source':'출처','common.basis':'데이터 기준 보기',
      'common.rank':'{n}위','common.of':'{n}곳 중',

      'cmp.title':'담아 둔 {n}곳, 어디로 할까요?',
      'cmp.weightQ':'무엇을 더 중요하게 볼까요?',
      'cmp.showWeights':'추천 기준 보기','cmp.hideWeights':'기준 접기',
      'cmp.best':'종합 1위','cmp.order':'전체 순위','cmp.byMetric':'항목별로 견주기',
      'cmp.balanced':'균형 있게','cmp.salesFirst':'매출 우선','cmp.popFirst':'유동인구 우선',
      'cmp.compFirst':'경쟁 적은 곳 우선','cmp.costFirst':'비용 우선',
      'metric.sales':'예상 매출','metric.pop':'유동인구','metric.stores':'경쟁 점포',
      'metric.spend':'소비 규모','metric.rent':'임대료','metric.vacancy':'공실률',
      'metric.higher':'높을수록 좋음','metric.lower':'낮을수록 좋음',

      'sim.title':'내 조건이면 어디가 더 남을까요?',
      'sim.inputs':'내 조건 넣기','sim.monthly':'매달 (만원)','sim.initial':'처음 한 번 (만원)',
      'sim.rev':'예상 월매출','sim.rent':'월세','sim.labor':'인건비','sim.cogs':'재료비',
      'sim.mgmt':'관리비','sim.etc':'기타 비용','sim.deposit':'보증금','sim.premium':'권리금',
      'sim.interior':'인테리어','sim.setup':'기타 초기비용',
      'sim.profit':'월 예상 영업이익','sim.margin':'영업이익률','sim.cost':'월 비용',
      'sim.invest':'초기 투자금','sim.payback':'회수 예상','sim.noPayback':'지금 조건에서는 회수 불가',

      'market.title':'지금 장사 환경은 어떤가요?',
      'market.watch':'내 관심지표','market.add':'+ 관심지표 추가',
      'market.addQ':'어떤 지표를 추가할까요?','market.searchHint':'지표 이름 (예: 양파, 환율)',
      'cat.all':'전체','cat.zone':'상권·부동산','cat.fx':'환율','cat.macro':'금리·물가',
      'cat.crop':'농산물','cat.meat':'축산물','cat.fish':'수산물','cat.energy':'에너지',

      'report.title':'리포트로 정리해 드려요',
      'report.support':'나에게 맞는 지원사업','report.deadline':'가장 가까운 마감',
      'report.viewNotice':'공고 보기','report.count':'신청 가능한 지원사업',

      'settings.title':'설정','settings.appearance':'화면','settings.light':'밝게',
      'settings.dark':'어둡게','settings.system':'시스템 설정',
      'settings.language':'언어','settings.theme':'테마','settings.chartColors':'차트 색상',
      'settings.textColors':'글자','settings.textPrimary':'본문 글자',
      'settings.textSecondary':'보조 글자','settings.custom':'직접 설정',
      'settings.primary':'포인트 색','settings.background':'배경색',
      'settings.i18nNote':'상권 이름·업종 이름과 자료에서 만들어지는 문장은 아직 한국어예요.',

      'chart.salesTrend':'이 장사, 시장이 크고 있나요?',
      'chart.age':'어떤 연령대가 가장 많이 오나요?',
      'chart.rentTrend':'임대료는 오르고 있나요?',
      'chart.vacancy':'빈 가게가 늘고 있나요?',
      'chart.compare':'어디가 더 많이 파나요?'
    };
  }
};
