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

  // <html lang> 을 지금 언어로 맞춘다.
  //   왜: 스크린리더는 이 값으로 발음 규칙을 고른다. 영어 화면인데 lang="ko" 면
  //   영어 문장을 한국어 발음으로 읽는다. 브라우저 번역·글꼴 선택도 이 값을 본다.
  //   인쇄본(report-i18n.js)은 이미 이렇게 하고 있었는데 앱만 빠져 있었다.
  setHtmlLang(k){
    if(typeof document==='undefined') return;
    try{ document.documentElement.setAttribute('lang', k==='zh-CN'?'zh-CN':(k==='en'?'en':'ko')); }catch(e){}
  },

  loadLocales(){
    // ko 는 아래에 심어 두어 첫 화면이 키로 보이지 않게 한다.
    this._dict = this._dict || {ko:this.KO_BASE()};

    // 고른 적이 있으면 그 값이 이긴다. 없으면 '지금 있는 위치'로 정한다.
    let saved=null;
    try{
 saved=JSON.parse(localStorage.getItem('mysbizon.theme')||'{}').locale; }catch(e){}
    const want = (saved && this.LOCALES().some(l=>l.k===saved)) ? saved
               : (this.locale()!=='ko' ? this.locale() : this.guessLocale());
    if(want!==this.locale()) this.setState({locale:want});
    this.setHtmlLang(want);
    // **쓸 사전만 받는다.** 전에는 en·zh 를 늘 같이 받아, 한국어로 보는 사람도
    // gzip 60KB(전체 전송량의 9%)를 쓰지도 않을 번역에 썼다.
    this.fetchLocale(want);
  },

  // 사전 하나를 받아 둔다. 이미 있으면 아무 일도 하지 않는다.
  fetchLocale(k){
    if(!k || k==='ko') return Promise.resolve();
    this._dict = this._dict || {ko:this.KO_BASE()};
    if(this._dict[k]) return Promise.resolve();
    const embedded=globalThis.MysbizonBootstrap&&globalThis.MysbizonBootstrap.locales&&globalThis.MysbizonBootstrap.locales[k];
    if(embedded){this._dict[k]=embedded;this._trCache={};return Promise.resolve();}
    this._fetching = this._fetching || {};
    if(this._fetching[k]) return this._fetching[k];
    const done = fetch('./locales/'+k+'.json')
      .then(r=>r.ok?r.json():null)
      .then(j=>{ if(j){ this._dict[k]=j;
        // 사전이 도착하기 전에 그린 값들이 캐시에 '번역 안 됨'으로 남아 있다 — 비운다
        this._trCache={}; this.forceUpdate(); } })
      .catch(()=>{})
      .then(()=>{ delete this._fetching[k]; });
    this._fetching[k]=done;
    return done;
  },

  // 위치(타임존) → 언어. 못 읽으면 브라우저 언어, 그것도 아니면 ko.
  // ko 로 떨어뜨리는 건 '한국 서비스'라서가 아니라, 판단 근거가 없을 때의 기본값이다.
  guessLocale(){
    const tz=(()=>{ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){ return ''; } })();
    if(tz==='Asia/Seoul' || tz==='Asia/Pyongyang') return 'ko';
    const ZH=['Asia/Shanghai','Asia/Chongqing','Asia/Harbin','Asia/Urumqi',
              'Asia/Macau','Asia/Hong_Kong','Asia/Taipei'];
    if(ZH.indexOf(tz)>=0) return 'zh-CN';

    const langs=(typeof navigator!=='undefined'
      && (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]))||[];
    for(const raw of langs){
      const l=String(raw||'').toLowerCase();
      if(l.startsWith('ko')) return 'ko';
      if(l.startsWith('zh')) return 'zh-CN';
      if(l.startsWith('en')) return 'en';
    }
    // 타임존은 읽혔는데 한국·중화권이 아니고 언어도 못 맞췄다 → 해외로 보고 영어.
    // 타임존조차 못 읽으면 근거가 없으니 기본값 ko 로 둔다.
    return tz? 'en' : 'ko';
  },

  setLocale(k){
    this._trCache={};
    this.setHtmlLang(k);
    // 아직 안 받은 사전이면 받아 온다(첫 화면에서는 쓸 것만 받는다).
    this.fetchLocale(k);
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

  // 한국어 원본. 이 목록이 곧 '번역해야 할 것'의 정의다.
  KO_BASE(){
    return {
      'cmp.emptySubFive':'관심 있는 상권을 2~5곳 나란히 놓고 볼 수 있어요.',
      'cmp.fullFive':'비교 5곳 꽉 찼어요','cmp.remove':'비교에서 빼기','cmp.saveCount':'후보지에 저장 ({n}/5)',
      'bep.daysHint':'1~31일','bep.inputDays':'영업일 (일/월)','bep.inputLabor':'인건비 (만원)',
      'bep.inputManagement':'관리비 (만원)','bep.inputRevenue':'예상 매출 (만원)',
      'bep.laborAuto':'비우면 직원 수 × 250만원','bep.management':'관리비','bep.manual':'직접 넣은 값',
      'bep.noneBlank':'없으면 비워 두세요','bep.quickBep':'손익분기 매출','bep.quickDaily':'하루 필요 매출',
      'bep.quickFixed':'월 고정비','bep.quickProfit':'예상 영업이익','bep.quickVariable':'예상 변동비',
      'bep.revAuto':'비우면 상권 참고 매출 시나리오 사용','bep.revMine':'내 예상 매출','prep.continue':'창업 준비로 계속',
      'bep.dayWhyDays':'손익분기 매출 {bep} ÷ 영업일 {days}일 ÷ {src} {unit}원. 여러 명이 함께 결제하면 실제 고객 수와 결제 건수는 달라질 수 있어요. 시간대 비중은 서울 전체 {ind} 평균이에요.',
      'common.beforeLookup':'조회 전','common.noData':'자료 없음','common.people':'명','common.place':'곳',
      'nav.place':'자리 찾기','nav.compare':'후보 비교','nav.prep':'창업 준비','nav.more':'더 보기',
      'home.stepsTitle':'오픈 전 판단, 네 단계면 돼요',
      'home.step1':'자리 찾기','home.step1Body':'지도에서 직접 위치를 골라요.',
      'home.step2':'경쟁 확인','home.step2Body':'500m 안의 동종업체를 봐요.',
      'home.step3':'돈 되는지 계산','home.step3Body':'내 비용으로 본전선을 계산해요.',
      'home.step4':'창업 준비','home.step4Body':'계약 전 확인사항을 체크해요.',
      'map.addressResolving':'선택한 위치의 주소를 확인 중이에요','map.brandEstimate':'이름 기준 참고 분류',
      'map.competitorCount':'주변 동종업체','map.detail':'정밀 분석 보기','map.dongBasis':'{dong} 행정동 기준',
      'map.eyebrow':'1단계 · 자리 찾기','map.footTraffic':'유동인구','map.franchise':'프랜차이즈',
      'map.franchiseRatio':'프랜차이즈 비율','map.hideCompetitorPins':'업체 핀 숨기기','map.independent':'개인점포',
      'map.loadingNearby':'주변 업체를 확인하고 있어요.','map.loadingShort':'조회 중','map.majorBrands':'주요 프랜차이즈',
      'map.nearby':'주변 업체 보기','map.nearbyTitle':'주변 동종업체','map.noNearby':'500m 안에서 검색된 동종업체가 없어요. 검색 결과는 실제 영업 현황과 다를 수 있어요.',
      'map.noPhone':'전화번호 없음','map.pickHint':'지도를 눌러 분석할 위치를 정하세요.','map.radiusBasis':'선택 지점 500m · 자동 기준',
      'map.rankLabel':'{n}순위',
      'prep.eyebrow':'창업 준비','prep.title':'{ind} 오픈 전 체크','prep.sub':'계약 전에 확인할 것부터 오픈을 알리는 일까지 한곳에서 체크하세요.',
      'prep.progress':'창업 준비 {pct}%','prep.progressDetail':'{done} / {total} 완료',
      'prep.groupContract':'계약 전 확인','prep.groupOpening':'오픈 전 준비','prep.groupMarketing':'오픈 알리기',
      'prep.itemUse':'건축물 용도 확인','prep.itemUseDetail':'선택 업종이 가능한 용도인지 건축물대장과 관할 기관에서 확인',
      'prep.itemLease':'임대차계약 핵심 조항 확인','prep.itemLeaseDetail':'기간·갱신·원상복구·중도해지·업종 제한을 계약서에서 확인',
      'prep.itemPremium':'권리금 범위와 근거 확인','prep.itemPremiumDetail':'시설·영업·바닥 권리금을 나눠 적고 증빙 확인',
      'prep.itemPower':'전기 용량 확인','prep.itemPowerDetail':'필요 장비를 동시에 켤 수 있는지 계약 전에 확인',
      'prep.itemHvac':'냉난방·환기 확인','prep.itemHvacDetail':'실외기 위치와 추가 공사 가능 여부 확인',
      'prep.itemSign':'간판 설치 가능 여부','prep.itemSignDetail':'건물 규정과 관할 구청 기준 확인',
      'prep.itemParking':'주차·상하차 동선 확인','prep.itemParkingDetail':'고객과 납품 차량의 실제 접근 동선 확인',
      'prep.itemWater':'급배수 상태 확인','prep.itemWaterDetail':'싱크·제빙기·세척 장비 위치와 배수 구배 확인',
      'prep.itemExhaust':'배기·덕트 설치 가능 여부','prep.itemExhaustDetail':'냄새·열 배출 경로와 건물 동의 여부 확인',
      'prep.itemToilet':'화장실 위치와 상태','prep.itemToiletDetail':'고객 동선과 공용 여부 확인',
      'prep.itemNoise':'소음·시술 설비 제한 확인','prep.itemNoiseDetail':'건물 관리규약과 이웃 점포 영향을 확인',
      'prep.itemBusiness':'사업자등록 준비','prep.itemBusinessDetail':'사업 시작 전 또는 시작일부터 20일 안에 신청',
      'prep.itemPermit':'업종별 신고·허가 확인','prep.itemPermitDetail':'업종과 영업 형태에 따라 관할 기관에 확인',
      'prep.itemHygiene':'위생교육과 영업신고 준비','prep.itemHygieneDetail':'업종별 교육 대상과 신고 서류를 공식 안내에서 확인',
      'prep.itemTerminal':'카드단말기·결제 준비','prep.itemTerminalDetail':'통신과 설치 일정을 오픈 전에 확인',
      'prep.itemSupplier':'공급처·납품 동선 점검','prep.itemSupplierDetail':'최소 주문량·납기·보관공간을 확인',
      'prep.itemEquipment':'장비 설치와 시운전','prep.itemEquipmentDetail':'전기·급배수·환기와 함께 실제 작동 확인',
      'prep.itemMenu':'메뉴·서비스와 가격 확정','prep.itemMenuDetail':'원가율과 주변 경쟁 가격을 함께 확인',
      'prep.itemNaver':'네이버 플레이스 등록','prep.itemNaverDetail':'주소·영업시간·메뉴와 오픈일을 정확히 등록',
      'prep.itemKakao':'카카오맵 매장 등록','prep.itemKakaoDetail':'검색과 길찾기에서 매장이 확인되는지 점검',
      'prep.itemWalk':'현장 보행 동선 확인','prep.itemWalkDetail':'출근·점심·저녁과 평일·주말을 나눠 직접 확인',
      'prep.itemOpening':'오픈 첫 2주 안내 준비','prep.itemOpeningDetail':'주변 수요와 경쟁을 확인한 뒤 시간대와 대상을 좁혀 실행',
      'prep.sourceNts':'국세청 사업자등록 안내','prep.sourceFoodSafety':'식품안전나라 위생교육 안내',
      'prep.adviceProfit':'가격과 수익 기준부터 정하기','prep.adviceProfitBasis':'이 상권의 점포당 참고 월매출은 {sales}이에요(예요).','prep.adviceProfitAction':'미래 매출 보장값으로 쓰지 말고, 내 임대료·인건비를 넣어 본전선과 비교하세요.',
      'prep.adviceWalk':'현장 동선 확인하기','prep.adviceWalkBasis':'{dong} 행정동 하루 유동인구는 {people}명이고, {age} 비중이 가장 커요.','prep.adviceWalkAction':'이 수치는 행정동 전체 값이에요. 계약 전 출근·점심·저녁 시간의 점포 앞 보행을 직접 확인하세요.',
      'prep.adviceCompete':'경쟁과 정면 가격승부 피하기','prep.adviceGap':'가까운 경쟁점의 빈틈 확인하기','prep.adviceCompetitorBasis':'선택 지점 500m 안에서 검색된 동종업체는 {total}곳이고, 이름 기준 프랜차이즈 추정은 {fr}곳입니다.',
      'prep.adviceCompeteAction':'가까운 점포의 메뉴·가격·대기시간을 직접 보고 차별화할 한 가지를 정하세요.','prep.adviceGapAction':'가까운 점포의 영업시간·메뉴·리뷰를 확인해 비어 있는 시간이나 상품을 찾으세요.',
      'prep.advicePick':'분석할 자리를 먼저 고르기','prep.advicePickBasis':'아직 위치에 연결된 상권 자료가 없어요.','prep.advicePickAction':'지도에서 위치를 찍으면 이 자리의 수요와 경쟁을 근거로 준비 순서를 바꿔 드려요.',
      'prep.adviceListings':'검색 지도에 오픈 정보 맞추기','prep.adviceListingsBasis':'선택한 업종과 주소는 검색 지도에서 고객이 확인할 기본 정보예요.','prep.adviceListingsAction':'오픈 전에 네이버 플레이스와 카카오맵의 주소·영업시간·대표 메뉴를 같은 내용으로 등록하세요.',
      'prep.adviceTitle':'이 자리에서 먼저 할 일','prep.caution':'인허가·건축물 용도는 업종, 건물, 관할 기관에 따라 달라질 수 있어요. 계약 전에 관할 구청과 공식 안내를 다시 확인하세요.',
      'prep.mapCta':'자리 다시 보기','prep.bepCta':'손익 계산','prep.compareCta':'후보 비교','prep.noPlace':'선택한 자리 없음',
      'map.referenceSales':'상권 참고 월매출','map.salesCaution':'새 가게 매출 예측 아님','map.save':'후보지에 저장','map.saved':'저장됨 · 빼기',
      'map.searchButton':'위치 찾기','map.searchEmpty':'주소나 건물명을 입력해 주세요.','map.searching':'찾는 중…','map.searchNone':'서울에서 해당 위치를 찾지 못했어요.',
      'map.searchPlaceholder':'주소 또는 건물명 검색','map.showCompetitorPins':'지도에서 업체 보기',
      'map.sub':'주소를 찾거나 지도를 눌러 위치를 고르세요. 분석 반경은 자동으로 적용돼요.',
      'map.summaryBoth':'유동은 강한 편이지만 주변 동종업체 경쟁도 높은 위치입니다.',
      'map.summaryCompetition':'주변 동종업체가 많은 편입니다. 가까운 점포의 가격과 영업시간을 확인하세요.',
      'map.summaryDemand':'행정동 유동인구는 높은 편입니다. 실제 점포 앞 시간대별 보행은 현장에서 확인하세요.',
      'map.summaryNeutral':'수요와 경쟁 수치를 함께 보고 현장 동선을 확인할 위치입니다.','map.title':'분석할 자리를 찍어 주세요',
      'customer.title':'설문을 저장할까요?',
      'customer.explain':'동의하면 설문 답과 이메일을 운영자에게 전달해요. 저장하지 않아도 분석과 다운로드는 이용할 수 있어요.',
      'customer.agree':'설문·이메일 저장에 동의해요 (선택)',
      'customer.save':'설문 저장','customer.saving':'저장 중…',
      'customer.saved':'설문을 저장했어요. 이메일 발송과는 별도예요.',
      'customer.failed':'저장하지 못했어요. 동의와 이메일을 확인한 뒤 다시 시도해 주세요.',
      'customer.retention':'보유 기간: {days}일 · 문의: {contact}',
      'nav.zone':'상권분석','nav.fine':'정밀분석',
      'pr.seoulAll':'서울 전체','nav.market':'통합시세','nav.report':'리포트',
      'menu.zoneCompare':'지역비교','menu.find':'후보지',
      'menu.sweep':'자치구 훑기','menu.map':'지도','menu.detail':'정밀분석',
      'menu.sim':'정밀비교','menu.bep':'본전 계산',
      'map.loading':'지도를 불러오는 중이에요',
      'map.unavailable':'지도를 불러올 수 없어요. 아래 목록에서 상권을 선택할 수 있어요.',
      'map.noPosition':'표시할 상권 위치가 없어요.',
      'map.failed':'지도를 불러오지 못했어요. 아래 목록은 계속 사용할 수 있어요.',
      'map.pick':'{zone} 선택',
      'map.summary':'{zone} 간단 정보',
      'map.currentIndustry':'선택 업종 · {industry}',
      'map.monthlyPerStore':'상권 참고 매출',
      'map.stores':'같은 업종 가게',
      'map.recommendations':'먼저 볼 업종',
      'map.recommendationBasis':'이 상권 자료에 포함된 업종의 점포당 참고 매출 순 · 5곳 이하는 뒤로 · 입지 추천 아님',
      'map.rank':'{n}순위',
      'map.clickHint':'번호를 누르면 상권 참고 매출과 먼저 볼 업종 1~3순위가 바로 떠요.',
      'privacy.aboutOff':'현재 설문·이메일 저장과 메일 발송은 꺼져 있어요. 최근 검색·화면 설정은 이 브라우저에 남고, 접속 로그는 서버에 남을 수 있어요.',
      'privacy.aboutOptional':'설문·이메일 저장과 이용 통계는 각각 동의한 경우에만 처리해요. 최근 검색·화면 설정은 이 브라우저에 남고, 접속 로그는 서버에 남을 수 있어요.',
      'footer.contact':'문의 이메일',
      'footer.pending':'준비 중',
      'footer.eyebrow':'문의',
      'footer.title':'서비스 이용 문의',
      'footer.description':'회사 문의 이메일을 연결하면 이 자리에 표시돼요.',
      'footer.ready':'아래 이메일로 서비스 이용 문의를 보내 주세요.',

      'hub.peekTop':'{ind} · {n}곳 중 1위 {zone}',
      'home.stamp':'서울 상권 {n}곳 · {q} 기준',
      'home.eyebrow':'내 장사의 시작, 데이터로 한 걸음 더',
      'home.title':'어디에서 장사할지 고민되세요?',
      'home.sub':'업종을 고르고 지도에서 자리를 찍으면 경쟁과 손익, 계약 전 준비까지 이어서 확인할 수 있어요.',
      'home.location':'위치','home.locationAny':'서울 전체',
      'home.industry':'어떤 장사를 생각하시나요?','home.industryHint':'예: 카페, 편의점',
      'home.start':'내 가게 자리 찾기','home.popular':'인기 검색',
      'common.reset':'기본값으로 복원',
      'common.preparing':'데이터 준비 중',

      'settings.title':'설정','settings.appearance':'화면','settings.light':'밝게',
      'settings.dark':'어둡게','settings.system':'시스템 설정',
      'settings.language':'언어','settings.theme':'테마','settings.chartColors':'차트 색상',
      'settings.textPrimary':'본문 글자',
      'settings.textSecondary':'보조 글자','settings.custom':'직접 설정',
      'settings.adv':'고급 설정','settings.advClose':'고급 설정 닫기',
      'settings.background':'배경색',
      'settings.i18nNote':'상권 이름·업종 이름과 자료에서 만들어지는 문장은 아직 한국어예요.',

      // 이름·숫자가 들어가는 문장은 자리표시자를 둔 키로 관리한다(조사는 tn 이 고른다)
      "mk.waitTitle": "{name} — 데이터 준비 중",
      "mk.waitText": "{src} 자료가 연결되면 여기에 그래프가 떠요. 아직 연결 전이라 값을 보여드리지 않아요 — 없는 숫자는 지어내지 않아요.",
      "mk.chartCount": "차트 {n}개",
      "mk.waitingCats": "{names} 시세는 준비 중이에요.",
      "mv.seoulInd": "서울 전체 · {ind}",
      "mv.tmzSeoulSub": "{ind} · 서울 전체 매출 구성비 (추정)",
      "op.loading": "최근 개·폐업 자료를 불러오는 중이에요.",
      "op.wait": "최근 개·폐업 자료는 준비 중이에요. 연결되면 이 근처에 새로 연 가게와 닫은 가게가 여기 떠요.",
      "op.count": "{n}곳",
      "op.bigLabel": "최근 {days}일 · 반경 {r}m 안에 새로 연 음식점·카페",
      "op.verdict": "새로 연 가게 {o}곳 · 닫은 가게 {c}곳이에요.",
      "op.none": "최근 {days}일 동안 반경 {r}m 안에 새로 열거나 닫은 음식점·카페가 없어요.",
      "op.opened": "열림",
      "op.closed": "닫음",
      "op.note": "지방행정인허가 개방자료 기준({since}~{until})이에요. 신고 날짜라 실제 개업·폐업일과 며칠 다를 수 있고, 거리는 상권 중심까지 직선거리예요.",
      "op.save": "이 상권을 내 가게 자리로 저장",
      "op.saved": "내 가게로 저장돼 있어요 · 해제",
      "op.mine": "내 가게 주변 요즘",
      "op.mineSub": "새로 연 {o}곳 · 닫은 {c}곳 · 최근 {days}일",
      "op.mineWait": "개·폐업 자료 준비 중",
      "fact.dongPop": "{dong} 하루 유동인구가 {n}명이에요",
      "reason.salesBody": "비슷한 가게 한 곳이 한 달에 {amt}쯤 팔아요.",
      "reason.popSample": "유동인구 {n}명 · {dong}",
      "reason.compBody": "같은 장사가 {n}곳 있어요.",
      "reason.compPer": "사람 1만 명당 {v}개예요.",
      "rank.ofPlaces": "{n}곳 중 {r}위",
      "pop.noteLong": "유동인구는 {dong} 행정동 전체 값이에요. 이 자리만의 숫자는 아니라서 참고로만 봐 주세요.",
      "pop.dongDaily": "{dong} 행정동 · 하루 {n}명",
      "pop.noteShort": "유동인구는 {dong} 행정동 값이에요. 상권보다 넓은 단위라 이 자리만의 값은 아니에요.",
      "pop.dongDailyBasis": "{dong} 행정동 하루 기준",
      "pop.dongOnly": "{dong} 행정동",
      "pop.noteWide": "유동인구는 {dong} 행정동 값이라 상권보다 넓어요. 시간대·요일 데이터는 아직 없어요.",
      "mv.peopleOf": "{name} 사람 구성",
      "mv.bepOf": "{name} 본전 계산",
      "mv.noGuData": "자료 없음",
      "mv.topPerStore": "점포당 참고 매출 1위 · {value}",
      "cmp.noZone": "‘{q}’와(과) 맞는 상권이 없어요. 상권 이름이나 구 이름으로 찾아보세요.",
      "cmp.diffBoth": "상권 소비 규모가 가장 큰 곳은 {a}, 경쟁이 가장 적은 곳은 {b}이에요(예요).",
      "cmp.diffSame": "{a}은(는) 상권 소비 규모가 가장 크면서 경쟁도 가장 적어요.",
      "cmp.diffSales": "상권 소비 규모가 가장 큰 곳은 {a}이에요(예요). 경쟁 가게 수는 {tie}.",
      "cmp.diffStore": "경쟁이 가장 적은 곳은 {b}이에요(예요). 상권 소비 규모는 {tie}.",
      "cmp.diffTie": "상권 소비 규모와 경쟁 가게 수가 모두 같아요. 이 두 항목으로는 우열을 가릴 수 없어요.",
      "cmp.diffPer": "점포당 참고 매출은 {name}이(가) {amt}으로 가장 높아요.",
      "cmp.diffPerTie": "점포당 참고 매출은 {tie}. 이 항목으로는 구분되지 않아요.",
      "search.noZone": "‘{q}’와(과) 맞는 동네가 없어요",
      "search.noInd": "‘{q}’와(과) 맞는 장사가 없어요",
      "search.noHit": "‘{q}’와(과) 맞는 게 없어요",
      "sido.notYet": "‘{sido}’ 자료는 아직 없어요. 지금은 서울 상권 1,564곳만 볼 수 있어요. 다른 지역은 준비 중이에요.",
      "pr.spendByGu": "자치구별 ‘{name}’ 지출 비중",
      "rent.refOf": "{name} 기준 (한국부동산원)",
      "rent.perSqm": "{value}/㎡ · {note}",
      "bep.scenNote": "공개 통계의 {ind} 점포당 상권 참고 매출을 기준 가정으로 써요. 새 가게의 매출 예측은 아니에요.",
      "bep.dayWhy": "본전 {bep} ÷ 30일 ÷ {src} {unit}원. 이 금액은 카드 1건당 결제액이라, 여러 명이 함께 결제하면 실제 손님 수와 결제 건수는 달라요. 시간대 비중은 서울 전체 {ind} 평균이에요.",
      "sat.lead": "사람 1만 명당 {ind}이(가) {v}개예요. 서울 중앙값은 {med}개라 {word}이에요(예요).",
      "rent.perNote": "{per} · {note}",
      "find.noRecordIn": "{zone}은(는) 이 업종 기록이 없어 현재 비교군의 첫 후보를 보여줘요",
      "zc.pickedTitle": "{gu} 기준으로 견주기",
      "asOf": "{q} 기준",
      "surv.mo": "{n}개월",
      "surv.vsSeoul": "서울 중앙값 {v}",
      "surv.y": "{y}년",
      "surv.ym": "{y}년 {m}개월",
      "sido.wait": "‘{region}’ 자료는 아직 없어요. 지금은 서울 상권 1,564곳만 볼 수 있어요. 다른 지역은 준비 중이에요.",
      "sido.waitFind": "{region} 지역은 아직 준비 중이에요. 지금은 서울 상권 1,564곳만 볼 수 있어요.",
      "zc.lead": "{ind}은(는) {gu}가 가게 한 곳당 가장 많이 팔아요.",
      "cmp.verdictClear": "{name}이(가) ‘{preset}’ 기준에서 저장한 후보 중 종합 1위예요.",
      "cmp.verdictClose": "{name}이(가) 조금 앞서요. ‘{preset}’ 기준에서 1·2위 차이가 크지 않아요.",
      "cmp.honesty": "같은 기간({q}) 같은 업종({ind})으로만 비교해요. 카드와 차트의 색은 상권을 구분하는 색이지 좋고 나쁨이 아니에요. 순위는 지금 고른 기준에서의 순위이고, 기준을 바꾸면 달라져요.",
      "mv.eyebrow": "{ind} · {zone}",
      "mv.guWhere": "{gu} 안에서 여기는 어디쯤인가요?",
      "mv.guPop": "{gu} 안에서 사람이 가장 많은 곳은?",
      "mv.guComp": "{gu} 안에서 경쟁이 센 곳은?",
      "mv.guSpend": "{gu} 사람들은 어디에 돈을 쓰나요?",
      "fc.lead": "{gu}에서 {ind} 점포당 참고 매출이 가장 높은 곳은 {top}이에요(예요).",
      "fc.note": "{gu} 안에서 자료가 있는 상권 {n}곳을 점포당 참고 매출로 줄 세웠어요.",
      "chat.noData": "아직 데이터를 불러오지 못했어요. 잠시 후 다시 물어봐 주세요.",
      "chat.where.text": "{ind} 비교 후보로 {zone}을(를) 먼저 확인해 보세요.",
      "chat.where.score": "기회점수",
      "chat.where.stores": "경쟁 가게",
      "chat.where.per": "점포당 참고 매출",
      "chat.where.src": "서울시 상권분석서비스 {q} 자료로 계산했어요. 기회점수는 저희가 만든 값이에요.",
      "chat.where.cta": "후보지에서 전체 순위 보기",
      "chat.rent.text": "임대료는 알려드릴 수 없어요.",
      "chat.rent.src": "한국부동산원이 이 상권 체계로 임대료를 공표하지 않아 원자료에 없어요. 지어내지 않아요. 중개인에게 확인한 금액을 본전 계산에 직접 넣으시면 그 값으로 계산해 드려요.",
      "chat.rent.cta": "본전 계산으로 가기",
      "chat.bep.text": "{zone}에서 월 {amt}을(를) 팔면 본전이에요.",
      "chat.bep.bep": "본전선",
      "chat.bep.avg": "이 자리 평균",
      "chat.bep.fixed": "고정비",
      "chat.bep.src": "임대료 {rent} · 원가율 {cogs}% · {area}평 기준이에요. 조건을 바꾸면 값도 바뀌어요.",
      "chat.bep.cta": "조건 바꿔 계산하기",
      "chat.cust.none": "이 장사의 손님 데이터가 없어요.",
      "chat.cust.text": "{ind}에 돈을 쓰는 사람은 {age}이(가) 가장 많아요.",
      "chat.cust.female": "여성",
      "chat.cust.unit": "손님 1명이 쓰는 돈",
      "chat.cust.src": "서울 전체 {ind} 카드 결제 기준이에요. 동네별 성별·연령은 공개되지 않아요.",
      "chat.risk.none": "이 장사의 개·폐업 데이터가 없어요.",
      "chat.risk.down": "{ind}은(는) 지금 가게가 줄고 있어요.",
      "chat.risk.up": "{ind}은(는) 지금 가게가 늘고 있어요.",
      "chat.risk.closed": "문 닫은 곳",
      "chat.risk.opened": "새로 연 곳",
      "chat.risk.fr": "프랜차이즈",
      "chat.risk.src": "3개월 기준이에요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 데이터가 구분하지 않아요.",
      "chat.none.text": "그 질문에는 답할 근거가 없어요.",
      "chat.none.src": "답할 수 있는 것은 업종별 기회 상권, 본전 계산, 손님 구성, 개·폐업 추이예요. 임대료·권리금·건물 공실은 공개 통계에 없어 답하지 않아요.",
      "diag.thinAvg": "계산의 출발점인 이 자리 {ind} 평균은 {n}곳만의 평균이에요. 잘되는 한 집이 평균을 끌어올리니, 아래 ‘내 조건 바꾸기’에서 ‘보수적’으로 낮춰 보세요.",
      "find.guHint": "{gu}를(을) 한 번 더 누르면 이 구에서 찾아요",
      "pr.guMissing": "{n}개 구는 원자료에 없어 목록에서 빠졌어요({names}).",
      "chat.hello": "{ind} 기준으로 볼 수 있는 내용을 정리했어요. 궁금한 항목을 고르거나 직접 입력해 보세요.",
      "rg.share": "{ind}은(는) 이 동네에서 손님이 쓴 돈의 {pct}%를 차지해요.",

      "gu.border": "{a}·{b} 경계",
      "rent.basis": "{name} 기준",
      "rent.region": "권역 참고값 · 이 상권 값은 아니에요",
      "pr.rentUnit": "㎡당 월 임대료",
      "market.area": "조사 권역",
      "market.zone": "조사 상권",
      "market.industry": "업종",
      "market.gu": "자치구",
      "market.rentScope": "임대료·공실률은 조사 상권 기준이에요. 자치구나 업종별 값은 제공되지 않아요.",
      "market.seoulScope": "서울 전체 업종별 자료예요. 자치구별 시계열은 아직 제공되지 않아요.",
      "market.spendScope": "자료가 있는 자치구를 고를 수 있어요. 소비 구성은 가구 기준이에요.",
      "cmp.browseTitle": "어느 상권을 비교해 볼까요?",
      "cmp.browseHint": "상권 이름을 몰라도 괜찮아요. 구를 고르고 목록에서 최대 5곳을 담아 보세요.",
      "cmp.browseCount": "이 업종으로 비교할 수 있는 상권 {n}곳",
      "cmp.browseEmpty": "이 조건에 맞는 상권이 없어요. 구나 검색어를 바꿔 보세요.",
      "cmp.selected": "선택됨",
      "cmp.add": "담기",
      "cmp.more": "상권 더 보기",
      "pr.vacancy": "빈 상가 비율",
      "pr.vs2y": "2년 전 대비",
      "pr.trendRent": "{name} 임대료 추이",
      "pr.trendVac": "{name} 공실률 추이",
      "pr.cmpRent": "상권별 임대료 비교",
      "pr.cmpVac": "상권별 공실률 비교",
      "pr.seoulRent": "서울 전체 임대료 추이",
      "pr.seoulVac": "서울 전체 공실률 추이",
      "diag.left": "월 {amt} 남아요",
      "diag.short": "월 {amt} 모자라요",
      "diag.leftLabel": "남는 돈 {amt}",
      "diag.cond": "{area}평 · 임대료 {rent} · 직원 {n}명",
      "diag.fixed": "고정비 {amt}을 못 덮어요",
      "mv.title": "{zone} × {ind}",
      "mv.head": "{ind} · {zone}",
      "find.rank": "{ind} · {n}곳 중 {r}위",
      "find.rankScoped": "{scope} · {ind} 자료가 있는 {n}곳 중 {r}위",
      "find.rankCount": "비교 가능한 {n}곳 중 {r}위",
      "find.relativeHigh": "현재 비교 기준에서 상대적으로 높은 후보예요.",
      "find.relativeMid": "현재 비교 기준에서 중간 수준 후보예요.",
      "find.relativeLow": "현재 비교 기준에서는 낮은 편이라 근거를 더 확인해 보세요.",
      "find.gradeHigh": "비교상 높음",
      "find.gradeUpper": "비교상 다소 높음",
      "find.gradeMid": "비교상 보통",
      "find.gradeLow": "비교상 낮음",
      "find.demandTop": "{scope}에서 이 업종 자료가 있는 {n}곳 중 상권 소비 규모 1위예요",
      "find.demandHigh": "상권 소비 규모가 높아요 · 비교 가능한 곳 중 상위 {pct}%",
      "find.demandMid": "상권 소비 규모는 중간 수준이에요 · 비교 가능한 곳 중 상위 {pct}%",
      "find.demandLow": "상권 소비 규모가 낮아요 · 비교 가능한 곳 중 상위 {pct}%",
      "find.whySalesHigh": "{scope} 비교군 중앙값보다 상권 소비 규모가 높아요",
      "find.whySalesLow": "{scope} 비교군 중앙값보다 상권 소비 규모가 낮아요",
      "find.whyCompLow": "{scope} 비교군 중앙값보다 같은 업종 경쟁 점포가 적어요",
      "find.whyCompHigh": "{scope} 비교군 중앙값보다 같은 업종 경쟁 점포가 많아요",
      "find.whyPerHigh": "{scope} 비교군에서 점포당 참고 매출이 높은 편이에요",
      "find.scoreFormula": "기회점수 = 상권 소비 규모 45% + 경쟁 점포가 적은 정도 35% + 점포당 참고 매출 20%",
      "find.scoreScope": "{scope}에서 이 업종 자료가 있는 {n}곳끼리 백분위로 비교했어요. 임대료와 유동인구는 이 점수에 넣지 않았어요.",
      "reason.salesReference": "이 상권의 {ind} 매출을 점포 수로 나누면 월 {amt}이에요(예요). 새 가게의 예상 매출은 아니에요.",
      "find.ok": "{ind} 후보로는 괜찮은 자리예요.",
      "rentPer": "{amt}/월",

      "mv.popLabel": "{dong} 행정동 하루 유동인구",
      "mv.noPop": "유동인구 자료가 없어요",
      "mv.estMedian": "(추정) · 서울 중앙값 {amt}",
      "fc.none": "{gu}에는 {ind} 자료가 있는 상권이 없어요.",
      "fc.pickOther": "다른 자치구를 골라 보세요.",

      "mv.question": "{zone}에서 {ind}을(를) 시작해도 괜찮을까요?"

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
  // 짝을 적어 두면 앞 글자 받침을 보고 고른다. '이에요(예요)' 를 '이(가)' 보다 먼저 둔다 —
  // 뒤에 두면 '이(가)' 규칙이 '이에요(예요)' 의 앞부분만 먹는다.
  const PAIR=/(은\(는\)|는\(은\)|이에요\(예요\)|예요\(이에요\)|라면\(이라면\)|이라면\(라면\)|와\(과\)|과\(와\)|이\(가\)|가\(이\)|을\(를\)|를\(을\))/g;
  return String(s).replace(PAIR, (pair, _g, at, whole)=>{
    // 따옴표·괄호는 건너뛰고 그 앞 글자를 본다 — ‘역삼’과 / ‘강남’와
    let i=at-1;
    while(i>=0 && /[’‘'"”“」』\)\]]/.test(whole[i])) i--;
    const prev=i>=0? whole[i] : '';
    const c=prev.charCodeAt(0)-0xAC00;
    const bat=(c>=0&&c<11172)? c%28!==0 : /[013678lmnr]$/i.test(prev);
    if(pair.indexOf('은')===0||pair.indexOf('는')===0) return bat?'은':'는';
    if(pair.indexOf('이에요')===0||pair.indexOf('예요')===0) return bat?'이에요':'예요';
    if(pair.indexOf('라면')===0||pair.indexOf('이라면')===0) return bat?'이라면':'라면';
    if(pair.indexOf('와')===0||pair.indexOf('과')===0) return bat?'과':'와';
    if(pair.indexOf('이')===0||pair.indexOf('가')===0) return bat?'이':'가';
    return bat?'을':'를';
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
