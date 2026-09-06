'use strict';
globalThis.MysbizonLogic = function(DCLogic, React) {


class Component extends DCLogic {
  state = {
    zi:null, sbi:null, sti:null, rentStats:null, salesHistory:null, err:'',
    q:'', ind:'커피-음료', sel:null, picks:null, screen:'home', menu:null,
    openWhy:false, open:{cond:false,money:false,day:false,risk:false},
    scen:'보통일 때', rent:400, cogs:35, area:15,
    staffOv:null, etcOv:null
  };

  // 바깥을 누르면 열린 드롭다운(헤더 메뉴·지역 검색)을 닫는다
  // data-anim이 붙은 컨테이너에 한 번씩만 적용한다
  // 열린 패널을 기준 박스에 맞춰 배치한다. 아래가 좁으면 위로 뒤집힌다.
  placePanel(){
    const ref=document.querySelector('[data-fl-ref]'), panel=document.querySelector('[data-fl-panel]');
    if(!ref||!panel){ this._panelOpen=false; return; }
    const bounds=ref.getBoundingClientRect();
    // 예전에는 top:calc(100% + 8px) 였다. 그 100% 는 패널의 기준 상자(offsetParent) 높이인데
    // 그 상자가 검색창보다 훨씬 커서 목록이 입력칸에서 174px 나 떨어져 떴다.
    // 입력칸에 붙어야 '이 칸의 후보'로 읽힌다 → 기준 상자 대비 실제 위치를 재서 붙인다.
    const base=panel.offsetParent||panel.parentElement;
    const br=base?base.getBoundingClientRect():{top:0,left:0,bottom:0,height:0};

    // 아래가 좁으면 위로 펼친다.
    // 예전에는 화면을 스크롤해서 검색줄을 위로 올렸는데, 누른 사람 입장에서는
    // 화면이 제멋대로 움직이는 것이라 좋지 않다. 사용자는 제자리에 두고 목록만 뒤집는다.
    // 위로 펼칠 때는 고정 헤더(sticky) 아래까지만 쓴다 — 헤더에 가려지면 안 된다.
    const GAP=6, EDGE=14;
    const header=document.querySelector('header');
    const headBottom=header?header.getBoundingClientRect().bottom:0;
    const roomBelow=window.innerHeight-bounds.bottom-EDGE;
    const roomAbove=bounds.top-headBottom-EDGE;
    // 아래가 넉넉하면 그대로 아래. 좁고 위가 더 넓을 때만 뒤집는다.
    const up=roomBelow<300 && roomAbove>roomBelow;
    const pos=up
      ? {bottom:Math.round(br.height-(bounds.top-br.top)+GAP)+'px', top:'auto'}
      : {top:Math.round(bounds.bottom-br.top+GAP)+'px', bottom:'auto'};

    Object.assign(panel.style,{
      left:Math.round(bounds.left-br.left)+'px',
      ...pos,
      width:Math.round(bounds.width)+'px',
      maxHeight:Math.max(120,up?roomAbove:roomBelow)+'px',
      display:'flex',flexDirection:'column',overflow:'hidden'});
  }

  // 실제 화면을 짚어주는 둘러보기
  scrollBot(){
    const el=document.querySelector('[data-bot-log]');
    if(!el) return;
    requestAnimationFrame(()=>{ el.scrollTop=el.scrollHeight; });
  }

  // 탭을 누르면 트랙을 그 카드로 옮긴다. 손가락으로 밀면 탭이 따라온다.
  // 알약 칠하기를 한 곳에서만 한다
  paintTabs(i){
    const tabs=document.querySelector('[data-mv-tabs]');
    if(!tabs) return;
    [...tabs.children].forEach((el,j)=>{
      const on=j===i;
      // 렌더가 style 문자열을 다시 쓰므로 important로 못 박는다
      const dark=document.documentElement.getAttribute('data-theme')==='dark';
      el.style.setProperty('background-color', on?(dark?'#F5F5F7':'#191F28'):(dark?'#1C2027':'#F5F5F7'), 'important');
      el.style.setProperty('color', on?(dark?'#111418':'#FFFFFF'):(dark?'#9CA3AF':'#6B7280'), 'important');
      el.style.setProperty('font-weight', on?'600':'500', 'important');
    });
  }

  syncTrack(){
    const t=document.querySelector('[data-mv-track]');
    if(!t) return;
    // 렌더가 인라인 스타일을 되돌리니 렌더 직후 스크롤 위치대로 다시 칠한다.
    // 매 프레임 도는 루프는 화면 캡처를 깨뜨려 쓰지 않는다.
    this.paintTabs(Math.round(t.scrollLeft/(t.clientWidth+24)));
    if(!t.__bound){
      t.__bound=true;
      // 알약이 손가락을 바로 따라오게 한다 — 멈출 때까지 기다리지 않는다
      t.addEventListener('scroll',()=>{
        if(this._auto) return;
        this._userScroll=true;
        if(!this._raf) this._raf=requestAnimationFrame(()=>{
          this._raf=null;
          const k=Math.round(t.scrollLeft/(t.clientWidth+24));
          const keys=this._cardKeys||[];
          this.paintTabs(k);
          if(keys[k] && keys[k]!==(this.state.mvTab||keys[0])) this.setState({mvTab:keys[k]});
        });
        clearTimeout(this._sc);
        this._sc=setTimeout(()=>{ this._userScroll=false; },160);
      },{passive:true});
    }
  }

  // 카드로 옮긴다. 렌더 값이 늦게 계산되니 클릭 시점에 직접 움직인다.
  goCard(i,key){
    const t=document.querySelector('[data-mv-track]');
    if(t){
      this._auto=true;
      clearTimeout(this._autoT);
      this._autoT=setTimeout(()=>{ this._auto=false; },600);
      // scrollTo({behavior:'smooth'})는 mandatory 스냅에 취소된다.
      // scrollLeft 대입은 CSS scroll-behavior가 부드럽게 처리한다.
      t.scrollLeft=i*(t.clientWidth+24);
    }
    const tabs=document.querySelector('[data-mv-tabs]');
    if(tabs&&tabs.children[i]){
      const p=tabs.children[i];
      const to=Math.max(0,Math.min(p.offsetLeft-(tabs.clientWidth-p.offsetWidth)/2, tabs.scrollWidth-tabs.clientWidth));
      if(Math.abs(tabs.scrollLeft-to)>4) tabs.scrollLeft=to;
    }
    this.paintTabs(i);
    this.setState({mvTab:key});
  }

  componentDidUpdate(){
    if(this._screen!==this.state.screen){
      this._screen=this.state.screen;
      window.scrollTo({top:0,behavior:'auto'});
      // 리포트는 묻는 카드가 화면에 딱 들어오게 맞춘다.
      // 맨 위로만 올리면 제목만 보이고 정작 답할 곳이 아래에 걸린다.
      if(this.state.screen==='report') requestAnimationFrame(()=>{
        const card=document.querySelector('[data-rp-card]');
        if(!card) return;
        const r=card.getBoundingClientRect();
        const head=document.querySelector('header');
        const top=(head?head.getBoundingClientRect().height:64)+16;
        // 카드가 화면보다 길면 카드 위쪽을 헤더 바로 아래에, 짧으면 가운데에 둔다
        const y=r.height>window.innerHeight-top-24
          ? window.scrollY+r.top-top
          : window.scrollY+r.top-(window.innerHeight-r.height)/2;
        window.scrollTo({top:Math.max(0,Math.round(y)),behavior:'auto'});
      });
    }
    if(this.state.screen==='report') this.loadSupport();
    this.placePanel();this.syncTrack();
    // 차트와 가로 슬라이드는 DOM 이 그려진 뒤에 붙인다.
    // DC 가 다시 그려도 같은 canvas 면 값만 갱신한다(charts.js 참조).
    this.paintCharts(); this.bindRails();
    // 마크업에 그대로 적힌 한국어를 옮긴다(한국어일 때는 아무 일도 안 한다)
    this.trDom();
  }

  // 지원사업 공고 — 리포트 화면에 처음 들어올 때 한 번만 부른다.
  // 키가 없으면 서버가 configured:false 로 답하고, 화면은 '아직 연결되지 않았습니다'를 띄운다.
  // 예시 공고를 지어내지 않는다(CLAUDE.md 데이터 정직성).
  loadSupport(){
    if(this._spLoading||this.state.sp) return;
    this._spLoading=true;
    fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
      signal:AbortSignal.timeout(15000)})
      .then(r=>r.json())
      .then(j=>this.setState({sp:j}))
      .catch(()=>this.setState({sp:{ok:false,configured:true,items:[],
        error:'공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}}))
      .finally(()=>{this._spLoading=false;});
  }

  componentWillUnmount(){
    if(this._out) document.removeEventListener('click',this._out,false);
    if(this._rz) window.removeEventListener('resize',this._rz);
    if(this._raf) cancelAnimationFrame(this._raf);
    if(this._ro) this._ro.disconnect();
    clearTimeout(this._sc);clearTimeout(this._autoT);clearTimeout(this._panelT);
  }

  // 미디어 쿼리를 쓸 수 없으므로 폭을 재서 분기한다

  // ── 디자인 시스템 ────────────────────────────────────────────────
  // 카드·제목·숫자 스타일을 한 곳에서만 정한다. 화면마다 조금씩 다른 값을
  // 쓰다 보니 같은 정보가 화면마다 다르게 보였다.

  // ── 임대료 ────────────────────────────────────────────────────
  // 상권 1,564곳 단위 임대료는 아직 없다. 있는 건 한국부동산원 임대동향조사
  // (서울 63개 상권 · 권역 · 서울 전체)뿐이라, 이름이 정확히 맞는 상권만
  // 그 값을 쓰고 나머지는 서울 평균을 '이 상권 값이 아니다'라고 밝혀 보여준다.
  // 지어내지 않되 '데이터 없음'으로 비워 두지도 않는다.
  // ※ 상권 단위 정확도는 서울시 상권분석서비스의 환산임대료가 들어와야 얻어진다
  //   (backend/collect_zone_rent.py — 승인 대기).

  // 숫자 하나를 '지표 → 값 → 의미' 3단으로 만든다.
  // tone 은 부호가 아니라 '사장님에게 좋은지'로 정한다 —
  // 경쟁 점포가 30% 많은 건 + 지만 좋은 값이 아니다.

  // 매출처럼 한쪽으로 크게 쏠린 값은 '중앙값 대비 1107% 많아요'가 나온다.
  // 숫자는 맞지만 사람이 못 읽는다. 이런 지표는 백분위로 말한다.

  // 서울 중앙값과 견준 한 줄. good 이 true 면 '많을수록 좋은' 지표다.

  componentDidMount(){
    // 저장해 둔 화면 설정(밝기·테마·색)과 언어를 먼저 얹는다 — 얹기 전에 그리면 한 번 번쩍인다
    try{ this.loadTheme(); this.loadLocales(); }catch(e){}
    // 처음 온 분에게만 소개·사용법을 띄운다.
    // '시작하기'를 누르면 다시 안 뜨고, '일주일 동안 안 보기'는 그 기간만 쉰다.
    // localStorage 가 막힌 브라우저(사생활 보호 모드 등)에서는 그냥 띄우지 않는다 —
    // 매번 뜨는 것보다 안 뜨는 쪽이 덜 성가시다.
    try{
      const seen = localStorage.getItem('mysbizon.noticeSeen');
      const until = Number(localStorage.getItem('mysbizon.noticeUntil')||0);
      if(!seen && !(until && Date.now() < until)) this.setState({notice:true});
    }catch(e){}
    // 첫 그림 뒤에도 한 번 — componentDidUpdate 는 첫 렌더에서 안 불린다
    setTimeout(()=>{ try{ this.paintCharts(); this.bindRails(); this.trDom(); }catch(e){} },0);
    try{const raw=sessionStorage.getItem('mysbizon.return');sessionStorage.removeItem('mysbizon.return');if(raw){const saved=JSON.parse(raw),restore={screen:'report'};for(const k of ['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen']){if(saved[k]===null||typeof saved[k]==='string'||typeof saved[k]==='number')restore[k]=saved[k];}if(Array.isArray(saved.picks))restore.picks=saved.picks.filter(v=>typeof v==='string').slice(0,5);this.setState(restore);}}catch{}

    this._rz=()=>{
      const w=window.innerWidth;
      const b=w<600?'mobile':(w<1024?'tablet':'desktop');
      if(b!==this._bp){ this._bp=b; this.setState({vw:w}); }
    };
    this._bp=null; this._rz();
    window.addEventListener('resize',this._rz);
    // 마운트 시점 폭은 레이아웃 확정 전 값일 수 있다 — 다음 프레임에 한 번 더 잰다
    requestAnimationFrame(()=>{ this._bp=null; this._rz(); });
    if(typeof ResizeObserver!=='undefined'){
      this._ro=new ResizeObserver(()=>this._rz());
      this._ro.observe(document.documentElement);
    }
    // 두 번째 방문부터는 도입부를 건너뛴다
    import('./command-score.js').then(m=>{ this._score=m.commandScore; this.forceUpdate(); }).catch(()=>{});
    // 소개 안내창은 사용자가 요청할 때만 연다. (도입 애니메이션은 아래 seen 여부로 결정한다)
    fetch('/api/config').then(r=>r.json()).then(c=>this.setState({reportEmailEnabled:!!c.reportEmailEnabled})).catch(()=>{});
    let seen=true;
    try{ seen=!!sessionStorage.getItem('mysbizon.seenIntro');
      if(seen) this.setState({skip:true}); else sessionStorage.setItem('mysbizon.seenIntro','1'); }catch(e){}
    // 1,564까지 올라가는 카운트업 — 처음 방문에만
    if(seen){ this.setState({count:1564}); }
    else {
      const t0=performance.now(), dur=1100, delay=500;
      const step=now=>{
        const p=Math.min(Math.max(now-t0-delay,0)/dur,1);
        const e=1-Math.pow(1-p,3);
        this.setState({count:Math.round(e*1564)});
        if(p<1) this._raf=requestAnimationFrame(step);
      };
      this._raf=requestAnimationFrame(step);
    }
    // 버블 단계에서만 닫는다. 캡처로 잡으면 React onClick보다 먼저 돌아 열림을 막는다.
    this._out=e=>{
      const t=e.target;
      if(t.closest && (t.closest('nav') || t.closest('[data-search]'))) return;
      if(this.state.menu||this.state.zFocus) this.setState({menu:null,zFocus:false});
    };
    document.addEventListener('click',this._out,false);
    Promise.all([
      this.loadData('data/v3/zone_industry.json').then(r=>r.json()),
      this.loadData('data/v3/sales_by_industry.json').then(r=>r.json()),
      this.loadData('data/v3/stores_by_industry.json').then(r=>r.json()),
      this.loadData('data/v3/zone_gu.json').then(r=>r.json()).then(d=>d.gu).catch(()=>({})),
      this.loadData('data/v3/zone_border.json').then(r=>r.json()).then(d=>d.border).catch(()=>({})),
      this.loadData('data/v3/seoul_map.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/zone_livepop.json').then(r=>r.json()).then(d=>d.zone).catch(()=>({})),
      this.loadData('zone_rent.json').then(r=>r.json()).then(d=>(d&&d.available!==false&&d.zones)||null).catch(()=>null),
      this.loadData('data/v3/rent.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/sales_history.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/income.json').then(r=>r.json()).catch(()=>null)
    ]).then(([zi,sbi,sti,zgu,zbd,smap,zlp,zoneRent,rent,hist,income])=>this.setState({zi,sbi,sti,zgu,zbd,smap,zoneRent,zlp:Object.fromEntries(Object.entries(zlp||{}).filter(([,v])=>v&&Number.isFinite(v.tot)&&v.tot>0&&Array.isArray(v.age)&&v.age.length===6&&v.age.every(Number.isFinite))),rentStats:rent,salesHistory:hist,income}))
      .catch(()=>this.setState({err:'분석 자료를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'}));
    try{ const r=JSON.parse(localStorage.getItem('mysbizon.recentZones')||'[]');
      if(Array.isArray(r)&&r.length) this.setState({recent:r}); }catch(e){}
  }



  // 평수 하나로 직원 수와 운영비가 같이 움직인다.
  // 기준: 10평당 1명, 평당 6만원 — 우리가 정한 값이고 공표 통계가 아니다.
  // 임대료는 상권별 평당 시세가 공개되지 않아 연동하지 않는다(직접 입력).

  // 만원 단위. 본전 = 고정비 ÷ (1 − 원가율)

  // Lucide 아이콘 (lucide-icons/lucide@main, ISC). 텍스트 글리프(✕, ›) 대신 쓴다.




  // 지역까지 고른 경우 — 짧은 전환 뒤 그 지역 화면으로



  // 순수 SVG 꺾은선 — 차트 라이브러리를 쓰지 않는다

  // 시세분석 — 임대료·공실률·업종 매출·소비 구성. 전부 공개 통계.

  // 자치구 표기 — 경계에 걸친 상권은 두 구를 함께

  // 정밀분석 상세 근거 다섯 절 — 카드 하나씩 그린다

  // 실좌표 SVG 지도 — 지도분석과 비교분석이 같은 그림을 쓴다

  // 정밀비교 — 한 자치구 안의 동네를 전부 표로 펼친다

  // 지역비교 — 자치구 25개를 고른 장사 기준으로 묶어 비교한다

  // 고른 지역 하나 — 그 자리에 기록이 있는 업종만 보여주고 여기서 업종을 고른다

  // 괄호가 중복 설명이면 떼고 보여준다. 검색은 원래 이름으로 계속 걸린다.

  // 통계 코드명을 사람이 쓰는 말로. 조회는 원래 이름(raw)으로 한다.

  // 받침에 따라 조사를 고른다. 이/가 · 은/는 · 라면/이라면

  // AI 도우미 — 이 서비스가 계산한 값만 근거로 답한다. 모델 호출 없음, 없는 값은 없다고 답한다.


  // 화면에 나가기 직전에 한 번 번역한다(logic/i18n.js trDeep).
  // 한국어일 때는 아무 일도 하지 않는다 — 비용 0.
  renderVals(){
    return this.trDeep(this.buildVals());
  }

  buildVals(){
    const S=this.state, r=this.rank();
    // 화면을 옮길 때 이전 화면을 기록한다(뒤로가기용)
    const go=s=>()=>this.setState({screen:s,menu:null});
    // 헤더를 누르면 드롭다운이 열리고, 항목을 누르면 바로 그 화면으로 들어간다
    // 메뉴마다 답하는 질문이 하나씩이고, 서로 겹치지 않는다.
    //   상권분석 "어디가 좋지?"        — 여러 곳을 탐색·비교
    //   정밀분석 "왜 좋은 거지?"       — 고른 상권 하나를 깊게
    //   정밀비교 "담아 둔 곳 중 어디가 나은가?" — 공개 데이터로 종합순위
    //   통합시세 "장사 환경은 어떤가?"  — 임대료·환율·원자재 같은 바깥 사정
    //   리포트   "어떤 지원을 받지?"    — 조건에 맞는 정부 창업지원사업
    // 문구는 사전(logic/i18n.js · locales/*.json)에서 가져온다 — 여기 한국어를 박지 않는다
    const T=k=>this.t(k);
    const MENU=[
      // region(동네 개요)·fineCmp(자치구 훑기)는 둘 다 '여러 곳을 훑는' 화면이라 여기 둔다.
      // 비교(담은 상권 종합순위)는 ② 정밀분석의 '정밀비교'로 옮겼다 — 입구를 둘로 두지 않는다.
      {label:T('nav.zone'), keys:['hubZone','zone','find','region','fineCmp'], hub:'hubZone',
       items:[['zone',T('menu.zoneCompare')],['find',T('menu.find')],
              ['fineCmp',T('menu.sweep')]]},
      // 고른 상권 하나를 깊게 보는 것들이 다 여기 있다.
      //   지도     어디인지
      //   정밀분석 왜 좋은지/나쁜지
      //   정밀비교 담아 둔 상권들의 종합순위
      //   본전 계산 이 자리 한 곳의 본전선
      {label:T('nav.fine'), keys:['hubFine','fineIntro','map','fineDetail','sim','diag'], hub:'hubFine',
       items:[['map',T('menu.map')],['fineDetail',T('menu.detail')],
              ['sim',T('menu.sim')],['diag',T('menu.bep')]]},
      {label:T('nav.market'), keys:['price'], hub:'price', items:[['price',T('nav.market')]]},
      {label:T('nav.report'), keys:['report'], hub:'report', items:[['report',T('nav.report')]]},

    ];

    const tg=k=>()=>this.setState({open:{...S.open,[k]:!S.open[k]}});
    const caret=on=>'flex:none;font-size:15px;color:var(--ink3);transition:transform .16s;display:inline-block;transform:rotate('+(on?'180deg':'0deg')+')';
    const arrowUp='flex:none;font-size:15px;font-weight:600;color:var(--good);width:14px';
    const arrowDn='flex:none;font-size:15px;font-weight:600;color:var(--warn);width:14px';
    const chipBase='font-size:14.5px;padding:10px 17px;border-radius:999px;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;white-space:nowrap;transition:background .16s,color .16s;';
    const POP=['한식음식점','커피-음료','치킨전문점','미용실','편의점','호프-간이주점','분식전문점','일반의원','제과점','일반교습학원'];
    const q=S.q.trim();
    // 고른 업종은 항상 첫 칩으로 둔다 — 목록에 없으면 선택 상태를 보여줄 수 없다
    // 칩 순서는 고정한다 — 고른 업종을 앞으로 끌어오면 글자가 움직여 어디를 눌렀는지 알 수 없다.
    // 보이는 5개 밖의 업종을 고르면 '···' 버튼이 선택 상태로 표시된다.
    const names = S.zi
      ? (q ? S.zi.inds.filter(n=>n.indexOf(q)>=0||this.indName(n).indexOf(q)>=0)
           : [...POP.filter(n=>S.zi.inds.indexOf(n)>=0), ...S.zi.inds.filter(n=>POP.indexOf(n)<0)])
      : [];

    const out={
      nav:MENU.map(g=>({
        label:g.label, isOpen:false,
        open:()=> g.hub==='__bot'
          ? this.setState({bot:true,menu:null})
          : this.setState({screen:g.hub,menu:null}),
        style:'font-size:14px;white-space:nowrap;cursor:pointer;padding:8px 10px;border-radius:9px;display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;transition:background .16s,color .16s;'
          +(g.keys.indexOf(S.screen)>=0?'color:var(--ink);font-weight:600;background:var(--surface)':'color:var(--ink2)'),
        items:g.items.map(([k,label,tag])=>({
          label:label+(tag?'  '+tag:''),
          go:()=>this.setState({screen:k,menu:null}),
          style:'padding:11px 13px;border-radius:9px;cursor:pointer;font-size:14.5px;white-space:nowrap;transition:background .12s;'
            +(S.screen===k?'background:var(--surface);font-weight:600':'color:var(--ink)')}))
      })),
      // 홈으로 돌아올 때마다 도입 애니메이션을 다시 튼다(가운데에서 떠서 위로 올라감).
      // 화면 아무 곳이나 누르면 skipAnim 이 건너뛴다.
      goHome:()=>this.setState({screen:'home',menu:null,skip:false}),
      onHome:S.screen==='home',
      // 소개는 별도 화면이 아니라 홈 위에 뜨는 안내창
      noticeOn:!!S.notice,
      noticeCard:'width:100%;max-width:'+this.L('100%','420px','440px')+';background:var(--bg);border-radius:22px;'
        +'padding:'+this.L('22px','26px','28px')+';box-shadow:0 24px 60px rgba(0,0,0,.22);'
        +'max-height:calc(100dvh - 40px);overflow-y:auto;overscroll-behavior:contain',
      aboutStats:[
        {value:'1,564곳', label:'서울 동네'},
        {value:'62가지', label:'장사 종류'},
        {value: S.zi? this.qtr(S.zi.quarter).replace('년 ','.').replace('분기','Q') : '—', label:'자료 기준'}
      ],
      // 세 걸음 — 처음 온 분이 무엇부터 하면 되는지
      aboutSteps:[
        {n:'1', title:'업종과 지역을 고른다', body:'첫 화면에서 장사 종류만 고르면 서울 동네가 좋은 순서로 줄 섭니다.'},
        {n:'2', title:'후보를 견준다',       body:'마음에 드는 곳을 담아 두면 매출·손님·경쟁으로 종합 1위를 뽑아 줍니다.'},
        {n:'3', title:'내 숫자로 계산한다',   body:'평수와 임대료를 넣으면 월 얼마를 팔아야 본전인지 나옵니다.'}
      ],
      // 메뉴 넷 — 각각 답하는 질문 하나
      aboutTabs:[
        {tab:'상권분석', body:'어디가 좋지? — 여러 동네를 훑고 줄 세웁니다.'},
        {tab:'정밀분석', body:'여기 왜 괜찮지? — 고른 곳 하나를 매출·수요·경쟁·비용으로 뜯어봅니다.'},
        {tab:'통합시세', body:'장사 환경은 어떤가? — 임대료·공실부터 환율·원자재까지.'},
        {tab:'리포트',   body:'어떤 지원을 받지? — 조건에 해당할 수 있는 정부 창업지원사업을 찾아 줍니다.'},
        {tab:'AI 도우미', body:'오른쪽 아래 버튼. 계산된 값만 근거로 답하고, 없는 값은 없다고 말합니다.'}
      ],
      aboutRows:[
        {title:'장사를 먼저 골라요',
         body:'보통은 동네를 고르고 그 동네가 어떤지 봅니다. 여기는 거꾸로예요. 업종을 말해 주시면 서울 동네를 좋은 순서대로 줄 세워 드립니다.'},
        {title:'점수가 어떻게 나왔는지 보여드려요',
         body:'손님이 얼마나 쓰는지, 같은 가게가 몇 곳인지, 한 곳당 얼마 버는지. 어느 항목 때문에 점수가 높은지 그 자리에서 보실 수 있어요.'},
        {title:'모르는 건 모른다고 써요',
         body:'없는 값을 지어내지 않습니다. 실제로 센 숫자와 나눠서 낸 추정값을 화면에서 구분해 표시합니다.'}
      ],
      // 리포트 — 화면에 없는 값만 묻는다(개업 시기 · 자금 · 인력). 이메일은 동의를 받아야 보낸다.
      rp:(()=>{
        const pick=(k,v)=>()=>this.setState({['rp_'+k]:v,rp_sent:false,rp_error:''});
        const chip=(k,v)=>'flex:none;font-size:13.5px;padding:9px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
          +(S['rp_'+k]===v?'background:var(--ink);color:var(--bg);font-weight:500':'background:var(--surface);color:var(--ink2)');
        const reportSelection=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)||r.list[0]):null;
        const reportZone=reportSelection?this.zoneLabelOf(reportSelection.name):'동네 미선택';
        const email=(S.rp_email||'').trim();
        const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!S.rp_agree;
        const sent=!!S.rp_sent; const sending=!!S.rp_sending; const enabled=!!S.reportEmailEnabled;
        const P=[
          ['one','선택한 동네 분석','고른 동네의 점수 근거와 본전 계산'],
          ['cmp','비교한 자리들','담아 둔 동네를 항목별로 나란히']
        ];
        const partOn=k=>S['rp_p_'+k]!==false;
        const buildReport=()=>{
            const sel=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)||r.list[0]):null;
            const t=sel?{score:sel.score,scoreNum:sel.score,grade:'비교지수',headline:'선택한 상권의 비교 결과',parts:[{label:'수요',value:sel.c1.toFixed(1)+'점',pctText:String(sel._sales)},{label:'경쟁',value:sel.c2.toFixed(1)+'점',pctText:String(sel._stores)},{label:'점포당 매출',value:sel.c3.toFixed(1)+'점',pctText:String(sel._per)}]}:null;
            const c=sel?this.calc(sel):null;
            const parts=(t&&t.parts)?t.parts.map(p=>({
              label:p.label, value:p.value,
              pct:Number(String(p.pctText??'0').replace(/[^0-9.]/g,''))
            })):null;
            const payload={
              ind:S.ind?this.indName(S.ind):'', zone:sel?this.zoneLabelOf(sel.name):'동네 미선택',
              gu:sel?this.guLabel(sel.id):'',
              quarter:S.zi?this.qtr(S.zi.quarter):'',
              score:t?Math.round(t.scoreNum??t.score):null,
              grade:t?t.grade:null,
              lead:t?t.headline:null,
              parts:parts,
              bep:c?[
                {label:'월 본전선 (이만큼 팔면 본전)', value:this.man(c.bep), tag:''},
                {label:'월매출 가정 ('+S.scen+')', value:this.man(c.rev), tag:'평균 추정치 × '+c.mult},
                {label:'월 임대료', value:(S.rent||0).toLocaleString()+'만원', tag:'입력값 또는 기본 가정'},
                {label:'평수', value:(S.area||0)+'평', tag:'입력값 또는 기본 가정'},
                {label:'인건비', value:this.man(c.labor), tag:'평수로 추정'},
                {label:'원가율', value:(S.cogs||0)+'%', tag:'기본 가정 · 수정 가능'}
              ]:null,
              survey:[
                ['지역',[S.rp_sido,S.rp_gu&&S.rp_gu!=='아직 안 정했어요'?S.rp_gu:''].filter(Boolean).join(' ')],
                ['업종',S.rp_ind?this.indName(S.rp_ind):''],
                ['창업 단계',S.rp_stage],['나이',S.rp_age],['사업자등록',S.rp_biz],
                ['개업 시기',S.rp_when],['필요한 지원',S.rp_need]
              ].filter(([,v])=>!!v).map(([label,value])=>({label,value})),
              // 돈이 어디로 나가는지 — 매출 대비 비중
              money:c?(()=>{
                const rev=c.rev||1;
                const rows=[
                  {label:'임대료', v:S.rent||0},
                  {label:'인건비', v:c.labor||0},
                  {label:'재료비', v:rev*(S.cogs||0)/100},
                  {label:'그 밖의 운영비', v:c.etc||0}
                ];
                const mx=Math.max(...rows.map(o=>o.v),1);
                return rows.filter(o=>o.v>0).map(o=>({
                  label:o.label, value:this.man(o.v),
                  pct:Math.round(o.v/mx*100),
                  warn:o.v/rev>0.3
                }));
              })():null,
              // 비교에 담은 자리
              zones:(S.picks|| (r?r.list.slice(0,3).map(o=>o.id):[])).map(id=>r&&r.list?r.list.find(o=>o.id===id):null)
                .filter(Boolean).map(o=>({
                  name:this.zoneLabelOf(o.name), score:Math.round(o.score),
                  stores:o.stores.toLocaleString()+'곳'
                }))
            };
            if(!payload.money||!payload.money.length) delete payload.money;
            if(!payload.zones.length) delete payload.zones;
            if(!payload.survey.length) delete payload.survey;

            if(!partOn('one')){delete payload.parts;delete payload.bep;delete payload.money;delete payload.score;delete payload.grade;delete payload.lead;}
            if(!partOn('cmp'))delete payload.zones;
            return payload;
        };
        return {
          // 담을 항목 체크박스를 없앴으니 '고른 게 0개'인 상태도 없다 — 자리만 있으면 내보낼 수 있다
          exportDisabled:!reportSelection,
          title:'분석한 내용을 정리해 드립니다',
          sub:'지금 보고 있는 동네와 장사, 본전 계산까지 한 장으로 묶습니다. 화면에 없는 것만 물어봅니다.',
          // '담을 항목 N개'는 지운 체크박스를 가리키던 말이라 뺐다
          target:(S.ind?this.indName(S.ind):'장사 미선택')+' · '+reportZone,
          // ── 리포트에 담을 내용을 한 번에 하나씩 묻는다 ──────────────────
          // 설문이 아니라 '리포트 만들기'다. 답한 것이 그대로 리포트에 들어간다.
          // 지역 → 구 → 동네 → 비교 대상 → 창업 조건 순으로, 큰 것부터 좁혀 간다.
          ...(()=>{
            const zi=S.zi, zgu=S.zgu||{};
            const sido=S.sido||'서울특별시';
            const seoul=sido==='서울특별시';
            const gu=S.rp_gu||'';
            const idx=zi?zi.inds.indexOf(S.ind):-1;
            const PICKS=S.picks||[];

            const zlp=S.zlp||{};
            const q0=(S.rp_q||'').trim().replace(/\s/g,'');

            // 서울 전체에서 이 장사 데이터가 있는 상권 (매출 높은 순).
            // 자치구와 행정동을 함께 들고 있어야 '주소처럼' 찾을 수 있다.
            const allZones=(()=>{
              if(!zi||idx<0) return [];
              const out=[];
              for(const k in zi.zones){
                const row=(zi.zones[k].rows||[]).find(r=>r[0]===idx);
                if(!row||!row[1]||!row[2]) continue;
                out.push({id:k, gu:zgu[k]||'', dong:(zlp[k]&&zlp[k].dong)||'',
                  name:this.zoneLabelOf(zi.zones[k].nm), stores:row[1], per:row[2]/row[1]});
              }
              out.sort((a,b)=>b.per-a.per);
              return out;
            })();
            // 고른 구 안에서만. 순위는 구 안에서 매긴다.
            const zonesOfGu=allZones.filter(z=>gu&&z.gu===gu);
            zonesOfGu.forEach((z,i)=>{ z.rank=i+1; });
            const nameOf=id=>(zi&&zi.zones[id])?this.zoneLabelOf(zi.zones[id].nm):id;
            const guOf=id=>zgu[id]||'';
            // 동네 이름만 있으면 뭘 골라야 할지 알 수 없다 — 순위와 가게당 매출을 같이 적는다.
            // per 는 3개월 합계라 /3 해서 월로 적는다(다른 화면과 같은 기준). 가게가 2곳 이하면
            // '가게당'이 사실상 한 가게 실적이라 그 사실을 숨기지 않고 함께 적는다.
            const zoneSub=z=>z.rank+'위 · 가게당 월 '+this.won(z.per/3)
              +(z.stores<=2?' · 가게 '+z.stores+'곳뿐':'');
            // 쳐서 찾을 때는 순위 대신 '어디인지'를 먼저 알려준다 — 다른 구가 나올 수 있어서다
            // ── 리포트 설문 ─────────────────────────────────────────────
            // 지역은 시·도 → 구 두 걸음으로 묻는다. 지자체 공고가 지역별로 따로 있어서다.
            const RP_SIDO=['서울','부산','대구','인천','광주','대전','울산','세종',
                           '경기','강원','충북','충남','전북','전남','경북','경남','제주'];
            const RP_GU_SEOUL=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
                               '강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구',
                               '구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
            const RP_GU_NONE='아직 안 정했어요';
            // 이 설문의 목적은 본전 계산이 아니라 '신청할 수 있는 정부 창업지원사업'을
            // 찾아 주는 것이다. 그래서 매칭에 쓰지 않는 질문(자금·대출·버틸 기간)은 뺐다.
            // 남은 것은 전부 공고 자격 요건에 실제로 등장하는 조건이다.
            const STEPS=[
              // ① 시·도 — 지자체 공고는 지역별로 따로 있다. 자료가 서울뿐이어도 지역은 다 묻는다.
              {k:'sido', q:'어느 지역에서 창업하세요?',
               hint:'지자체마다 따로 있는 공고를 함께 찾아 드려요.',
               opts:RP_SIDO.map(v=>({v,label:v})), grid:true,
               val:S.rp_sido, set:v=>({rp_sido:v, rp_gu:''})},

              // ② 구 — 서울만 구 목록을 갖고 있다. 다른 시·도는 이 단계를 건너뛴다.
              {k:'gu', q:'서울 어느 구인가요?',
               hint:'아직 안 정하셨으면 건너뛰어도 돼요.',
               opts:[{v:RP_GU_NONE,label:RP_GU_NONE}, ...RP_GU_SEOUL.map(v=>({v,label:v}))], grid:true,
               val:S.rp_gu, set:v=>({rp_gu:v}),
               only: S.rp_sido==='서울'},

              // ③ 업종 — 공고마다 지원 업종이 정해져 있다. 많이 찾는 것부터, 나머지는 검색.
              {k:'ind', q:'어떤 업종으로 시작하세요?',
               hint:'공고마다 지원 업종이 정해져 있어요.',
               opts:(zi?zi.inds:[]).map(v=>({v,label:this.indName(v)})),
               defaultOpts:(zi?['커피-음료','한식음식점','치킨전문점','호프-간이주점','분식전문점','제과점','미용실','편의점']
                          .filter(n=>zi.inds.indexOf(n)>=0):[]).map(v=>({v,label:this.indName(v)})),
               search:'업종 이름 (예: 카페)', grid:true,
               val:S.rp_ind,
               set:v=>({ind:v, rp_ind:v})},

              // ③ 창업 단계 — '예비창업자' 전용 공고가 가장 많다
              {k:'stage', q:'지금 어느 단계에 계세요?',
               hint:'예비창업자만 신청할 수 있는 공고가 따로 있어요.',
               opts:['아직 준비 중이에요 (예비창업자)','문 연 지 1년 안 됐어요','1~3년 됐어요','3년 넘었어요'].map(v=>({v,label:v})),
               val:S.rp_stage, set:v=>({rp_stage:v})},

              // ④ 나이 — 청년 창업 지원의 기준선
              {k:'age', q:'나이가 어떻게 되세요?',
               hint:'청년 창업 지원은 보통 만 39세 이하가 대상이에요.',
               opts:['만 39세 이하','만 40세 이상'].map(v=>({v,label:v})),
               val:S.rp_age, set:v=>({rp_age:v})},

              // ⑤ 사업자등록 여부
              {k:'biz', q:'사업자등록을 하셨나요?',
               hint:'등록 전이면 예비창업 공고, 등록 후면 소상공인 공고 쪽이에요.',
               opts:['아직 안 했어요','했어요'].map(v=>({v,label:v})),
               val:S.rp_biz, set:v=>({rp_biz:v})},

              // ⑥ 창업 시기 — 마감이 그 안에 있는 공고를 앞으로 끌어온다
              {k:'when', q:'언제 문을 열 계획이세요?',
               hint:'그 안에 마감인 공고를 먼저 보여드려요.',
               opts:['3개월 안','6개월 안','1년 안','아직 미정'].map(v=>({v,label:v})),
               val:S.rp_when, set:v=>({rp_when:v})},

              // ⑦ 필요한 지원 — 공고의 '지원 분야'와 바로 이어진다
              {k:'need', q:'어떤 지원이 가장 필요하세요?',
               hint:'고른 분야의 공고를 위로 올려 드려요.',
               opts:['사업화 자금','시설·임차 비용','교육·멘토링','융자·대출'].map(v=>({v,label:v})),
               val:S.rp_need, set:v=>({rp_need:v})},

              // 이메일 — 리포트를 보낼 곳. 건너뛸 수 없다.
              {k:'email', q:'결과를 어디로 보내 드릴까요?',
               hint:'찾은 지원사업과 상권 분석을 한 장으로 묶어 보내 드려요.',
               input:'email', opts:[], val:S.rp_email||''}
            ].filter(s=>s.only!==false);

            const N=STEPS.length;
            const firstOpen=STEPS.findIndex(s=>s.multi?false:!s.val);
            const step=Math.max(0,Math.min(
              S.rp_step!=null?S.rp_step:(firstOpen<0?N:firstOpen), N));
            const cur=step<N?STEPS[step]:null;
            const q=(S.rp_q||'').trim();
            // 지금 화면에 그릴 후보. 상권 단계는 이미 걸러서 왔고(preFiltered),
            // 구 단계는 치기 전까지 한 줄도 안 띄운다(blank).
            const visible = !cur ? []
              : cur.preFiltered ? cur.opts
              : cur.search ? (q
                  ? cur.opts.filter(o=>o.label.replace(/\s/g,'').indexOf(q.replace(/\s/g,''))>=0).slice(0,8)
                  : (cur.defaultOpts || (cur.blank? [] : cur.opts.slice(0,6))))
              : cur.opts;

            const optStyle=on=>'display:flex;align-items:center;justify-content:space-between;gap:12px;'
              +'width:100%;padding:17px 18px;border-radius:14px;cursor:pointer;'
              +'font-size:15.5px;line-height:1.4;text-align:left;'
              +'transition:background .14s,color .14s;'
              +(on?'background:var(--accent-3);color:var(--accent);font-weight:600'
                 :'background:var(--surface);color:var(--ink)');
            // 지역·업종처럼 항목이 많은 단계는 격자로 깐다 — 세로로 세우면 버튼 벽이 된다(§29)
            const optStyleGrid=on=>'display:flex;align-items:center;justify-content:center;'
              +'padding:13px 10px;border-radius:12px;cursor:pointer;min-width:0;'
              +'font-size:14.5px;line-height:1.3;text-align:center;white-space:nowrap;'
              +'overflow:hidden;text-overflow:ellipsis;transition:background .14s,color .14s;'
              +(on?'background:var(--accent-3);color:var(--accent);font-weight:700'
                 :'background:var(--surface);color:var(--ink)');

            // 요약에 적을 말. 상권 단계는 코드(3001496)가 아니라 동네 이름으로 적는다.
            const shown=(v,isZone)=>Array.isArray(v)
              ? (v.length? v.map(nameOf).join(' · ') : '없음')
              : (v? (isZone? nameOf(v) : v) : '건너뜀');

            return {
              qsStep: cur? (step+1)+' / '+N : '',
              hasStep: !!cur,
              qsBar:'display:block;height:100%;border-radius:2px;background:var(--accent);'
                +'transition:width .3s cubic-bezier(.22,.7,.25,1);width:'+Math.round(step/N*100)+'%',

              hasCur: !!cur,
              curQ: cur?cur.q:'',
              curHint: cur?cur.hint:'',
              // 구 25개·동네 99개를 버튼으로 늘어놓으면 화면이 버튼 벽이 된다.
              // 치는 대로 걸러 6개만 보여준다. '강'만 쳐도 강남구·강동구가 뜬다.
              // 후보가 0개면 목록 칸 자체를 안 그린다 — 안 그러면 빈 여백만 22px 뜬다
              hasOpts: visible.length>0 && !(cur&&cur.grid),
              // 격자로 그릴지, 한 줄씩 그릴지
              hasGridOpts: visible.length>0 && !!(cur&&cur.grid),
              optsGridStyle:'display:grid;gap:8px;margin-top:22px;'
                +'grid-template-columns:repeat('+this.L(3,4,4)+',minmax(0,1fr))',
              // 주소 → 상권 매칭 확인. '강남역 상권으로 확인했어요' 처럼 말해 준다.
              isSearch: !!(cur&&cur.search),
              searchHint: cur&&cur.search?cur.search:'',
              searchQ: S.rp_q||'',
              onSearchQ: e=>this.setState({rp_q:e.target.value}),
              // Enter 로 첫 결과를 고른다 — 검색창에서 손을 떼지 않아도 되게
              onSearchKey: e=>{
                if(e.key!=='Enter') return;
                const first=visible[0];
                if(!first||!cur||!cur.set) return;
                this.setState(cur.stay
                  ? {...cur.set(first.v), rp_step:step}
                  : {...cur.set(first.v), rp_step:step+1, rp_q:''});
              },
              searchEmpty: !!(cur&&cur.search&&q&&visible.length===0),
              searchEmptyText: q? '‘'+q+'’와 맞는 게 없어요' : '',
              curOpts: visible.map(o=>{
                const on=cur.multi? (PICKS.indexOf(o.v)>=0) : (cur.val===o.v);
                return {
                  label:o.label, on:on, style:(cur.grid?optStyleGrid:optStyle)(on),
                  sub:o.sub||'', hasSub:!!o.sub,
                  pick: cur.multi
                    ? ()=>{ const has=PICKS.indexOf(o.v)>=0;
                        const next=has?PICKS.filter(x=>x!==o.v):(PICKS.length>=5?PICKS:[...PICKS,o.v]);
                        this.setState({picks:next, rp_sent:false}); }
                    : ()=>this.setState(cur.stay
                        ? {...cur.set(o.v), rp_step:step, rp_sent:false, rp_error:''}
                        : {...cur.set(o.v), rp_step:step+1, rp_q:'', rp_sent:false, rp_error:''})
                };
              }),
              // 여러 개 고르는 단계에서만 '다음'이 필요하다 — 하나 고르는 단계는 누르면 바로 넘어간다
              isMulti: !!(cur&&cur.multi),
              multiNext: ()=>this.setState({rp_step:step+1, rp_q:''}),
              multiLabel: PICKS.length? PICKS.length+'곳 담음 · 다음' : '안 고르고 다음',

              // 이메일 단계 — 입력칸과 동의 체크가 이 카드 안에서 끝난다.
              // 여기는 건너뛸 수 없다. 주소가 있어야 리포트를 보내 드릴 수 있어서다.
              // 버튼은 늘 눌린다. 비었으면 막는 대신 입력칸이 흔들리고 빨간 글자로 이유를 말한다
              // — 눌리지 않는 회색 버튼은 '고장난 건가?' 하고 멈추게 만든다.
              isEmail: !!(cur&&cur.input==='email'),
              emailNext: ()=>this.setState(ok
                ? {rp_step:step+1, rp_q:'', rp_shake:0}
                : {rp_shake:(S.rp_shake||0)+1}),
              emailNextLabel:'리포트 받기',
              emailNextStyle:'width:100%;margin-top:16px;font-size:15.5px;font-weight:600;border:none;'
                +'border-radius:14px;height:50px;cursor:pointer;transition:filter .16s;'
                +'background:var(--accent);color:#FFFFFF',
              // 한 번이라도 그냥 누른 뒤에만 빨간 글자가 뜬다 — 처음부터 혼내지 않는다
              hasEmailErr: !!S.rp_shake && !ok,
              emailErr: !email ? '메일 주소를 입력해 주세요'
                : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '메일 주소 형식이 맞지 않아요 (예: name@example.com)'
                : '아래 동의에 체크해 주세요',
              emailInputStyle:'width:100%;margin-top:20px;font-size:16px;font-weight:500;color:var(--ink);'
                +'background:var(--surface);border:none;border-radius:14px;padding:0 16px;height:52px;outline:none;'
                +((S.rp_shake && !ok)
                  ? 'box-shadow:inset 0 0 0 1.5px var(--err);animation:'
                    +(S.rp_shake%2?'shakeA':'shakeB')+' .4s cubic-bezier(.36,.07,.19,.97)'
                  : ''),

              // 건너뛰기는 없앴다. 답이 비면 리포트의 그 칸이 빈 채로 나가서,
              // 사장님이 '왜 이건 안 나왔지'를 나중에 다시 물어야 했다.
              // 되돌아가는 길(←)은 남겨 둔다.
              curBack: step>0?()=>this.setState({rp_step:step-1, rp_q:''}):()=>{},
              hasBack: step>0,
              qsAllDone: !cur,
              // 다 답한 뒤엔 카드가 사라진다. 답을 다시 볼 수 있게 한 줄만 남긴다.
              doneLine: STEPS.map(st=>{
                  const v=shown(st.val, st.isZone);
                  return st.k==='ind'? (st.val? this.indName(st.val) : '') : v;
                }).filter(v=>v&&v!=='건너뜀'&&v!=='없음').join(' · '),
              editAgain: ()=>this.setState({rp_step:0, rp_q:''}),
              // 리포트가 몇 칸까지 열렸는지 — rv 가 이 값으로 한 칸씩 연다
              qsN:N, qsStepNum:step
            };
          })(),
          email:email,
          onEmail:e=>{this._reportKey=null;this.setState({rp_email:e.target.value,rp_sent:false,rp_error:''});},
          agreed:!!S.rp_agree,
          toggleAgree:()=>this.setState({rp_agree:!S.rp_agree}),
          agreeText:'리포트 발송을 위해 이메일과 선택한 분석 내용을 메일 처리업체에 전달하는 데 동의합니다. 자세한 처리 내용은 개인정보 안내를 확인해 주세요.',
          checkStyle:'flex:none;width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;transition:background .14s;'
            +(S.rp_agree?'background:var(--accent)':'background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--line-strong)'),
          sendDisabled:!enabled||!ok||sent||sending,
          sendLabel:sending?'발송 중…':sent?'발송 요청 완료':!enabled?'메일 발송 준비 중':(ok?'메일로 받기':'이메일과 동의가 필요해요'),
          sendStyle:'width:100%;font-size:15.5px;font-weight:600;border:none;border-radius:14px;height:50px;'
            +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
            +((ok&&!sent)?'cursor:pointer;background:var(--accent);color:#FFFFFF'
              :(sent?'cursor:default;background:var(--good);color:#FFFFFF'
                :'cursor:pointer;background:var(--accent-3);color:var(--accent)')),
          // ── 정부·지자체 지원사업 ────────────────────────────────────────
          // 위 '내 창업 조건'의 답으로 해당할 수 있는 공고를 앞으로 끌어온다.
          // 거르지 않고 순서만 바꾼다 — 우리 분류와 공고의 표현이 달라서
          // 못 맞춘 것을 버리면 진짜 필요한 제도가 사라진다.
          // 자격은 판정하지 않는다(CLAUDE.md §17: 법률 판단은 확정적으로 말하지 않는다).
          sp:(()=>{
            const d=S.sp;
            // ── 조건 → 공고 매칭 ────────────────────────────────────────
            // 자격을 '판정'하지 않는다(§17). 답한 조건과 겹치는 말이 공고에 있으면
            // 위로 올리고, 왜 올렸는지를 그대로 보여 준다. 최종 확인은 원문에서.
            const RULES=[];
            if(S.rp_stage==='아직 준비 중이에요 (예비창업자)')
              RULES.push({why:'예비창업자 조건', kw:['예비','창업 준비','신규','초기','스타트']});
            else if(S.rp_stage) RULES.push({why:'기존 사업자 대상', kw:['소상공인','기존','재도전','성장','스케일']});
            if(S.rp_age==='만 39세 이하') RULES.push({why:'청년 연령 조건', kw:['청년','39세','만 39','2030']});
            if(S.rp_biz==='아직 안 했어요') RULES.push({why:'사업자등록 전', kw:['예비','미등록','창업 전']});
            if(S.rp_biz==='했어요') RULES.push({why:'사업자등록 완료', kw:['소상공인','사업자','업력']});
            if(S.rp_need==='사업화 자금') RULES.push({why:'사업화 자금 지원', kw:['사업화','자금','바우처','보조']});
            if(S.rp_need==='시설·임차 비용') RULES.push({why:'시설·임차 지원', kw:['시설','임차','임대','공간','인테리어']});
            if(S.rp_need==='교육·멘토링') RULES.push({why:'교육·멘토링', kw:['교육','멘토','컨설팅','아카데미','사관학교']});
            if(S.rp_need==='융자·대출') RULES.push({why:'융자·정책자금', kw:['융자','대출','정책자금','보증']});
            if(S.ind) RULES.push({why:'업종 조건', kw:[this.indName(S.ind), S.ind]});
            const sidoNow=S.rp_sido||'';
            const guNow=(S.rp_gu && S.rp_gu!=='아직 안 정했어요')? S.rp_gu : '';
            if(sidoNow||guNow) RULES.push({why:'지역 조건', kw:[guNow, sidoNow].filter(Boolean)});

            const reasonsOf=it=>{
              const t=((it.title||'')+' '+(it.target||'')+' '+(it.kind||'')+' '+(it.content||'')+' '+(it.region||'')).toLowerCase();
              return RULES.filter(r=>r.kw.some(k=>k&&t.indexOf(String(k).toLowerCase())>=0)).map(r=>r.why);
            };
            const all=(d&&Array.isArray(d.items))?d.items:[];
            const scored=all.map(it=>({it, why:reasonsOf(it)}));
            const matched=scored.filter(o=>o.why.length>0).sort((a,b)=>b.why.length-a.why.length);
            const rest=scored.filter(o=>o.why.length===0);

            const today=new Date(); today.setHours(0,0,0,0);
            const ddOf=it=>it.deadline?Math.round((new Date(it.deadline+'T00:00:00')-today)/86400000):null;
            // 창업 시기를 고르면 그 안에 마감인 공고를 먼저 본다
            const horizon={'3개월 안':90,'6개월 안':180,'1년 안':365}[S.rp_when]||null;

            const card=(o)=>{
              const it=o.it, dd=ddOf(it);
              const soon=dd!=null&&dd<=14;
              return {
                title:it.title,
                org:it.org||'',
                hasOrg:!!it.org,
                amount:it.amount||'',
                hasAmount:!!it.amount,
                content:(it.content||'').slice(0,140),
                hasContent:!!it.content,
                target:it.target||'',
                hasTarget:!!it.target,
                dday: dd==null? '상시 모집' : (dd===0? '오늘 마감' : 'D-'+dd),
                ddayStyle:'flex:none;font-size:13px;font-weight:700;white-space:nowrap;'
                  +'padding:5px 11px;border-radius:999px;font-variant-numeric:tabular-nums;'
                  +(dd==null?'background:var(--surface);color:var(--ink2)'
                    :(soon?'background:var(--err);color:#FFFFFF':'background:var(--accent-3);color:var(--accent)')),
                period:[it.start,it.deadline].filter(Boolean).join(' ~ ')||'',
                hasPeriod:!!(it.start||it.deadline),
                why:o.why.map(w=>({text:w})),
                hasWhy:o.why.length>0,
                url:it.url||'', hasUrl:!!it.url,
                // 가로 슬라이드 안에서 카드 높이가 제각각이면 줄이 들쭉날쭉해 보인다
                style:'display:flex;flex-direction:column;gap:0;padding:22px;border-radius:var(--r-lg);height:100%;'
                  +'background:var(--bg);border:1px solid '+(soon?'var(--accent-2)':'var(--line)')
                  +';min-width:0'
              };
            };
            const top=matched.filter(o=>{ const dd=ddOf(o.it); return horizon==null||dd==null||dd<=horizon; });
            const list=(top.length?top:matched).slice(0,12).map(card);
            const nearest=(top.length?top:matched).map(o=>ddOf(o.it)).filter(v=>v!=null).sort((a,b)=>a-b)[0];

            return {
              loading:!d,
              notConfigured:!!d&&d.configured===false,
              failed:!!d&&d.configured!==false&&!d.ok,
              ready:!!d&&!!d.ok,
              // 사용자용 문구만. 환경변수 이름 같은 개발자 메시지는 내보내지 않는다.
              message: (!!d&&d.configured===false)
                ? '지원사업 정보를 준비 중이에요. 준비되면 이 자리에 신청 가능한 공고가 나타납니다.'
                : '지원사업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
              retry:()=>{this._spLoading=false;this.setState({sp:null});},
              count:list.length,
              countLabel:list.length+'개',
              nearest: nearest==null? '—' : (nearest===0?'오늘':'D-'+nearest),
              hasNearest: nearest!=null,
              items:list,
              hasItems:list.length>0,
              // 공고는 세로로 쌓으면 화면이 한없이 길어진다 — 옆으로 넘겨 본다
              rail:this.rail('sp',{per:3}),
              empty:!!d&&!!d.ok&&all.length===0,
              noMatch:!!d&&!!d.ok&&all.length>0&&list.length===0,
              restCount:rest.length,
              hasRest:rest.length>0,
              rest:rest.slice(0,20).map(card),
              restLabel:'조건에 걸리지 않은 공고 '+rest.length+'개도 보기',
              showRest:!!S.spRest,
              toggleRest:()=>this.setState({spRest:!S.spRest}),
              warn:'자격을 판정한 목록이 아니에요. 실제 신청 자격은 업력·매출·지역·업종·소상공인 여부에 따라 달라요. '
                +'여기 있는 건 답하신 조건과 겹치는 공고이고, 신청 가능 여부는 반드시 원문에서 확인해 주세요.'
                +((d&&d.undated)?' 마감일을 읽지 못한 공고 '+d.undated+'개가 섞여 있어요(상시 모집일 수 있어요).':'')
                +((d&&d.expired)?' 마감이 지난 '+d.expired+'개는 뺐어요.':'')
            };
          })(),

          // 엑셀에서 바로 열리는 CSV. 서버 없이 지금 화면의 값만 담는다.
          csv:()=>{
            
            const p=buildReport();
            const rows=[['항목','값','비고'],['기준 분기',S.zi?this.qtr(S.zi.quarter):'','원자료 기준'],['장사',p.ind,''],['동네',p.zone,''],...(p.bep||[]).map(x=>[x.label,x.value,x.tag]),...(p.zones||[]).map(x=>[x.name,x.score+'점','비교 후보']),...(p.survey||[]).map(x=>[x.label,x.value,'입력'])];
            const q=v=>{let t=String(v==null?'':v);if(/^[\s]*[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
            const body=rows.map(r=>r.map(q).join(',')).join('\r\n');
            // 엑셀이 한글을 깨지 않게 BOM을 붙인다
            const blob=new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'});
            const a=document.createElement('a');
            a.href=URL.createObjectURL(blob);
            a.download='MYSBIZON_'+(S.homeZoneName||'서울전체')+'_'+(S.ind?this.indName(S.ind):'')+'.csv';
            document.body.appendChild(a); a.click();
            setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
          },
          // 인쇄용 한 장으로 넘긴다. 값은 지금 화면에서 계산된 것만 담는다.
          // ── 화면 안에서 바로 보는 리포트 ───────────────────────────────
          // 예전에는 리포트를 보려면 다른 페이지(report-print.html)로 나가야 했다.
          // 조건을 바꿀 때마다 나갔다 들어와야 하니 아무도 안 봤다.
          // 결론(본전선) 하나를 크게 먼저 보여주고, 근거를 아래로 쌓는다.
          rv:(()=>{
            const sel=reportSelection;
            if(!sel) return {has:false, empty:true};
            const c=this.calc(sel);
            const over=c.rev>=c.bep;                     // 예상 매출이 본전선을 넘나
            const gap=Math.abs(c.rev-c.bep);
            const mx=Math.max(c.rev,c.bep,1);
            // 종이가 한 장씩 채워지는 느낌 — 질문에 답할수록 아래 칸이 하나씩 열린다.
            // 답을 건너뛰어도 단계는 넘어가므로 결국 다 열린다(막히지 않는다).
            // 종이가 한 칸씩 채워진다. 단계 번호가 아니라 '무엇을 답했는가'로 연다 —
            // 단계 수가 지역 선택 때문에 달라져도 흔들리지 않는다.
            const gotZone=!!(S.sel||S.zoneId);
            const opened=[gotZone, !!S.rp_stage, !!S.rp_need];
            const nOpen=opened.filter(Boolean).length;
            // 방금 열린 칸만 흘러내리게 한다
            const grow=i=>opened[i]&&nOpen===i+1
              ? 'animation:lateIn .45s cubic-bezier(.22,.7,.25,1) both;' : '';
            return {
              has:true, empty:false,
              // 아직 아무것도 안 물었으면 리포트 자체를 감춘다 — 빈 종이부터 보여준다
              started:opened[0],
              showBep:opened[0],   bepStyle:grow(0),
              showBars:opened[1],  barsStyle:'margin-top:28px;'+grow(1),
              showCosts:opened[2], costsStyle:'margin-top:30px;'+grow(2),
              eyebrow:this.indName(S.ind)+' · '+this.zoneLabelOf(sel.name)
                +(S.zi?' · '+this.qtr(S.zi.quarter):''),
              // 결론 한 줄 — 큰 숫자는 '한 달에 얼마를 팔아야 하는가'다
              bep:this.man(c.bep),
              bepNote:'한 달에 이만큼 팔면 본전이에요',
              // 판정 — 넘는지 모자라는지. 색으로 바로 읽히게.
              verdict:over
                ? this.t('diag.over',{amt:this.man(gap)})
                : '예상 매출이 본전선에 '+this.man(gap)+' 모자라요',
              verdictStyle:'display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:600;'
                +'padding:8px 14px;border-radius:999px;margin-top:16px;white-space:nowrap;'
                +(over?'background:var(--strong-soft,var(--accent-3));color:var(--good)'
                      :'background:var(--surface);color:var(--warn)'),
              // 두 막대를 같은 자로 재서 나란히 — 길이 비교가 곧 판정이다
              bars:[
                {label:'월 본전선', value:this.man(c.bep),
                 bar:'display:block;height:100%;border-radius:5px;background:var(--ink3);width:'
                   +(c.bep/mx*100).toFixed(1)+'%'},
                {label:'월매출 가정 ('+S.scen+')', value:this.man(c.rev),
                 bar:'display:block;height:100%;border-radius:5px;width:'+(c.rev/mx*100).toFixed(1)+'%;'
                   +'background:'+(over?'var(--good)':'var(--warn)')}
              ],
              // 고정비 내역 — 어디로 나가는지
              costs:[
                {label:'월 임대료', value:(S.rent||0).toLocaleString()+'만원', tag:c.rent?'입력값':'기본 가정'},
                {label:'인건비',   value:this.man(c.labor), tag:c.staffAuto?'평수로 추정':'입력값'},
                {label:'그 외 고정비', value:this.man(c.etc), tag:c.etcAuto?'평수로 추정':'입력값'},
                {label:'원가율',   value:(S.cogs||0)+'%', tag:'기본 가정 · 수정 가능'}
              ],
              rowStyle:'display:flex;align-items:baseline;justify-content:space-between;gap:14px;'
                +'padding:13px 0;border-bottom:1px solid var(--line)'
            };
          })(),

          preview:()=>{try{const payload=buildReport();sessionStorage.setItem('mysbizon.report',JSON.stringify(payload));const restore=Object.fromEntries(['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen','picks'].map(k=>[k,S[k]]));sessionStorage.setItem('mysbizon.return',JSON.stringify(restore));location.href='report-print.html';}catch{this.setState({rp_error:'브라우저 저장 공간을 사용할 수 없습니다. CSV 저장을 이용해 주세요.'});}},
          submit:async()=>{
            if(!enabled||!ok||sent||sending||this._reportSending)return;
            this._reportSending=true;
            this.setState({rp_sending:true,rp_error:''});
            try {
              const p=buildReport();
              const body=JSON.stringify({email,agreed:S.rp_agree===true,headline:'상권 분석 리포트',sub:p.zone+' · '+p.ind,facts:p.bep||[],survey:p.survey||[],zones:(p.zones||[]).map(z=>({name:z.name,value:z.score+'점'})),honesty:'매출은 상권 집계에서 계산한 추정치입니다. 입력 조건은 사용자가 제공했으며 서버에서 재검증하지 않았습니다.'});
              if(this._reportBody!==body){this._reportBody=body;this._reportKey=crypto.randomUUID();}
              const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':this._reportKey},body,signal:AbortSignal.timeout(15000)});
              const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'발송하지 못했습니다.');
              this.setState({rp_sent:true});
            }catch(e){this.setState({rp_error:e.name==='TimeoutError'?'응답 확인 시간이 초과되었습니다. 수신함을 확인한 뒤 다시 시도해 주세요.':e.message});}
            finally{this._reportSending=false;this.setState({rp_sending:false});}
          },
          note:S.rp_error||(sent?'메일 서비스에 발송을 요청했습니다. 스팸함도 확인해 주세요.':!enabled?'현재는 미리보기와 CSV 저장을 이용할 수 있어요. 이메일 발송은 운영 준비 후 제공됩니다.':'이메일은 요청한 리포트 발송에만 사용합니다. 매출 추정치와 직접 입력한 조건을 구분해 담습니다.')
        };
      })(),
      noticeStop:e=>e.stopPropagation(),
      // 배경·✕로 닫으면 기록하지 않는다(다음 방문에 다시 뜸)
      noticeClose:()=>this.setState({notice:false}),
      // 한 번 닫아도 설정에서 다시 열 수 있어야 한다 — 한 번 보고 사라지면 다시 찾을 길이 없다
      noticeOpen:()=>this.setState({notice:true, setOpen:false}),
      // 소개창의 '이 서비스가 지키는 것' 세 줄 — 첫 화면에 다 쏟지 않고 눌렀을 때만(§35)
      aboutMoreOpen:!!S.aboutMore,
      aboutMoreLabel:S.aboutMore? '접기' : '이 서비스가 지키는 것',
      aboutMoreToggle:()=>this.setState({aboutMore:!S.aboutMore}),
      // 시작하기 = 봤다고 기록. 자동으로는 다시 뜨지 않는다.
      noticeConfirm:()=>{
        try{ localStorage.setItem('mysbizon.noticeSeen','1'); }catch(e){}
        this.setState({notice:false});
      },
      noticeWeek:()=>{
        try{ localStorage.setItem('mysbizon.noticeUntil', String(Date.now()+7*24*60*60*1000)); }catch(e){}
        this.setState({notice:false});
      },
      // 전국 확장 자리 — 지금 자료가 있는 곳은 서울뿐이다. 없는 곳은 없다고 적는다.
      sidoSel:S.sido||'서울특별시',
      sidoOptions:['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도']
        .map(v=>({v:v, label:this.tr(v)+(v==='서울특별시'?'':' · '+this.t('common.preparing'))})),
      onSido:e=>this.setState({sido:e.target.value}),
      sidoReady:(S.sido||'서울특별시')==='서울특별시',
      sidoWait:(S.sido||'서울특별시')!=='서울특별시',
      backToSeoul:()=>this.setState({sido:'서울특별시'}),
      sidoNote:'‘'+(S.sido||'서울특별시')+'’ 자료는 아직 없습니다. 지금 계산에 쓰는 자료는 서울시 상권분석서비스라 서울 1,564곳만 담고 있습니다. 전국은 소상공인시장진흥공단 상권정보로 갈아타야 하고, 상권 구획과 업종 코드가 달라 매칭이 필요합니다.',
      onFind:S.screen==='find', onDiag:S.screen==='diag',
      onSim:S.screen==='sim',
      // 어느 장사를 보고 있는지 화면에서 바로 보이고 바꿀 수 있게 한다
      indSel:S.ind,
      selectStyle:'font-size:15px;font-weight:500;color:var(--ink);background:var(--surface);border:none;border-radius:12px;padding:0 14px;height:44px;cursor:pointer;outline:none;max-width:200px',
      indOptions:(S.zi?S.zi.inds:[]).map(n=>({raw:n,label:this.indName(n)}))
        .sort((a,b)=>a.label.localeCompare(b.label,'ko')),
      onIndSel:e=>this.setState({ind:e.target.value,sel:null,picks:null,fromRegion:false}),
      onReport:S.screen==='report',
      onPrice:S.screen==='price', mk:this.marketView(),
      pr:this.priceView(),
      onFineIntro:S.screen==='fineIntro',
      fi:{
        rows:[
          {title:'후보지는 넓게, 정밀분석은 좁게',
           body:'후보지는 서울 1,564개 동네를 한 줄로 세워 어디를 볼지 정하는 화면이에요. 정밀분석은 그중 한 곳을 골라 놓고 그 안에서 무엇이 다른지 따져 보는 화면이에요.'},
          {title:'지도분석 · 그 자리에 누가 오는지 본다',
           body:'상권분석은 순위를 보여줘요. 지도분석은 고른 자리 한 곳의 사람 구성을 봐요 — 하루 몇 명이 오가고, 어느 나이가 많고, 한 사람이 얼마를 쓰는지. 후보끼리의 위치도 함께 볼 수 있어요.'},
          {title:'정밀비교 · 한 자치구를 통째로 훑는다',
           body:'비교분석은 고른 자리만 나란히 놓아요. 정밀비교는 한 자치구 안의 동네를 전부 표로 펼쳐 한눈에 훑어요.'},
          {title:'여기까지가 한계예요',
           body:'현재 연결한 자료에는 건물별 임대료와 공실이 없어요. 층수·전용면적·권리금도 없어요. 정밀분석은 동네 안까지만 답하고, 건물은 직접 확인하셔야 해요.'}
        ]
      },
      onFineCmp:S.screen==='fineCmp',
      fc:this.fineCompare(),
      onZoneCmp:S.screen==='zone',
      zc:this.zoneCompare(),
      onRegion:S.screen==='region',
      rg:this.region(),
      onMapScreen:S.screen==='map',
      onFineDetail:S.screen==='fineDetail',
      goFineDetail:()=>this.setState({screen:'fineDetail',menu:null}),
      onHub:S.screen==='hubZone'||S.screen==='hubFine',
      hub:(()=>{
        const zone = S.screen==='hubZone';
        const g = MENU.find(m=>m.hub===S.screen);
        const k = zone?'zone':'fine';
        // 이 화면이 답해야 하는 질문은 하나다 — '나는 무엇을 할 수 있지?'
        // 그래서 숫자 KPI 를 걷어내고 '무엇을 하는 곳인지 + 바로 가기'만 남긴다.
        const HEAD={
          zone:{t:'어디에서 시작할까요?', d:'내 업종에 맞는 지역을 찾고 상권을 비교해 보세요.'},
          fine:{t:'이 자리, 정말 괜찮을까요?', d:'고른 상권 하나를 매출·수요·경쟁·비용으로 뜯어봅니다.'}
        };
        // 화면 키로 찾는다. 라벨로 찾으면 영어·중국어에서 설명과 아이콘이 통째로 빈다.
        const CARD={
          zone   :{d:'여러 지역의 매출·수요·경쟁을 나란히 비교해요', cta:'비교하기'},
          find   :{d:'업종에 맞는 상권을 좋은 순서로 추천해요',      cta:'후보 찾기'},
          fineCmp:{d:'한 자치구 안의 상권을 빠짐없이 훑어요',        cta:'훑어보기'},
          map        :{d:'고른 상권이 정확히 어디인지 위치로 확인해요',   cta:'지도 열기'},
          fineDetail :{d:'매출·수요·경쟁·비용을 뜯어보고 왜 그런지 읽어요', cta:'분석 보기'},
          sim        :{d:'담아 둔 상권을 견주고 종합 1위를 뽑아 줘요',      cta:'비교 시작'},
          diag       :{d:'이 자리 한 곳의 본전선을 확인해요',              cta:'본전 보기'}
        };
        const selId = S.sel || S.zoneId;
        const selNm = (selId && S.zi && S.zi.zones[selId]) ? this.zoneLabelOf(S.zi.zones[selId].nm) : null;
        // 강조는 하나만. 셋 다 강조하면 아무것도 강조되지 않는다.
        const next = zone ? 'find'
                          : (selNm ? 'fineDetail' : 'map');
        return {
          title: HEAD[k].t,
          desc: HEAD[k].d,
          ctx: [
            {label:'업종', value:this.indName(S.ind)},
            ...(selNm ? [{label:'고른 상권', value:selNm}] : [])
          ].map(c=>({...c,
            style:'display:inline-flex;align-items:baseline;gap:6px;padding:7px 12px;border-radius:999px;'
              +'background:var(--surface);white-space:nowrap;min-width:0'})),
          // 메뉴판 대신 '다음 행동' 하나를 크게 둔다(§14·§18).
          // 나머지는 아래 한 줄짜리 목록으로 — 넷을 나란히 두면 무엇부터 눌러야 할지 모른다.
          primary:(()=>{
            const it=(g?g.items:[]).find(([k])=>k===next);
            if(!it) return {label:'', sub:'', go:()=>{}, has:false};
            const c=CARD[next]||{d:'',cta:'열기'};
            return {label:c.cta, sub:c.d, has:true,
                    go:()=>this.setState({screen:next,menu:null})};
          })(),
          // 배너 — 이 메뉴가 무엇을 하는 곳인지 한 덩어리로. 화면 폭을 다 쓴다.
          banner:'background:var(--surface);border-radius:var(--r-lg);'
            +'padding:'+this.L('26px 20px','34px 30px','44px 40px'),
          // 카드 한 줄 — 데스크톱은 나란히, 모바일은 가로로 넘긴다(§9·§10)
          cardsGrid:this.L('', 'display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))',
                               'display:grid;gap:20px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))'),
          cardsAsRail:this.bp()==='mobile',
          cardsAsGrid:this.bp()!=='mobile',
          rail:this.rail('hub',{per:4}),
          cards:(g?g.items:[]).map(([key,label])=>{
            const on=key===next;
            const c=CARD[key]||{d:'',cta:'열기'};
            return {
              label:label, sub:c.d, cta:c.cta+' →', on:on,
              go:()=>this.setState({screen:key,menu:null}),
              labelStyle:'font-size:'+this.L('17px','18px','19px')+';font-weight:700;letter-spacing:-.02em;'
                +(on?'color:var(--accent)':'color:var(--ink)'),
              subStyle:'font-size:13.5px;line-height:1.5;text-wrap:pretty;color:var(--ink2);margin-top:8px',
              ctaStyle:'font-size:13.5px;font-weight:600;margin-top:auto;padding-top:16px;white-space:nowrap;'
                +(on?'color:var(--accent)':'color:var(--ink2)'),
              // 카드 넷은 테두리를 똑같이 둔다. 강조는 색 테두리가 아니라
              // 제목·버튼 글자 색으로만 준다 — 테두리에 색을 넣으면 그것부터 눈에 걸린다.
              style:'display:flex;flex-direction:column;height:100%;min-height:'+this.L('132px','150px','168px')+';'
                +'padding:'+this.L('18px','20px','22px')+';border-radius:var(--r-lg);cursor:pointer;min-width:0;'
                +'transition:transform .18s cubic-bezier(.2,.7,.3,1);background:var(--bg);'
                +'border:1px solid var(--line)'
            };
          }),
        };
      })(),
      goFind:go('find'), goDiag:go('diag'), goCmp:go('sim'),
      goMap:()=>this.setState({screen:'map',menu:null,
        mapGu:(S.sel&&S.zgu&&S.zgu[S.sel])||'서울 전체'}),
      goFineCmp:go('fineCmp'),
      // 다시 열면 보낸 상태가 남아 있지 않게 초기화한다
      openReport:()=>this.setState({screen:'report',rp_sent:false}),
      // 헤더 오른쪽 — 언어 칩 + 설정(⚙). '어둡게' 하나만 있던 자리를 설정으로 키웠다(§44)
      ...this.settingsView(),
      q:S.q, onQ:e=>this.setState({q:e.target.value,openMore:false}),
      chips:names.slice(0,5).map(n=>({name:this.indName(n), pick:()=>this.setState({ind:n,sel:null,picks:null,openWhy:false,openMore:false,fromRegion:false}),
        style:chipBase+'flex:none;'+(n===S.ind?'background:var(--ink);color:var(--bg);font-weight:500':'background:var(--surface);color:var(--ink)'),
        // 둥근 칩 대신 글자 버튼(§15) — 고른 것만 진하게
        textStyle:'flex:none;font-size:14.5px;cursor:pointer;white-space:nowrap;transition:color .14s;'
          +(n===S.ind?'color:var(--ink);font-weight:700':'color:var(--ink2)')})),
      hasMore:names.length>5,
      openMore:!!S.openMore,
      toggleMore:()=>this.setState({openMore:!S.openMore}),
      moreLabel:S.openMore?'닫기':(names.slice(0,5).indexOf(S.ind)<0&&S.ind?this.indName(S.ind):'···'),
      moreStyle:chipBase+'flex:none;letter-spacing:0.04em;'
        +((names.slice(0,5).indexOf(S.ind)<0&&S.ind&&!S.openMore)
          ? 'background:var(--ink);color:var(--bg);font-weight:500'
          : 'background:var(--surface);color:'+(S.openMore?'var(--ink)':'var(--ink2)')),
      moreList:names.slice(5).map(n=>({name:this.indName(n),
        pick:()=>this.setState({ind:n,sel:null,picks:null,openWhy:false,openMore:false,fromRegion:false}),
        style:'display:block;padding:12px 14px;border-radius:11px;cursor:pointer;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background .12s;'+(n===S.ind?'background:var(--accent-3);font-weight:600':'')})),
      chipNote: S.err? S.err : (!S.zi? '장사 목록을 불러오는 중이에요…'
        : (q
          ? (names.length
            ? '‘'+q+'’ 검색 결과 '+names.length+'가지'+(names.length>5?' · ···를 누르면 나머지 '+(names.length-5)+'가지':'')
            : '‘'+q+'’와 맞는 장사가 없어요')
          : (S.fromRegion
            ? '이 장사는 '+(S.homeZone||'고른 동네')+'에 데이터가 있어서 골랐어요'+(names.length>5?' · ···를 누르면 더 보여요':'')
            : '많이 찾는 장사예요'+(names.length>5?' · ···를 누르면 더 보여요':'')))),
      // 데이터와 무관한 값 — 로딩 중과 실패 상태에서도 보여야 한다

      // ── 후보지 3단계: 지역 → 구 → 업종 ─────────────────────────────
      // 업종 검색창 하나만 있으면 '어디에서 찾는지'가 화면에 없다.
      fd:(()=>{
        // 지역 목록은 자료 보유와 별개로 유지한다(§3). 지금 자료가 있는 곳은 서울뿐이지만
        // 부산·인천·경기를 목록에서 지우면 '이 서비스는 서울만 하는구나'가 되어 버린다.
        // 지우는 대신, 고르면 왜 아직 비어 있는지 말한다.
        const SIDO=[
          {v:'서울특별시',     label:'서울', on:true},
          {v:'부산광역시',     label:'부산'}, {v:'대구광역시', label:'대구'},
          {v:'인천광역시',     label:'인천'}, {v:'광주광역시', label:'광주'},
          {v:'대전광역시',     label:'대전'}, {v:'울산광역시', label:'울산'},
          {v:'세종특별자치시', label:'세종'}, {v:'경기도',     label:'경기'},
          {v:'강원특별자치도', label:'강원'}, {v:'충청북도',   label:'충북'},
          {v:'충청남도',       label:'충남'}, {v:'전북특별자치도', label:'전북'},
          {v:'전라남도',       label:'전남'}, {v:'경상북도',   label:'경북'},
          {v:'경상남도',       label:'경남'}, {v:'제주특별자치도', label:'제주'}
        ];
        const sido=S.sido||'서울특별시';
        const ready=!!S.zi&&!!S.zgu;
        // 이 업종 자료가 실제로 있는 구만, 자료가 많은 순으로. 없는 구를 눌러 빈 화면을 보게 하지 않는다.
        const guCount={};
        if(ready){
          const ix=S.zi.inds.indexOf(S.ind);
          if(ix>=0) for(const k in S.zi.zones){
            const gg=S.zgu[k]; if(!gg) continue;
            const row=(S.zi.zones[k].rows||[]).find(x=>x[0]===ix);
            if(!row||!row[1]||!row[2]) continue;
            guCount[gg]=(guCount[gg]||0)+1;
          }
        }
        const gus=Object.keys(guCount).sort((a,b)=>a.localeCompare(b,'ko'));
        const cur=S.findGu||'';
        const chip=on=>'display:inline-flex;align-items:center;justify-content:center;gap:6px;'
          +'padding:10px 16px;border-radius:999px;font-size:14px;cursor:pointer;white-space:nowrap;'
          +'transition:background .14s,color .14s;'
          +(on?'background:var(--accent);color:#FFFFFF;font-weight:600'
              :'background:var(--surface);color:var(--ink2)');
        return {
          // 누르면 바뀐다. 자료가 없는 곳은 눌러도 '아직 없어요'가 뜬다 — 죽은 칩을 두지 않는다.
          sido:SIDO.map(o=>({
            label:o.label,
            pick:()=>this.setState({sido:o.v, findGu:''}),
            style:chip(sido===o.v)+(o.on?'':(sido===o.v?'':';opacity:.65'))})),
          sidoRail:this.rail('fdSido',{per:8}),
          // 서울 밖을 골랐을 때 — 목록·구·결과 대신 이 안내가 뜬다
          sidoWaiting: sido!=='서울특별시',
          sidoReady:  sido==='서울특별시',
          sidoWaitTitle: this.t('mk.waitTitle',{name:sido}),
          sidoWaitText: this.t('sido.waitFind',{region:sido}),
          backToSeoulFind:()=>this.setState({sido:'서울특별시', findGu:''}),
          // 구는 25개라 접어 둔다. 편 상태에서는 스크롤이 생기게 높이를 묶는다.
          guOpen:!!S.findGuOpen,
          guToggle:()=>this.setState({findGuOpen:!S.findGuOpen}),
          guToggleLabel:(S.findGuOpen?'접기':'구 전체 보기')+' ('+gus.length+')',
          guBoxStyle:'margin-top:12px;display:grid;gap:8px;'
            +'grid-template-columns:repeat(auto-fill,minmax('+this.L('92px','108px','116px')+',1fr));'
            // 펼치면 스크롤이 생긴다. 스크롤 막대가 보이도록 오른쪽 여백을 둔다.
            +(S.findGuOpen? 'max-height:'+this.L('200px','240px','280px')+';overflow-y:auto;padding-right:8px' : ''),
          // 접었을 때는 앞 6개만 그린다 — 반 잘린 줄을 남기면 '아래를 못 본다'가 된다
          gu:(S.findGuOpen
                ? [{label:'전체', v:''}, ...gus.map(g=>({label:g, v:g}))]
                : [{label:'전체', v:''}, ...gus.map(g=>({label:g, v:g}))].slice(0,6)
             ).map(o=>({
            label:o.label,
            pick:()=>this.setState({findGu:o.v, sel:null}),
            style:'display:flex;align-items:center;justify-content:center;padding:11px 8px;'
              +'border-radius:var(--r-sm);font-size:13.5px;cursor:pointer;white-space:nowrap;'
              +'overflow:hidden;text-overflow:ellipsis;transition:background .14s,color .14s;'
              +(cur===o.v?'background:var(--accent-3);color:var(--accent);font-weight:700'
                         :'background:var(--surface);color:var(--ink2)')})),
          guNote: cur? cur+'에서 자료가 있는 상권 '+(guCount[cur]||0)+'곳' : '서울 전체에서 찾습니다',
          hasGu: gus.length>0,
          indValue:S.ind,
          indName:this.indName(S.ind),
          scope: cur || '서울 전체',
          // 고르는 칸은 접어 둔다(§35) — 화면의 주인공은 결과다.
          // 닫혀 있을 때는 지금 조건을 한 줄로만 보여준다.
          pickOpen: !!S.findPickOpen,
          pickToggle: ()=>this.setState({findPickOpen:!S.findPickOpen}),
          pickLabel: S.findPickOpen? '접기' : '바꾸기',
          summary: (cur||'서울 전체')+' · '+this.indName(S.ind)
        };
      })(),

      // 지역 화면에서 업종을 이미 골라 왔으면 질문이 아니라 확인으로 말한다
      findTitle: S.fromRegion
        ? this.indName(S.ind)+' 기준으로 보고 있습니다'
        : '어떤 장사를 하실 건가요?',

      findSub: S.fromRegion
        ? '바꾸려면 아래에서 다른 업종을 고르세요.'
        : '손님 많고 경쟁 적은 자리를 찾아드려요.',
      bp:this.bp(),
      icoX:this.ui('x'), icoChevron:this.ui('chevronRight'), icoBack:this.ui('arrowLeft'),
      headerStyle:'position:sticky;top:0;z-index:50;height:'+this.L('56px','60px','64px')+';display:flex;align-items:center;'
        +'background:var(--bg-blur);backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);'
        +'border-bottom:1px solid rgba(0,0,0,.05);transition:all .2s ease-in-out',
      headerInner:'width:100%;max-width:'+this.L('100%','860px','1280px')+';margin:0 auto;padding:0 '+this.L('16px','24px','32px')+';display:flex;align-items:center;gap:'+this.L('12px','20px','28px'),
      // 칸을 1080 으로 잡아 놨는데 안의 내용은 전부 600~660 으로 묶여 있어
      // 오른쪽 400px 이 늘 비어 있었다("왜 다 왼쪽에 있어"). 칸을 내용에 맞춘다.
      // 넓히는 쪽이 아니라 좁히는 쪽으로 맞춘 이유: 620px 짜리 본문을 1080 으로 늘리면
      // 한 줄이 너무 길어져 읽기 어려워진다.
      // 데스크톱 1280 / 좌우 32. 넓힌 만큼 각 화면의 내용도 그리드로 폭을 채운다.
      mainStyle:'max-width:'+this.L('100%','860px','1280px')+';margin:0 auto;padding:0 '+this.L('16px','24px','32px')+' '+this.L('80px','110px','120px'),
      ds1:this.ds('h1'), ds2:this.ds('h2'), ds3:this.ds('h3'),
      // 모바일에서는 전부 1열. 세로 메뉴도 위쪽 가로 목록이 된다.
      mapCols:this.L('1fr','1fr','minmax(0,1.35fr) minmax(300px,1fr)'),
      dashCols:this.L('1fr','1fr','minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr)'),
      navCols:this.L('1fr','200px minmax(0,1fr)','200px minmax(0,1fr)'),
      dsCard:this.ds('card'), dsCardLg:this.ds('cardLg'), dsCardHi:this.ds('cardHi'),
      dsNum:this.ds('num'), dsNumSm:this.ds('numSm'),
      dsBody:this.ds('body'), dsSub:this.ds('sub'),
      dsCta:this.ds('cta'), dsGhost:this.ds('ctaGhost'), dsInput:this.ds('input'),
      // 섹션 간격 72~96 · 카드 간격 16~20
      dsSection:'padding:'+this.L('48px','64px','80px')+' 0 0',
      dsGrid3:'display:grid;gap:'+this.L('14px','16px','20px')+';grid-template-columns:repeat(auto-fit,minmax('+this.L('100%','260px','300px')+',1fr))',
      dsGrid4:'display:grid;gap:'+this.L('12px','16px','18px')+';grid-template-columns:repeat(auto-fit,minmax('+this.L('150px','200px','220px')+',1fr))',
      dataError:S.err, retryData:()=>location.reload(),
      ...this.home(),
      ai:this.chat(),
      // 오른쪽 아래에서 접었다 폈다 — 어느 화면에서나 쓸 수 있다
      // 홈에서 지역·업종 목록이 열려 있으면 AI 도우미 버튼은 비켜 준다 — 목록 오른쪽 아래를 가린다
      botOpen:!!S.bot, botClosed:!S.bot && !S.pickOpen,
      botToggle:()=>this.setState({bot:!S.bot},()=>{ if(!S.bot) this.scrollBot(); }),
      botPanel:'position:fixed;z-index:70;display:flex;flex-direction:column;background:var(--bg);'
        +'border-radius:'+this.L('20px 20px 0 0','20px','20px')+';box-shadow:0 24px 60px rgba(0,0,0,.22);'
        +'animation:botIn .26s cubic-bezier(.22,.72,.24,1) both;'
        +this.L('left:0;right:0;bottom:0;height:78vh;','right:20px;bottom:20px;width:372px;height:min(560px,78vh);','right:28px;bottom:28px;width:392px;height:min(580px,76vh);'),
      botCloseStyle:'flex:none;width:28px;height:28px;border-radius:50%;background:var(--surface);color:var(--ink2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s',
      // 모바일에서는 글자를 빼고 동그란 아이콘으로 줄인다(§17) — 차트·버튼을 가리지 않게.
      // 손가락으로 누를 수 있는 크기(40px)는 지킨다. 아이폰 홈 인디케이터 위로 safe-area 를 더한다.
      botFabIcon:this.bp()==='mobile',
      botFabText:this.bp()!=='mobile',
      botFab:'position:fixed;z-index:70;display:inline-flex;align-items:center;justify-content:center;gap:7px;'
        +this.L('width:40px;padding:0;','padding:0 14px;','padding:0 14px;')
        +'height:40px;border-radius:999px;'
        +'background:var(--bg);color:var(--accent);border:1px solid var(--line-strong);cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.06);'
        +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
        +this.L('right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));',
                'right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));',
                'right:28px;bottom:calc(28px + env(safe-area-inset-bottom,0px));'),
      // CTA 체계 — 주 행동 하나만 강조한다
      ctaPrimary:'font-size:16px;font-weight:600;color:#FFFFFF;background:var(--accent);border:none;border-radius:16px;padding:0 26px;height:54px;cursor:pointer;box-shadow:0 6px 16px -6px rgba(0,0,0,.18);transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1)',
      ctaText:'font-size:14.5px;color:var(--accent);cursor:pointer;white-space:nowrap',
      prosCols:this.L('1fr','1fr 1fr','1fr 1fr'),
      openWhy:S.openWhy, whyLabel:S.openWhy?'계산 방식 접기':'점수 계산 방식 보기',
      toggleWhy:()=>this.setState({openWhy:!S.openWhy}),
      openCond:S.open.cond, openMoney:S.open.money, openDay:S.open.day, openRisk:S.open.risk,
      tgCond:tg('cond'), tgMoney:tg('money'), tgDay:tg('day'), tgRisk:tg('risk'),
      caretCond:caret(S.open.cond), caretMoney:caret(S.open.money), caretDay:caret(S.open.day), caretRisk:caret(S.open.risk),
      ready:!!r
    };

    if(!r){
      out.t={eyebrow:'',name:'',score:'',grade:'',gradeStyle:'display:none',factors:[],parts:[],
        togglePick:()=>{}, pickLabel:'',
        verdict:'', pctText:'', pctFine:'', medText:'', scoreBar:'display:none', scoreMed:'display:none', reasons:[],
        thin:false, thinWarn:'', thinBadge:''};
      out.rows=[]; out.honesty='';
      out.d={eyebrow:'',headline:S.err?'데이터를 읽지 못했습니다.':'불러오는 중입니다.',bep:'—',rev:'—',revName:'',gap:'',gapStyle:'display:none',fill:'display:none',mark:'display:none',factors:[],thin:'',thinStyle:'display:none',honesty:''};
      out.inputs=[]; out.scens=[]; out.scenNote=''; out.stack=[]; out.moneyRows=[]; out.stackLead='';
      out.dayStats=[]; out.dayWhy=''; out.riskStats=[]; out.riskLead='';
      out.foot={has:false,lead:'',stats:[],note:''};
      out.sat={has:false};
      out.condHint=''; out.moneyHint=''; out.dayHint=''; out.riskHint='';
      // 불러오기 실패에도 죽은 컨트롤이 남지 않도록 중립값을 채운다
      out.c={headline: S.err?'데이터를 읽지 못했습니다.':'불러오는 중입니다.',
        sub: S.err? '잠시 후 다시 열어 주세요.':'', cols:[], diffs:[], honesty:'', empty:true, on:false,
        add:{q:'',onQ:()=>{},onKey:()=>{},clear:()=>{},hasQ:false,searching:false,
             found:[],hasFound:false,noResult:false,noResultText:'',
             recent:[],hasRecent:false,suggest:[],hasSuggest:false,full:false,fullText:'',
             foundRail:this.rail('cmpFound',{per:3}),recentRail:this.rail('cmpRecent',{per:3}),
             suggestRail:this.rail('cmpSug',{per:3})},
        rail:this.rail('cmpCols',{per:3}), chartRail:this.rail('cmpCh',{per:1}),
        charts:[], hasCharts:false, emptyCount:'',
        verdict:'', verdictWhy:[], hasVerdict:false,
        presets:[], presetRail:this.rail('cmpPre',{per:5}),
        whyOpen:false, whyLabel:'', toggleWhy:()=>{}, why:{label:'',rows:[],how:''},
        bestName:'', bestSlotStyle:'', bestRanks:[], order:[]};
      out.openMap=false; out.mapPins=[]; out.mapNote='';
      out.cmpMap={ready:false,gus:[],pins:[],vb:'0 0 100 100',stroke:'0.5',legend:[],legendNote:''};
      out.addZoneOptions=[{id:'',label:'동네 더하기'}]; out.addZoneFull=false; out.onAddZone=()=>{};
      out.mapLabel='지도 보기'; out.mapBtn='display:none'; out.toggleMap=()=>{};
      out.area=S.area; out.onArea=()=>{}; out.areaLabel='—'; out.areaWord='';
      out.linked=[]; out.linkNote=''; out.moneyDots=[]; out.dotNote='';
      out.rg=this.region();
      out.mv={eyebrow:'', headline:S.err?'데이터를 읽지 못했습니다.':'불러오는 중입니다.', sub:'',
        map:{ready:false,gus:[],pins:[],vb:'0 0 100 100',stroke:'0.5',legend:[],legendNote:''},
        detail:{has:false,title:'',dong:'',rows:[],facts:[],note:''},
        target:'', stamp:'', question:'', rowStyle:'', tagStyle:'',
        cards:[], cardIndex:0,
        now:{charts:[],hasCharts:false,rail:this.rail('mv',{per:1}),chartNav:[],
             hasChartNav:false,chartCount:'0개',missing:[],hasMissing:false,
             title:'',q:'',big:'',bigLabel:'',verdict:'',hasVerdict:false,
             rows:[],bars:[],hasBars:false,note:'',hasNote:false,bigStyle:''},
        nav:[],
        metrics:{has:false,rows:[],seoul:[],missing:[],note:''},
        pros:{good:[],care:[]}, vs:{rows:[],note:''}, sections:[],
        gu:'서울 전체', guOptions:['서울 전체'], onGu:()=>{},
        list:[], cta:'후보지 찾기', note:this.dataNote('mv','',[])};
      return out;
    }

    return this.fillDataViews(out, r);
  }
}

// ── 나눠 둔 조각들을 프로토타입에 합친다 ──────────────────────────────
// 한 파일에 3,400줄이 있으면 어디를 고쳐야 하는지 찾는 데만 시간이 든다.
// 파일은 책임으로 나누고, 동작은 그대로 둔다(메서드 몸통을 그대로 옮겼다).
//   util     값 다듬기·이름 바꾸기
//   design   카드·제목·숫자 스타일과 '숫자 → 해석'
//   analysis 순위·지도·정밀분석 섹션 계산
//   screens  화면별 값 묶음(홈·지역비교·후보 지역·시세분석)
//   chat     도우미
//   charts   Chart.js 위에 얹은 이 서비스의 차트 규칙
//   carousel 가로 슬라이드(드래그·휠·화살표)
//   views    renderVals 가 쓰는 화면별 조립
const P = globalThis.MysbizonParts || {};
for (const name of ['i18n','theme','roman','util','design','rank','analysis','screens','chat','charts','carousel','market','views']) {
  const part = P[name];
  if (!part) throw new Error('MYSBIZON: logic/' + name + '.js 가 먼저 로드되어야 합니다');
  for (const key of Object.keys(part)) {
    if (Object.prototype.hasOwnProperty.call(Component.prototype, key)) {
      throw new Error('MYSBIZON: 메서드 이름이 겹칩니다 — ' + key);
    }
    Component.prototype[key] = part[key];
  }
}

return Component;
};
