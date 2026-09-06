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
        .then(j=>{ if(j){ this._dict[l.k]=j;
          // 사전이 도착하기 전에 그린 값들이 캐시에 '번역 안 됨'으로 남아 있다 — 비운다
          this._trCache={}; this.forceUpdate(); } })
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
    this._trCache={};
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
      'nav.market':'통합시세','nav.report':'리포트',
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


      // 이름·숫자가 들어가는 문장은 자리표시자를 둔 키로 관리한다(조사는 tn 이 고른다)
      "mk.waitTitle": "{name} — 데이터 준비 중",
      "mk.waitText": "{src} 자료를 연결하면 여기에 그래프가 나타나요. 아직 연결되지 않아서 지금은 값을 보여드리지 않아요 — 없는 숫자를 지어내지 않기 위해서예요.",
      "mk.chartCount": "차트 {n}개",
      "sido.wait": "‘{region}’ 자료는 아직 없어요. 지금 쓰는 자료는 서울시 상권분석서비스라 서울 상권 1,564곳만 담고 있어요. 전국으로 넓히려면 소상공인시장진흥공단 상권정보로 갈아타야 하는데, 상권 구획과 업종 코드가 달라 맞춰 붙이는 작업이 필요해요.",
      "sido.waitFind": "현재 {region} 지역의 상권·임대료 데이터는 준비 중이에요. 지금 쓰는 자료는 서울시 상권분석서비스라 서울 상권 1,564곳만 담고 있어요. 전국으로 넓히려면 소상공인시장진흥공단 상권정보로 갈아타야 하는데, 상권 구획과 업종 코드가 달라 맞춰 붙이는 작업이 필요해요.",
      "zc.lead": "{ind}은(는) {gu}가 가게 한 곳당 가장 많이 팔아요.",
      "cmp.verdictClear": "{name}이(가) {preset} 기준에서 종합 1위예요.",
      "cmp.verdictClose": "{name}이(가) 근소하게 앞서요. {preset} 기준에서 1·2위 차이가 크지 않아요.",
      "cmp.honesty": "같은 기간({q}) 같은 업종({ind})으로만 비교해요. 카드와 차트의 색은 상권을 구분하는 색이지 좋고 나쁨이 아니에요. 순위는 지금 고른 기준에서의 순위이고, 기준을 바꾸면 달라져요.",
      "sim.verdict": "내가 입력한 조건에서는 {name}이(가) 가장 유리해요.",
      "sim.tie": "입력한 조건에서는 이익이 같아요. 숫자를 조금 바꿔 보면 갈립니다.",
      "mv.eyebrow": "{ind} · {zone}",
      "mv.guWhere": "{gu} 안에서 여기는 어디쯤인가요?",
      "mv.guPop": "{gu} 안에서 사람이 가장 많은 곳은?",
      "mv.guComp": "{gu} 안에서 경쟁이 센 곳은?",
      "mv.guSpend": "{gu} 사람들은 어디에 돈을 쓰나요?",
      "mv.popNote": "유동인구는 {dong} 행정동 값이라 상권보다 넓어요. 시간대·요일 데이터는 아직 없어요.",
      "fc.lead": "{gu}에서 {ind}이(가) 가장 잘 되는 곳은 {top}이에요.",
      "fc.note": "{gu} 안에서 자료가 있는 상권 {n}곳을 가게 한 곳당 매출로 줄 세웠어요.",
      "chat.hello": "안녕하세요. {ind} 기준으로 답해 드립니다. 궁금한 걸 물어보시거나 아래 버튼을 눌러 주세요.",
      "rg.share": "{ind}은(는) 이 동네에서 손님이 쓴 돈의 {pct}%를 차지해요.",

      "gu.border": "{a}·{b} 경계",
      "rent.basis": "{name} 기준",
      "rent.region": "권역 참고값 · 이 상권 값은 아니에요",
      "pr.rentUnit": "㎡당 월 임대료",
      "pr.vacancy": "빈 상가 비율",
      "pr.vs2y": "2년 전 대비",
      "pr.trendRent": "{name} 임대료 추이",
      "pr.trendVac": "{name} 공실률 추이",
      "pr.cmpRent": "상권별 임대료 비교",
      "pr.cmpVac": "상권별 공실률 비교",
      "pr.seoulRent": "서울 전체 임대료 추이",
      "pr.seoulVac": "서울 전체 공실률 추이",
      "diag.over": "예상 매출이 본전선을 {amt} 넘어요",
      "diag.left": "월 {amt} 남습니다",
      "diag.short": "월 {amt} 모자랍니다",
      "diag.leftLabel": "남는 돈 {amt}",
      "diag.cond": "{area}평 · 임대료 {rent} · 직원 {n}명",
      "diag.fixed": "고정비 {amt}을 못 덮습니다",
      "mv.title": "{zone} × {ind}",
      "mv.head": "{ind} · {zone}",
      "mv.stamp": "{ind} · {zone} · {q}",
      "find.rank": "{ind} · {n}곳 중 {r}위",
      "find.ok": "{zone}은(는) {ind} 후보로 괜찮아요.",
      "rentPer": "{amt}/월",

      "mv.popLabel": "{dong} 행정동 하루 유동인구",
      "mv.noPop": "유동인구 자료가 없어요",
      "mv.estMedian": "(추정) · 서울 중앙값 {amt}",
      "sim.full": "3곳까지 견줄 수 있어요",
      "sim.addMore": "견줄 곳 더하기",
      "fc.none": "{gu}에는 {ind} 자료가 있는 상권이 없어요.",
      "fc.pickOther": "다른 자치구를 골라 보세요.",

      "mv.question": "{zone}에서 {ind}을(를) 시작해도 괜찮을까요?",

      'chart.salesTrend':'이 장사, 시장이 크고 있나요?',
      'chart.age':'어떤 연령대가 가장 많이 오나요?',
      'chart.rentTrend':'임대료는 오르고 있나요?',
      'chart.vacancy':'빈 가게가 늘고 있나요?',
      'chart.compare':'어디가 더 많이 파나요?'
    };
  }
};

// ── 본문 문장 번역 (translation memory) ─────────────────────────
//
// 왜 키가 아니라 한국어 원문으로 찾나
//   UI 뼈대(메뉴·버튼·설정)는 키로 관리한다 — 위 KO_BASE.
//   그런데 화면 문장은 대부분 자료에서 만들어진다:
//     '서울 중앙값보다 114% 높아요' / '중앙값보다 1,476곳 많아요'
//   이런 문장이 1,200개가 넘고, 숫자만 다른 같은 문장이 수없이 나온다.
//   그래서 '한국어 원문 → 번역' 표를 두고, 숫자는 자리표시자로 일반화해 찾는다.
//   locales/*.json 의 "@phrases" 가 그 표다.
//
// 무엇을 건드리지 않나
//   표에 없는 문장은 한국어 그대로 둔다. 억지로 바꾸지 않는다.
//   상권 이름·자치구 이름 같은 고유명사는 표에 넣지 않는다.
//   영어에서는 상권 이름만 국어의 로마자 표기법으로 옮긴다(zoneLabelOf).
//
// 빠진 번역을 조용히 넘기지 않으려고
//   tests/i18n.test.js 가 실제 화면 값을 훑어 '번역 안 된 한글'을 세고,
//   기준치를 넘으면 실패한다. 문구를 고치고 번역을 안 넣으면 테스트가 잡는다.
globalThis.MysbizonParts.i18n.trTable = function(){
  const L=this.locale();
  if(L==='ko') return null;
  const d=this._dict&&this._dict[L];
  return (d&&d['@phrases'])||null;
};

// 숫자를 자리표시자로 바꾼 꼴. '중앙값보다 1,476곳 많아요' → '중앙값보다 {0}곳 많아요'
globalThis.MysbizonParts.i18n.trNorm = function(s){
  const nums=[];
  const key=String(s).replace(/-?\d[\d,]*(\.\d+)?/g, m=>{ nums.push(m); return '{'+(nums.length-1)+'}'; });
  return {key:key, nums:nums};
};

globalThis.MysbizonParts.i18n.tr = function(s){
  if(typeof s!=='string' || !s) return s;
  if(!/[가-힣]/.test(s)) return s;                 // 한글이 없으면 볼 것도 없다
  const table=this.trTable();
  if(!table) return s;
  this._trCache = this._trCache || {};
  const ck=this.locale()+' '+s;
  if(this._trCache[ck]!==undefined) return this._trCache[ck];
  let out=s;
  if(table[s]!=null) out=table[s];
  else{
    const n=this.trNorm(s);
    const hit=table[n.key];
    if(hit!=null) out=n.nums.reduce(function(acc,v,i){ return acc.split('{'+i+'}').join(v); }, hit);
  }
  this._trCache[ck]=out;
  return out;
};

// 화면에 나가는 값 전체를 한 번 훑어 번역한다.
// 스타일 문자열에는 한글이 없어 그대로 지나간다 — 따로 걸러낼 필요가 없다.
globalThis.MysbizonParts.i18n.trDeep = function(v, depth){
  if(this.locale()==='ko') return v;
  const d=depth||0;
  if(d>8) return v;
  if(typeof v==='string') return this.tr(v);
  if(Array.isArray(v)) return v.map(x=>this.trDeep(x,d+1));
  if(v && typeof v==='object' && v.constructor===Object){
    const out={};
    for(const k in v) out[k]=this.trDeep(v[k],d+1);
    return out;
  }
  return v;                                        // 함수·숫자·null 은 그대로
};

// 조사가 들어가는 문장용. 사전에는 '{ind}은(는) {gu}가 …' 처럼 두 형태를 다 적어 두고,
// 채워 넣은 뒤 앞 글자 받침을 보고 하나를 고른다.
// 영어·중국어 문장에는 조사가 없으니 이 단계가 아무 일도 하지 않는다.
globalThis.MysbizonParts.i18n.tn = function(key, vars){
  const s=this.t(key, vars);
  if(this.locale()!=='ko') return s;
  return String(s).replace(/(.)(은\(는\)|는\(은\)|이\(가\)|가\(이\)|을\(를\)|를\(을\))/g,
    (m, prev, pair)=>{
      const c=prev.charCodeAt(0)-0xAC00;
      const bat=(c>=0&&c<11172)? c%28!==0 : /[013678lmnr]$/i.test(prev);
      if(pair.indexOf('은')===0||pair.indexOf('는')===0) return prev+(bat?'은':'는');
      if(pair.indexOf('이')===0||pair.indexOf('가')===0) return prev+(bat?'이':'가');
      return prev+(bat?'을':'를');
    });
};

// 화면 조각(screens/*.html)에 그대로 적힌 한국어까지 옮긴다.
//
// 왜 DOM 을 훑나
//   문구의 절반은 화면(view model)에서 오지만, 나머지 절반은 마크업에 그대로 적혀 있다.
//     <div class="u-h">비교할 상권 검색</div>
//   이걸 전부 바인딩으로 바꾸면 수백 군데를 손대야 하고, 한 곳만 빠뜨려도 조용히 한국어로 남는다.
//   그래서 그린 뒤에 한 번 훑어 같은 표(@phrases)로 바꾼다.
//   React 는 자기 가상 DOM 을 기준으로 그리므로, 우리가 그린 뒤 글자를 바꿔도 충돌하지 않는다.
//   다시 그릴 때마다 한 번 더 훑을 뿐이고, 이미 옮긴 글자에는 한글이 없어 그냥 지나간다.
//
// 한국어일 때는 아무 일도 하지 않는다.
globalThis.MysbizonParts.i18n.trDom = function(){
  if(typeof document==='undefined') return;
  if(this.locale()==='ko') return;
  if(!this.trTable()) return;                       // 사전이 아직 안 왔으면 다음 렌더에
  const SKIP={SCRIPT:1, STYLE:1, CANVAS:1, SVG:1, PATH:1};
  const walk=(node)=>{
    for(let n=node.firstChild; n; n=n.nextSibling){
      if(n.nodeType===3){
        const t=n.nodeValue;
        if(t && /[가-힣]/.test(t)){
          const trimmed=t.trim();
          const out=this.tr(trimmed);
          if(out!==trimmed) n.nodeValue=t.replace(trimmed,out);
        }
        continue;
      }
      if(n.nodeType!==1) continue;
      if(SKIP[n.tagName]) continue;
      for(const a of ['placeholder','aria-label','title']){
        const v=n.getAttribute && n.getAttribute(a);
        if(v && /[가-힣]/.test(v)){
          const out=this.tr(v.trim());
          if(out!==v.trim()) n.setAttribute(a,out);
        }
      }
      walk(n);
    }
  };
  try{ walk(document.body); }catch(e){}
};
