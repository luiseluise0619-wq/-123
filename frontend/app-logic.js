'use strict';
globalThis.MysbizonLogic = function(DCLogic, React) {


class Component extends DCLogic {
  state = {
    zi:null, sbi:null, sti:null, rentStats:null, salesHistory:null, err:'',
    q:'', ind:'커피-음료', sel:null, picks:null, screen:'home', menu:null,
    openWhy:false, open:{cond:false,money:false,day:false,risk:false},
    scen:'보통일 때', ...MysbizonConst.BEP_DEFAULT,
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

  componentDidUpdate(){
    this.saveSurvey();
    if(this._screen!==this.state.screen){
      const first = this._screen===undefined;
      this._screen=this.state.screen;
      // 뒤로 가기 기록. 뒤로 가기로 온 것이면 새로 쌓지 않는다 — 쌓으면 앞으로 가기가 사라진다.
      if(this._fromPop) this._fromPop=false;
      else if(!first){ try{ history.pushState({mysbizon:this.state.screen}, ''); }catch(e){} }
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
    // 최근 개·폐업은 정밀분석(과 '내 가게'를 저장한 허브)에서만 쓴다 — 그때 한 번만 받는다.
    if(this.state.screen==='fineDetail'||(this.state.screen==='hubFine'&&this.state.myShop)) this.loadOpenings();
    this.placePanel();
    // 차트와 가로 슬라이드는 DOM 이 그려진 뒤에 붙인다.
    // DC 가 다시 그려도 같은 canvas 면 값만 갱신한다(charts.js 참조).
    this.paintCharts(); this.bindRails(); this.paintKakaoMap();
    // 마크업에 그대로 적힌 한국어를 옮긴다(한국어일 때는 아무 일도 안 한다)
    this.trDom();
  }

  componentWillUnmount(){
    this.destroyCharts();
    this.destroyKakaoMap();
    try{ if(this._onPop) window.removeEventListener('popstate', this._onPop); }catch(e){}
    if(this._out) document.removeEventListener('click',this._out,false);
    if(this._noHover) document.removeEventListener('click',this._noHover,true);
    if(this._yesHover) document.removeEventListener('pointermove',this._yesHover,true);
    if(this._rz) window.removeEventListener('resize',this._rz);
    if(this._raf) cancelAnimationFrame(this._raf);
    if(this._ro) this._ro.disconnect();
    clearTimeout(this._sc);clearTimeout(this._autoT);clearTimeout(this._panelT);clearTimeout(this._firstPaint);
  }

  componentDidMount(){
    // 저장해 둔 화면 설정(밝기·테마·색)과 언어를 먼저 얹는다 — 얹기 전에 그리면 한 번 번쩍인다
    try{ this.loadTheme(); this.loadLocales(); }catch(e){}
    // 뒤로 가기로 화면을 하나씩 되돌린다.
    //   전에는 어느 화면에서 뒤로 가든 **사이트를 통째로 벗어났다.** 폰에서는
    //   뒤로 가기가 화면을 되돌리는 기본 동작이라, 사용자는 그냥 앱을 떠나게 됐다.
    //   주소는 바꾸지 않는다 — 이 앱에는 아직 딥링크 규칙이 없어서, 주소만 바꾸면
    //   새로고침했을 때 그 주소가 무엇을 뜻하는지 알 수 없다.
    try{
      history.replaceState({mysbizon:this.state.screen||'home'}, '');
      this._onPop=e=>{
        const scr=e.state&&e.state.mysbizon;
        if(!scr) return;                       // 우리가 쌓은 기록이 아니면 브라우저에 맡긴다
        const S=this.state;
        // 떠 있는 창이 열려 있으면 뒤로 가기는 **그것부터 닫는다.** 폰에서 기대하는 동작이고,
        // 안 그러면 창은 그대로인 채 뒤 화면만 바뀐다. 화면을 안 옮겼으니 기록을 도로 쌓는다.
        if(S.setOpen || S.bot || S.notice){
          try{ history.pushState({mysbizon:this._screen}, ''); }catch(err){}
          this.setState({setOpen:false, bot:false, notice:false});
          return;
        }
        this._fromPop=true;
        this.setState({screen:scr, menu:null, pickOpen:null});
      };
      window.addEventListener('popstate', this._onPop);
    }catch(e){}
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
    this._firstPaint=setTimeout(()=>{ try{ this.paintCharts(); this.bindRails(); this.paintKakaoMap(); this.trDom(); }catch(e){} },0);
    // 인쇄본(report-print.html)에서 '← 분석으로 돌아가기' 로 돌아왔을 때.
    // 설문 답(rp_*)까지 되살린다 — 안 그러면 미리보기를 한 번 본 대가로
    // 8문항을 처음부터 다시 답해야 했다.
    try{
      const back=sessionStorage.getItem('mysbizon.return');
      sessionStorage.removeItem('mysbizon.return');
      // 인쇄본에서 돌아온 게 아니면, 새로고침 전에 저장해 둔 설문 답을 되살린다.
      // 새로고침 한 번에 8문항을 다시 답하게 하지 않는다. sessionStorage 라
      // 탭을 닫으면 사라진다 — '한 번 앉은 자리'의 기록이다.
      const raw = back || sessionStorage.getItem('mysbizon.survey');
      if(raw){
        const restore=this.surveyRestore(JSON.parse(raw));
        // 답을 하나라도 한 사람만 리포트 화면으로 되돌린다.
        // 질문 키만 본다 — `rp_touched` 는 늘 객체({})라 truthy 여서,
        // 이걸 같이 세면 설문을 시작도 안 한 사람이 리포트 화면으로 떨어진다.
        const ANSWERED=['rp_sido','rp_gu','rp_ind','rp_stage','rp_age',
                        'rp_biz','rp_when','rp_need','rp_cost','rp_email'];
        if(back || ANSWERED.some(k=>restore[k])) restore.screen='report';
        this.setState(restore);
      }
    }catch{}

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
    this.loadConfig();
    let seen=true;
    try{ seen=!!sessionStorage.getItem('mysbizon.seenIntro');
      if(seen) this.setState({skip:true}); else sessionStorage.setItem('mysbizon.seenIntro','1'); }catch(e){}
    // (전에 여기 있던 '1,564 카운트업'은 지웠다 — state.count 를 읽는 조각이 하나도 없는데
    //  첫 방문마다 화면 전체를 60fps 로 100번 다시 그려 폰만 뜨겁게 했다.)
    // 버블 단계에서만 닫는다. 캡처로 잡으면 React onClick보다 먼저 돌아 열림을 막는다.
    this._out=e=>{
      const t=e.target;
      if(t.closest && (t.closest('nav') || t.closest('[data-search]'))) return;
      if(this.state.menu||this.state.zFocus) this.setState({menu:null,zFocus:false});
    };
    document.addEventListener('click',this._out,false);

    // '눌렀는데 방금 누른 자리가 회색으로 남는' 것을 막는다.
    //   설문은 누르면 바로 다음 질문으로 넘어간다. 손은 그대로인데 새 항목이 커서 밑으로
    //   들어오니 브라우저가 그 항목에 :hover 를 준다 — 사용자에겐 '전에 클릭한 게 남은'
    //   것으로 보인다(실은 다음 질문의 엉뚱한 항목이다).
    //   그래서 누른 직후에는 hover 를 끄고, 포인터가 실제로 움직이면 되살린다.
    //   규칙은 company.css 의 `body:not(.dc-nohover) .pick-opt:hover`.
    this._hoverOff=false;
    this._noHover=()=>{ if(this._hoverOff) return;
      this._hoverOff=true; document.body.classList.add('dc-nohover'); };
    this._yesHover=()=>{ if(!this._hoverOff) return;
      this._hoverOff=false; document.body.classList.remove('dc-nohover'); };
    document.addEventListener('click',this._noHover,true);
    document.addEventListener('pointermove',this._yesHover,true);

    this.loadInitialData();
    try{ const r=JSON.parse(localStorage.getItem('mysbizon.recentZones')||'[]');
      if(Array.isArray(r)&&r.length) this.setState({recent:r}); }catch(e){}
    // 내 가게 — 상권 코드(숫자)만 받는다. 사람이 고칠 수 있는 곳이라 모양을 본다.
    try{ const m=localStorage.getItem('mysbizon.myShop'); if(m&&/^[0-9]{5,12}$/.test(m)) this.setState({myShop:m}); }catch(e){}
  }



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
      // 허브 화면 대신 — 같은 메뉴 안의 화면을 본문 맨 위 알약 한 줄로 오간다. 지금 화면은 진하게.
      sib:(()=>{
        const g=MENU.find(m=>m.keys.indexOf(S.screen)>=0);
        // 허브 화면은 그 자체가 목록이라 알약 줄을 겹쳐 두지 않는다
        if(!g||g.items.length<2||/^hub/.test(S.screen||'')) return {has:false, list:[]};
        return {has:true, list:g.items.map(([k,label])=>({label,
          go:()=>this.setState({screen:k,menu:null}),
          style:'flex:none;font-size:13.5px;padding:9px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;'
            +'display:inline-flex;align-items:center;transition:background .14s,color .14s;'
            +(S.screen===k?'background:var(--ink);color:var(--card);font-weight:600':'background:var(--card);color:var(--ink2);font-weight:500')}))};
      })(),
      nav:MENU.map((g,gi)=>({
        track:["nav.zone","nav.fine","nav.price","nav.report"][gi],
        label:g.label, isOpen:false,
        // 모바일 탭바 아이콘(Lucide 계열 선 아이콘). 순서는 MENU 와 같다.
        hasIcon:this.bp()==='mobile',
        icon:[
          [{d:'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z'},{d:'m21 21-4.35-4.35'}],
          [{d:'M3 3v18h18'},{d:'M18 17V9'},{d:'M13 17V5'},{d:'M8 17v-3'}],
          [{d:'m22 7-8.5 8.5-5-5L2 17'},{d:'M16 7h6v6'}],
          [{d:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'},{d:'M14 2v6h6'},{d:'M16 13H8'},{d:'M16 17H8'}]
        ][gi]||[],
        open:()=>this.setState({screen:g.hub,menu:null}),
        // 모바일은 아래 탭바(company.css) — 알약 없이 글자색으로만 활성을 표시한다(토스식)
        style:this.bp()==='mobile'
          ? 'font-size:11px;white-space:nowrap;cursor:pointer;padding:6px 4px;min-width:0;text-align:center;'
            +'display:flex;flex-direction:column;align-items:center;gap:3px;overflow:hidden;text-overflow:ellipsis;transition:color .16s;'
            +(g.keys.indexOf(S.screen)>=0?'color:var(--ink);font-weight:700':'color:var(--ink3);font-weight:500')
          : 'font-size:14px;white-space:nowrap;cursor:pointer;padding:11px 10px;border-radius:9px;display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;transition:background .16s,color .16s;'
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
      screenKey:S.screen||'home',
      // 소개는 별도 화면이 아니라 홈 위에 뜨는 안내창
      noticeOn:!!S.notice,
      noticeCard:'width:100%;max-width:'+this.L('100%','420px','440px')+';background:var(--card);border-radius:22px;'
        +'padding:'+this.L('22px','26px','28px')+';box-shadow:0 24px 60px rgba(0,0,0,.22);'
        +'max-height:calc(100dvh - 40px);overflow-y:auto;overscroll-behavior:contain',
      aboutStats:[
        {value:'1,564곳', label:'서울 동네'},
        {value:'62가지', label:'장사 종류'},
        {value: S.zi? this.qtr(S.zi.quarter).replace('년 ','.').replace('분기','Q') : '—', label:'자료 기준'}
      ],
      // 세 걸음 — 처음 온 분이 무엇부터 하면 되는지
      aboutSteps:[
        {n:'1', title:'업종과 지역을 고른다', body:'첫 화면에서 장사 종류만 고르면 서울 동네가 좋은 순서로 줄 서요.'},
        {n:'2', title:'후보를 견준다',       body:'마음에 드는 곳을 담아 두면 매출·손님·경쟁으로 종합 1위를 뽑아 드려요.'},
        {n:'3', title:'내 숫자로 계산한다',   body:'평수와 임대료를 넣으면 월 얼마를 팔아야 본전인지 나와요.'}
      ],
      // 메뉴 네 가지 — 각각 답하는 질문 하나
      aboutTabs:[
        {tab:'상권분석', body:'어디가 좋지? — 여러 동네를 훑고 줄 세워요.'},
        {tab:'정밀분석', body:'여기 왜 괜찮지? — 고른 곳 하나를 매출·수요·경쟁·비용으로 뜯어봐요.'},
        {tab:'통합시세', body:'장사 환경은 어떤가? — 임대료·공실부터 환율·원자재까지.'},
        {tab:'리포트',   body:'어떤 지원을 받지? — 조건에 해당할 수 있는 정부 창업지원사업을 찾아 드려요.'},
        {tab:'AI 도우미', body:'오른쪽 아래 버튼이에요. 계산된 값만 근거로 답하고, 없는 값은 없다고 말해요.'}
      ],
      aboutRows:[
        {title:'장사를 먼저 골라요',
         body:'보통은 동네를 먼저 고르고 그 동네가 어떤지 봐요. 여기는 거꾸로예요. 업종을 말해 주시면 서울 동네를 좋은 순서대로 줄 세워 드려요.'},
        {title:'점수가 어떻게 나왔는지 보여드려요',
         body:'손님이 얼마나 쓰는지, 같은 가게가 몇 곳인지, 한 곳당 얼마 버는지. 어느 항목 때문에 점수가 높은지 그 자리에서 보실 수 있어요.'},
        {title:'모르는 건 모른다고 써요',
         body:'없는 값을 지어내지 않아요. 실제로 센 숫자와 나눠서 낸 추정값을 화면에서 구분해 표시해요.'}
      ],
      // 리포트 — 화면에 없는 값만 묻는다(개업 시기 · 자금 · 인력). 이메일은 동의를 받아야 보낸다.
      rp:this.reportView(r),
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
      sidoNote:this.t('sido.notYet',{sido:this.placeName(S.sido||'서울특별시')}),
      onFind:S.screen==='find', onDiag:S.screen==='diag',
      onSim:S.screen==='sim',
      // 어느 장사를 보고 있는지 화면에서 바로 보이고 바꿀 수 있게 한다
      indSel:S.ind,
      selectStyle:'font-size:15px;font-weight:500;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:0 42px 0 14px;min-height:44px;line-height:1.2;cursor:pointer;outline:none;max-width:260px;appearance:none',
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
          {title:'지도분석 · 그 자리에 누가 오는지 봐요',
           body:'상권분석은 순위를 보여줘요. 지도분석은 고른 자리 한 곳의 사람 구성을 봐요 — 하루 몇 명이 오가고, 어느 나이가 많고, 한 사람이 얼마를 쓰는지. 후보끼리의 위치도 함께 볼 수 있어요.'},
          {title:'정밀비교 · 한 자치구를 통째로 훑어요',
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
          fine:{t:'이 자리, 정말 괜찮을까요?', d:'고른 상권 하나를 매출·수요·경쟁·비용으로 뜯어봐요.'}
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
        // 허브가 메뉴판으로만 끝나면 화면 절반이 빈다. 이미 계산해 둔 값 한 줄을
        // 버튼 밑에 붙여 '누르면 무엇이 나오는지'를 미리 보여준다. 없으면 줄을 안 그린다.
        const r = this.rank();
        const peek = (()=>{
          if(!r || !r.list.length) return '';
          if(zone){
            return this.t('hub.peekTop',{ind:this.indName(S.ind), n:r.covered.toLocaleString(),
                                         zone:this.zoneLabelOf(r.list[0].name)});
          }
          if(!selId) return '';
          const i = r.list.findIndex(o=>o.id===selId);
          if(i<0) return '';
          // 이름은 바로 위 '고른 상권' 칩에 이미 있다 — 순위만 적는다
          return this.t('rank.ofPlaces',{n:r.covered.toLocaleString(), r:i+1});
        })();
        return {
          title: HEAD[k].t,
          desc: HEAD[k].d,
          ctx: [
            {label:'업종', value:this.indName(S.ind)},
            ...(selNm ? [{label:'고른 상권', value:selNm}] : [])
          ].map(c=>({...c,
            // 배너(강조색 면) 위 흰 칩 — 글자색을 배너에서 물려받으면 흰 글자가 흰 칩에 묻힌다(실제로 그랬다)
            style:'display:inline-flex;align-items:baseline;gap:6px;padding:7px 12px;border-radius:999px;'
              +'background:var(--card);color:var(--ink);white-space:nowrap;min-width:0'})),
          // 메뉴판 대신 '다음 행동' 하나를 크게 둔다(§14·§18).
          // 나머지는 아래 한 줄짜리 목록으로 — 넷을 나란히 두면 무엇부터 눌러야 할지 모른다.
          primary:(()=>{
            const it=(g?g.items:[]).find(([kk])=>kk===next);
            if(!it) return {has:false, label:'', go:()=>{}};
            const c=CARD[next]||{d:'',cta:'열기'};
            // 상권을 아직 안 골랐으면 '지도 열기'가 아니라 '상권 고르기'다 —
            // 지도 자체는 아직 준비 중이고, 이 화면의 목적은 목록에서 한 곳을 고르는 것이다.
            const first = (next==='map' && !selNm);
            const label = first ? '상권 고르기' : c.cta;
            return {has:true, label:label,
                    // 결과 한 줄이 있으면 그걸 쓰고, 없으면 '무엇을 하는 곳인지'로 내려간다.
                    peekText: peek || (first ? '한 곳을 고르면 그 자리를 뜯어봐요' : c.d),
                    // 배너 위라 글자색은 배너를 따른다(흰색). 값이 있으면 굵게.
                    peekStyle: peek ? 'font-weight:600;color:inherit' : 'color:inherit;opacity:.85',
                    go:()=>this.setState({screen:next,menu:null})};
          })(),
          // 배너(강조색 면 + 흰 글씨) — 사장님 시안: '배너+서비스 소개' 위에, 메뉴 카드 아래에.
          bannerStyle:'background:var(--accent);color:var(--on-accent);border-radius:var(--r-lg);'
            +'padding:'+this.L('26px 20px 24px','34px 30px 30px','40px 36px 36px')+';overflow:hidden',
          bannerTitle:this.ds('h1')+';color:inherit',
          bannerBody:'font-size:'+this.L('15px','16px','17px')+';line-height:1.55;margin-top:10px;max-width:560px;'
            +'color:inherit;opacity:.9;text-wrap:pretty',
          // 배너 안 버튼은 흰 알약(파랑 위 파랑 버튼은 안 보인다)
          primaryInBanner:'font-size:16px;font-weight:700;color:var(--accent);background:var(--on-accent);border:none;'
            +'border-radius:16px;padding:0 26px;height:54px;cursor:pointer;transition:filter .16s,transform .18s;'
            +'display:inline-flex;align-items:center;justify-content:center;gap:8px;'
            +this.L('width:100%','','')+';max-width:100%',
          // 카드 격자 — 메뉴 전부를 같은 무게의 카드로(시안대로). 모바일 2열 · PC 3~4열.
          gridStyle:'display:grid;gap:'+this.L('10px','12px','14px')+';margin-top:'+this.L('16px','20px','24px')
            +';grid-template-columns:repeat(auto-fill,minmax('+this.L('150px','190px','200px')+',1fr))',
          cards:(()=>{
            const cardStyle='background:var(--card);border-radius:var(--r-md);padding:'+this.L('18px 16px','22px 20px','24px 22px')
              +';cursor:pointer;display:flex;flex-direction:column;min-width:0;min-height:'+this.L('140px','160px','170px')
              +';transition:transform .14s,box-shadow .14s';
            const rows=(g?g.items:[]).map(([key,label])=>{
              const c=CARD[key]||{d:'',cta:'열기'};
              return {label:label, sub:c.d, cta:c.cta||'열기', style:cardStyle,
                      go:()=>this.setState({screen:key,menu:null})};
            });
            // '내 가게'를 저장해 뒀으면 맨 앞에 카드 하나 — 창업한 뒤에도 다시 올 이유가 되는 자리다.
            const mineId = (!zone && S.myShop && S.zi && S.zi.zones[S.myShop]) ? S.myShop : null;
            if(mineId){
              const OP=S.op, z=(OP&&OP.available&&OP.zones)?OP.zones[mineId]:null;
              const sub = !OP ? this.t('op.loading')
                : (!OP.available ? this.t('op.mineWait')
                   : this.t('op.mineSub',{o:z?z.o:0, c:z?z.c:0, days:OP.days}));
              rows.unshift({label:this.t('op.mine'), sub:this.zoneLabelOf(S.zi.zones[mineId].nm)+' · '+sub,
                cta:'보기', style:cardStyle,
                go:()=>this.setState({screen:'fineDetail', sel:mineId, zoneId:mineId, mvTab:'recent', menu:null})});
            }
            return rows;
          })()
        };
      })(),
      goFind:go('find'), goCmp:go('sim'),
      // 후보지 화면은 아무것도 안 고른 상태에서 1위 상권을 보여준다(S.sel 은 null).
      // 그 상태에서 '이 상권 자세히 보기'를 누르면 화면에 보이던 상권이 그대로
      // 넘어가야 한다 — 예전에는 S.sel 이 null 이라 자치구가 '서울 전체'로 떨어지고,
      // 그다음 허브도 '고른 상권 없음'으로 되돌아갔다.
      goMap:()=>{
        const r=this.rank(), L=(r&&r.list)||[];
        const shown = S.sel
          || ((S.homeZone && (L.find(o=>o.name===S.homeZone)||{}).id) || (L[0]||{}).id)
          || null;
        this.setState({screen:'map', menu:null, sel:shown||S.sel,
          mapGu:(shown&&S.zgu&&S.zgu[shown])||'서울 전체'});
      },
      goFineCmp:go('fineCmp'),
      // 다시 열면 보낸 상태가 남아 있지 않게 초기화한다
      openReport:()=>this.setState({screen:'report',rp_sent:false}),
      // 헤더 오른쪽 — 언어 칩 + 설정(⚙). '어둡게' 하나만 있던 자리를 설정으로 키웠다(§44)
      ...this.settingsView(),
      q:S.q, onQ:e=>this.setState({q:e.target.value}),
      // 화면 조각(42-find.html)은 name·pick·textStyle 만 쓴다.
      chips:names.slice(0,5).map(n=>({name:this.indName(n), pick:()=>this.setState({ind:n,sel:null,picks:null,openWhy:false,fromRegion:false}),
        // 둥근 칩 대신 글자 버튼(§15) — 고른 것만 진하게
        textStyle:'flex:none;font-size:14.5px;cursor:pointer;white-space:nowrap;transition:color .14s;'
          +(n===S.ind?'color:var(--ink);font-weight:700':'color:var(--ink2)')})),
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
          +(on?'background:var(--accent);color:var(--on-accent);font-weight:600'
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
          sidoWaitTitle: this.t('mk.waitTitle',{name:this.placeName(sido)}),
          sidoWaitText: this.t('sido.waitFind',{region:this.placeName(sido)}),
          backToSeoulFind:()=>this.setState({sido:'서울특별시', findGu:''}),
          // 구는 25개라 접어 둔다. 편 상태에서는 스크롤이 생기게 높이를 묶는다.
          guToggle:()=>this.setState({findGuOpen:!S.findGuOpen}),
          guToggleLabel:this.tr(S.findGuOpen?'접기':'구 전체 보기')+' ('+gus.length+')',
          guBoxStyle:'margin-top:12px;display:grid;gap:8px;'
            // 로마자 자치구 이름은 한글보다 길다 — 최소 폭을 언어에 맞춘다.
            +'grid-template-columns:repeat(auto-fill,minmax('
            +(this.locale()==='en' ? this.L('132px','150px','160px') : this.L('92px','108px','116px'))
            +',1fr));'
            // 펼치면 스크롤이 생긴다. 스크롤 막대가 보이도록 오른쪽 여백을 둔다.
            +(S.findGuOpen? 'max-height:'+this.L('200px','240px','280px')+';overflow-y:auto;padding-right:8px' : ''),
          // 접었을 때는 앞 6개만 그린다 — 반 잘린 줄을 남기면 '아래를 못 본다'가 된다
          gu:(S.findGuOpen
                ? [{label:'전체', v:''}, ...gus.map(g=>({label:this.placeName(g), v:g}))]
                : [{label:'전체', v:''}, ...gus.map(g=>({label:this.placeName(g), v:g}))].slice(0,6)
             ).map(o=>({
            label:o.label,
            pick:()=>this.setState({findGu:o.v, sel:null}),
            style:'display:flex;align-items:center;justify-content:center;padding:11px 8px;'
              +'border-radius:var(--r-sm);font-size:13.5px;cursor:pointer;white-space:nowrap;'
              +'overflow:hidden;text-overflow:ellipsis;transition:background .14s,color .14s;'
              +(cur===o.v?'background:var(--accent-3);color:var(--accent-hover);font-weight:700'
                         :'background:var(--surface);color:var(--ink2)')})),
          hasGu: gus.length>0,
          // 고르는 칸은 접어 둔다(§35) — 화면의 주인공은 결과다.
          // 닫혀 있을 때는 지금 조건을 한 줄로만 보여준다.
          pickOpen: !!S.findPickOpen,
          pickToggle: ()=>this.setState({findPickOpen:!S.findPickOpen}),
          pickLabel: S.findPickOpen? '접기' : '바꾸기',
          summary: (cur? this.placeName(cur) : this.t('pr.seoulAll'))+' · '+this.tr(this.indName(S.ind))
        };
      })(),

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
      mapHeight:this.L('300px','360px','430px'),
      mapLoading:this.t('map.loading'),
      mapClickHint:this.t('map.clickHint'),
      footerContactLabel:this.t('footer.contact'),
      footerContactValue:this.t('footer.pending'),
      dashCols:this.L('1fr','1fr','minmax(0,.8fr) minmax(0,1fr) minmax(0,1fr)'),
      navCols:this.L('1fr','200px minmax(0,1fr)','200px minmax(0,1fr)'),
      dsCard:this.ds('card'), dsCardHi:this.ds('cardHi'),
      dsNum:this.ds('num'), dsNumSm:this.ds('numSm'),
      dsBody:this.ds('body'), dsSub:this.ds('sub'),
      dsCta:this.ds('cta'), dsGhost:this.ds('ctaGhost'), dsInput:this.ds('input'),
      dsGrid3:'display:grid;gap:'+this.L('14px','16px','20px')+';grid-template-columns:repeat(auto-fit,minmax('+this.L('100%','260px','300px')+',1fr))',
      dsGrid4:'display:grid;gap:'+this.L('12px','16px','18px')+';grid-template-columns:repeat(auto-fit,minmax('+this.L('150px','200px','220px')+',1fr))',
      dataError:S.err, retryData:()=>location.reload(),
      ...this.home(),
      ai:this.chat(),
      // 오른쪽 아래에서 접었다 폈다 — 어느 화면에서나 쓸 수 있다
      // 홈에서 지역·업종 목록이 열려 있으면 AI 도우미 버튼은 비켜 준다 — 목록 오른쪽 아래를 가린다
      botOpen:!!S.bot, botClosed:!S.bot && !S.pickOpen,
      botToggle:()=>this.setState({bot:!S.bot},()=>{ if(!S.bot) this.scrollBot(); }),
      botPanel:'position:fixed;z-index:70;display:flex;flex-direction:column;background:var(--card);'
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
        +'background:var(--card);color:var(--accent-text);border:1px solid var(--line-strong);cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.06);'
        +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
        +this.L('right:14px;bottom:calc(74px + env(safe-area-inset-bottom,0px));',
                'right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));',
                'right:28px;bottom:calc(28px + env(safe-area-inset-bottom,0px));'),
      // CTA 체계 — 주 행동 하나만 강조한다
      ctaPrimary:'font-size:16px;font-weight:600;color:var(--on-accent);background:var(--accent);border:none;border-radius:16px;padding:0 26px;height:54px;width:100%;max-width:420px;display:block;cursor:pointer;box-shadow:0 6px 16px -6px rgba(0,0,0,.18);transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1)',
      // 글자 버튼 — 보이는 크기는 그대로, 누를 칸만 44px (WCAG 2.5.5)
      ctaText:'font-size:14.5px;color:var(--accent-text);cursor:pointer;white-space:nowrap;'
        +'display:inline-flex;align-items:center;min-height:44px',
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
      out.d={eyebrow:'',headline:S.err?'데이터를 읽지 못했어요.':'불러오는 중이에요.',bep:'—',rev:'—',revName:'',gap:'',gapStyle:'display:none',fill:'display:none',mark:'display:none',factors:[],thin:'',thinStyle:'display:none',honesty:'',note:this.dataNote('bep','',[])};
      out.inputs=[]; out.scens=[]; out.scenNote=''; out.stack=[]; out.moneyRows=[]; out.stackLead='';
      out.dayStats=[]; out.dayWhy=''; out.riskStats=[]; out.riskLead='';
      out.foot={has:false,lead:'',stats:[],note:''};
      out.sat={has:false};
      out.condHint=''; out.moneyHint=''; out.dayHint=''; out.riskHint='';
      // 불러오기 실패에도 죽은 컨트롤이 남지 않도록 중립값을 채운다
      out.c={headline: S.err?'데이터를 읽지 못했어요.':'불러오는 중이에요.',
        sub: S.err? '잠시 후 다시 열어 주세요.':'', cols:[], diffs:[], honesty:'', empty:true, on:false,
        add:{q:'',onQ:()=>{},onKey:()=>{},clear:()=>{},hasQ:false,searching:false,
             found:[],hasFound:false,noResult:false,noResultText:'',
             recent:[],hasRecent:false,suggest:[],hasSuggest:false,full:false,fullText:'',
             foundRail:this.rail('cmpFound',{per:3}),recentRail:this.rail('cmpRecent',{per:3}),
             suggestRail:this.rail('cmpSug',{per:3})},
        rail:this.rail('cmpCols',{per:3}), chartRail:this.rail('cmpCh',{per:1, peek:false, arrows:true}),
        charts:[], hasCharts:false, emptyCount:'',
        verdict:'', verdictWhy:[], hasVerdict:false,
        presets:[], presetRail:this.rail('cmpPre',{per:5}),
        whyOpen:false, whyLabel:'', toggleWhy:()=>{}, why:{label:'',rows:[],how:''},
        bestName:'', bestSlotStyle:'', bestRanks:[], order:[]};
      out.area=this.size().area; out.onArea=()=>{}; out.areaLabel='—'; out.areaWord='';
      out.linked=[]; out.linkNote=''; out.moneyDots=[]; out.dotNote='';
      out.rg=this.region();
      out.mv={eyebrow:'', headline:S.err?'데이터를 읽지 못했어요.':'불러오는 중이에요.', sub:'',
        map:{ready:false,gus:[],pins:[],vb:'0 0 100 100',stroke:'0.5',legend:[],legendNote:''},
        detail:{has:false,title:'',dong:'',rows:[],facts:[],note:''},
        target:'', stamp:'', question:'', rowStyle:'', tagStyle:'',
        cards:[], cardIndex:0,
        now:{charts:[],hasCharts:false,rail:this.rail('mv',{per:1, peek:false, arrows:true}),chartNav:[],
             hasChartNav:false,chartCount:'0개',missing:[],hasMissing:false,
             title:'',q:'',big:'',bigLabel:'',verdict:'',hasVerdict:false,
             rows:[],bars:[],hasBars:false,note:'',hasNote:false,bigStyle:''},
        nav:[],
        metrics:{has:false,rows:[],seoul:[],missing:[],note:''},
        pros:{good:[],care:[]}, vs:{rows:[],note:''}, sections:[],
        guValue:'서울 전체', guOptions:[{v:'서울 전체', label:this.t('pr.seoulAll')}], onGu:()=>{},
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
for (const name of ['i18n','theme','roman','util','design','rank','analysis','data','storage','home','report','comparison','diagnosis','screens','chat','charts','carousel','market','map','views']) {
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
