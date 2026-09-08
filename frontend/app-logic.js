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
    this.placePanel();
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
        error:'공고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}}))
      .finally(()=>{this._spLoading=false;});
  }

  // 저장해 둔 설문 답을 '믿을 수 있는 값만' 골라 되살린다.
  // 이 목록이 곧 '설문이 기억하는 것'의 정의다.
  SURVEY_KEYS(){
    return ['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen',
      'rp_sido','rp_gu','rp_ind','rp_stage','rp_age','rp_biz','rp_when','rp_need',
      'rp_cost','rp_email','rp_agree','rp_step'];
  }
  surveyRestore(saved){
    const restore={};
    if(!saved || typeof saved!=='object') return restore;
    for(const k of this.SURVEY_KEYS()){
      const v=saved[k];
      if(v===null||typeof v==='string'||typeof v==='number'||typeof v==='boolean') restore[k]=v;
    }
    // 어느 칸을 직접 넣었는지도 되살린다(리포트가 '기본 가정'과 구분해 적는다)
    if(saved.rp_touched && typeof saved.rp_touched==='object'){
      const t={};
      for(const k of ['rent','area','staffOv']) if(saved.rp_touched[k]===true) t[k]=true;
      restore.rp_touched=t;
    }
    if(Array.isArray(saved.picks)) restore.picks=saved.picks.filter(v=>typeof v==='string').slice(0,5);
    return restore;
  }
  // 새로고침을 대비해 담아 둔다. 값이 그대로면 쓰지 않는다.
  saveSurvey(){
    try{
      const S=this.state, out={};
      for(const k of this.SURVEY_KEYS()) out[k]=S[k]===undefined?null:S[k];
      out.rp_touched=S.rp_touched||{};
      out.picks=S.picks||[];
      const raw=JSON.stringify(out);
      if(raw===this._surveyRaw) return;
      this._surveyRaw=raw;
      sessionStorage.setItem('mysbizon.survey', raw);
    }catch(e){}
  }

  componentWillUnmount(){
    try{ if(this._onPop) window.removeEventListener('popstate', this._onPop); }catch(e){}
    if(this._out) document.removeEventListener('click',this._out,false);
    if(this._noHover) document.removeEventListener('click',this._noHover,true);
    if(this._yesHover) document.removeEventListener('pointermove',this._yesHover,true);
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
    setTimeout(()=>{ try{ this.paintCharts(); this.bindRails(); this.trDom(); }catch(e){} },0);
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

    Promise.all([
      // 모양이 깨진 파일은 파싱은 되지만 화면이 그 자리에서 터진다(util.dataShapeOk 주석 참고).
      // 상권 파일은 모든 화면의 뿌리라 모양이 다르면 통째로 '못 불러왔어요'로 떨어뜨리고,
      // 나머지는 '없는 것'과 같게 비워 둔다 — 화면은 그 자리만 정직하게 빠진다.
      this.loadData('data/v3/zone_industry.json').then(r=>r.json())
        .then(d=>{ if(!this.dataShapeOk('zi',d)) throw new Error('zone_industry: 모양이 다름'); return d; }),
      this.loadData('data/v3/sales_by_industry.json').then(r=>r.json())
        .then(d=>this.dataShapeOk('ind',d)?d:null).catch(()=>null),
      this.loadData('data/v3/stores_by_industry.json').then(r=>r.json())
        .then(d=>this.dataShapeOk('ind',d)?d:null).catch(()=>null),
      this.loadData('data/v3/zone_gu.json').then(r=>r.json()).then(d=>this.dataShapeOk('gu',d)?d.gu:{}).catch(()=>({})),
      this.loadData('data/v3/zone_border.json').then(r=>r.json()).then(d=>(d&&d.border)||{}).catch(()=>({})),
      this.loadData('data/v3/seoul_map.json').then(r=>r.json())
        .then(d=>this.dataShapeOk('map',d)?d:null).catch(()=>null),
      this.loadData('data/v3/zone_livepop.json').then(r=>r.json()).then(d=>this.dataShapeOk('zone',d)?d.zone:{}).catch(()=>({})),
      this.loadData('zone_rent.json').then(r=>r.json()).then(d=>(d&&d.available!==false&&d.zones)||null).catch(()=>null),
      this.loadData('data/v3/rent.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/sales_history.json').then(r=>r.json())
        .then(d=>this.dataShapeOk('hist',d)?d:null).catch(()=>null),
      this.loadData('data/v3/income.json').then(r=>r.json()).catch(()=>null),
      // 상권 생존(평균 영업기간·상권변화 등급)과 닮은 상권. 둘 다 이미 수집해 둔 자료를
      // build_v3.py 가 화면에 필요한 만큼만 깎아 낸 것이다(각 10KB·12KB gzip).
      this.loadData('data/v3/zone_change.json').then(r=>r.json())
        .then(d=>(d&&typeof d==='object'&&!Array.isArray(d))?d:null).catch(()=>null),
      this.loadData('data/v3/zone_sim.json').then(r=>r.json()).then(d=>this.dataShapeOk('zone',d)?d.zone:null).catch(()=>null)
    ]).then(([zi,sbi,sti,zgu,zbd,smap,zlp,zoneRent,rent,hist,income,zchg,zsim])=>this.setState({zi,sbi,sti,zgu,zbd,smap,zoneRent,zchg,zsim,zlp:Object.fromEntries(Object.entries(zlp||{}).filter(([,v])=>v&&Number.isFinite(v.tot)&&v.tot>0&&Array.isArray(v.age)&&v.age.length===6&&v.age.every(Number.isFinite))),rentStats:rent,salesHistory:hist,income}))
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
        style:'font-size:14px;white-space:nowrap;cursor:pointer;padding:11px 10px;border-radius:9px;display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;transition:background .16s,color .16s;'
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
        {n:'1', title:'업종과 지역을 고른다', body:'첫 화면에서 장사 종류만 고르면 서울 동네가 좋은 순서로 줄 서요.'},
        {n:'2', title:'후보를 견준다',       body:'마음에 드는 곳을 담아 두면 매출·손님·경쟁으로 종합 1위를 뽑아 드려요.'},
        {n:'3', title:'내 숫자로 계산한다',   body:'평수와 임대료를 넣으면 월 얼마를 팔아야 본전인지 나와요.'}
      ],
      // 메뉴 넷 — 각각 답하는 질문 하나
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
      rp:(()=>{
        const pick=(k,v)=>()=>this.setState({['rp_'+k]:v,rp_sent:false,rp_error:''});
        const chip=(k,v)=>'flex:none;font-size:13.5px;padding:9px 14px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
          +(S['rp_'+k]===v?'background:var(--ink);color:var(--bg);font-weight:500':'background:var(--surface);color:var(--ink2)');
        const reportSelection=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)||r.list[0]):null;
        const reportZone=reportSelection?this.zoneLabelOf(reportSelection.name):this.tr('동네 미선택');
        const email=(S.rp_email||'').trim();
        const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!S.rp_agree;
        const sent=!!S.rp_sent; const sending=!!S.rp_sending; const enabled=!!S.reportEmailEnabled;
        const P=[
          ['one','선택한 동네 분석','고른 동네의 점수 근거와 본전 계산'],
          ['cmp','비교한 자리들','담아 둔 동네를 항목별로 나란히']
        ];
        // 리포트(미리보기·CSV·메일)에 넣을 지원사업 목록.
        // sp 를 그리면서 채우고, 내보내기 버튼을 눌렀을 때 buildReport 가 읽는다.
        // (sp 는 renderVals 안에서 돌고 buildReport 는 그 뒤 클릭 때 불린다.)
        let supportForReport=[];
        // 화면 맨 앞에 세운 '최대 얼마' 를 인쇄본에도 같이 적는다(같은 값, 같은 근거).
        let supportMaxForReport=null;
        const buildReport=()=>{
            // 상권을 직접 고르지 않았으면 **설문에서 답한 구** 안에서 1위를 고른다.
            // 서울 밖(부산 등)은 자료가 없어 서울 1위로 떨어진다 — 그건 아래에서 밝혀 적는다.
            const rpGu=(S.rp_sido==='서울' && S.rp_gu && S.rp_gu!=='아직 몰라요') ? S.rp_gu : '';
            const inGu=(r&&rpGu&&S.zgu) ? r.list.find(o=>S.zgu[o.id]===rpGu) : null;
            const sel=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)
                        ||inGu||r.list[0]):null;
            // 손익은 **리포트 결과물에만** 넣는다(사장님 지시 2026-09-07).
            // 리포트 화면은 설문 → 지원사업 둘뿐이고, 아래 값은 PDF·CSV·메일에서만 보인다.
            // 설문의 '가게 조건' 단계에서 받은 값을 쓰고, 비워 두셨으면 기본 가정으로 계산한다.
            // 어느 쪽인지 줄마다 적는다 — 지어낸 값과 넣으신 값이 섞이면 안 된다(§1).
            const c=sel?this.calc(sel):null;
            // 그 칸을 실제로 손댔을 때만 '직접 넣으신 값'이라고 적는다.
            const touched=S.rp_touched||{};
            const said=k=>touched[k]? '직접 넣으신 값' : '기본 가정';
            const bep=c?[
              {label:'월 본전선 (이만큼 팔면 본전)', value:this.man(c.bep), tag:'고정비 ÷ (1 − 원가율)'},
              {label:'월매출 가정 ('+S.scen+')', value:this.man(c.rev), tag:'상권 평균 추정 × '+c.mult},
              {label:'월 영업이익', value:this.man(c.profit), tag:'세금·대출 이자는 빼지 않음'},
              // 계산에 **실제로 쓴 값**을 적는다. 화면 state 를 그대로 적으면
              // 칸을 비웠을 때 '0만원' 이라고 인쇄해 놓고 계산은 400 으로 하게 된다.
              {label:'월 임대료', value:c.rent.toLocaleString()+'만원', tag:said('rent')},
              {label:'평수', value:c.area+'평', tag:said('area')},
              {label:'인건비', value:this.man(c.labor),
               tag:(touched.staffOv&&S.staffOv!=null)?'직접 넣으신 직원 수':'평수로 추정'},
              {label:'원가율', value:Math.round(c.cogs*100)+'%', tag:'기본 가정'}
            ]:null;
            if(c&&c.payback!=null) bep.push(
              {label:'회수기간', value:c.payback.toFixed(1)+'개월', tag:'초기투자 ÷ 월 영업이익'});
            const payload={
              ind:S.ind?this.tr(this.indName(S.ind)):'', zone:sel?this.zoneLabelOf(sel.name):this.tr('동네 미선택'),
              gu:sel?this.guLabel(sel.id):'',
              // 상권을 안 고르고 리포트를 받으면 앱이 골라 계산한다.
              // 그걸 '고르신 곳'처럼 적으면 지어낸 값이 된다(§1) — 리포트에 밝혀 적는다.
              zoneAuto: !(S.sel||S.zoneId),
              zoneAutoGu: (!(S.sel||S.zoneId) && inGu) ? rpGu : '',
              quarter:S.zi?this.qtr(S.zi.quarter):'',
              support:supportForReport,
              supportMax:supportMaxForReport,
              bep:bep,
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
              survey:[
                // 지역·업종은 이름이라 이어 붙이면 사전이 못 찾는다 — 조각마다 옮긴 뒤 잇는다
                ['지역',[S.rp_sido,S.rp_gu&&S.rp_gu!=='아직 몰라요'?S.rp_gu:'']
                  .filter(Boolean).map(v=>this.placeName(v)).join(' ')],
                ['업종',S.rp_ind?this.tr(this.indName(S.rp_ind)):''],
                ['창업 단계',S.rp_stage],['나이',S.rp_age],['사업자등록',S.rp_biz],
                ['개업 시기',S.rp_when],['필요한 지원',S.rp_need]
              ].filter(([,v])=>!!v).map(([label,value])=>({label,value})),
              // 비교에 담은 자리
              zones:(S.picks|| (r?r.list.slice(0,3).map(o=>o.id):[])).map(id=>r&&r.list?r.list.find(o=>o.id===id):null)
                .filter(Boolean).map(o=>({
                  name:this.zoneLabelOf(o.name), score:Math.round(o.score),
                  stores:o.stores.toLocaleString()+'곳'
                }))
            };
            if(!payload.zones.length) delete payload.zones;
            if(!payload.survey.length) delete payload.survey;
            if(!payload.support.length) delete payload.support;
            if(!payload.bep) delete payload.bep;
            if(!payload.money||!payload.money.length) delete payload.money;
            return payload;
        };
        return {
          // 담을 항목 체크박스를 없앴으니 '고른 게 0개'인 상태도 없다 — 자리만 있으면 내보낼 수 있다
          exportDisabled:!reportSelection,
          title:'분석한 내용을 정리해 드려요',
          sub:'몇 가지만 답하시면 조건에 해당할 수 있는 정부·지자체 창업지원사업을 찾아 한 장으로 묶어 드려요.',
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
            const RP_GU_NONE='아직 몰라요';
            // 이 설문의 목적은 본전 계산이 아니라 '신청할 수 있는 정부 창업지원사업'을
            // 찾아 주는 것이다. 그래서 매칭에 쓰지 않는 질문(자금·대출·버틸 기간)은 뺐다.
            // 남은 것은 전부 공고 자격 요건에 실제로 등장하는 조건이다.
            const BEPD=globalThis.MysbizonConst.BEP_DEFAULT;
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

              // ⑧ 가게 조건 — 여기만 성격이 다르다.
              //   지원사업 매칭에는 **쓰지 않는다**(공고 자격에 임대료·평수가 나오지 않는다).
              //   리포트(PDF·CSV·메일)의 손익 계산에만 쓴다. 화면에는 결과를 그리지 않는다.
              //   비워 두고 넘어갈 수 있다 — 자리를 아직 안 정한 분은 임대료를 알 수 없다.
              //   그때는 기본 가정으로 계산하고, 리포트에 '기본 가정'이라고 적는다(§1).
              {k:'cost', q:'가게 조건을 알려주시면 손익도 같이 계산해 드려요',
               hint:'리포트(PDF·메일)에만 들어가요. 모르시면 비워 두고 넘어가셔도 돼요.',
               // blank = 비웠을 때 되돌아갈 값(= 이 서비스의 기본 가정). staffOv 는 null 이면
               // 평수에서 자동으로 잡는다.
               // max 는 계산이 쓰는 상한과 같은 값이다(util.calc·size). 여기서 더 큰 값을 받으면
               // 화면에는 그 숫자가 남고 계산은 상한으로 하게 되어, 넣은 값과 결과가 어긋난다.
               nums:[{label:'월 임대료 (만원)', key:'rent',    value:S.rent,    blank:BEPD.rent, max:100000},
                     {label:'평수 (평)',        key:'area',    value:S.area,    blank:BEPD.area, max:1000},
                     {label:'직원 수 (명)',     key:'staffOv', value:S.staffOv, blank:null,      max:100}],
               opts:[], val:S.rp_cost},

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
              +(on?'background:var(--accent-3);color:var(--accent-hover);font-weight:600'
                 :'background:var(--surface);color:var(--ink)');
            // 지역·업종처럼 항목이 많은 단계는 격자로 깐다 — 세로로 세우면 버튼 벽이 된다(§29)
            const optStyleGrid=on=>'display:flex;align-items:center;justify-content:center;'
              +'padding:13px 10px;border-radius:12px;cursor:pointer;min-width:0;'
              +'font-size:14.5px;line-height:1.3;text-align:center;white-space:nowrap;'
              +'overflow:hidden;text-overflow:ellipsis;transition:background .14s,color .14s;'
              +(on?'background:var(--accent-3);color:var(--accent-hover);font-weight:700'
                 :'background:var(--surface);color:var(--ink)');

            // 요약에 적을 말. 상권 단계는 코드(3001496)가 아니라 동네 이름으로 적는다.
            const shown=(v,isZone)=>Array.isArray(v)
              ? (v.length? v.map(nameOf).join(' · ') : '없음')
              : (v? (isZone? nameOf(v) : v) : '건너뜀');

            return {
              qsStep: cur? (step+1)+' / '+N : '',
              hasStep: !!cur,
              qsBar:'display:block;height:100%;border-radius:2px;background:var(--accent);'
                // 옆 글자가 '1 / 9' 인데 막대는 step/N 이라 첫 질문에서 0% 였다 — 글자와 맞춘다
                +'transition:width .3s cubic-bezier(.22,.7,.25,1);width:'+Math.round((step+1)/N*100)+'%',

              hasCur: !!cur,
              curQ: cur?cur.q:'',
              curHint: cur?cur.hint:'',
              // 구 25개·동네 99개를 버튼으로 늘어놓으면 화면이 버튼 벽이 된다.
              // 치는 대로 걸러 6개만 보여준다. '강'만 쳐도 강남구·강동구가 뜬다.
              // 후보가 0개면 목록 칸 자체를 안 그린다 — 안 그러면 빈 여백만 22px 뜬다
              hasOpts: visible.length>0 && !(cur&&cur.grid),
              // 격자로 그릴지, 한 줄씩 그릴지
              hasGridOpts: visible.length>0 && !!(cur&&cur.grid),
              // 칸 수는 언어를 따른다. 로마자 표기는 한글보다 두 배쯤 길어서
              // 3칸으로 두면 영어 화면에서 자치구 17개 중 15개가 말줄임으로 잘린다.
              optsGridStyle:'display:grid;gap:8px;margin-top:22px;'
                +'grid-template-columns:repeat('
                +(this.locale()==='en' ? this.L(2,3,3) : this.L(3,4,4))
                +',minmax(0,1fr))',
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
              searchEmptyText: q? this.tn('search.noHit',{q:q}) : '',
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

              // 가게 조건 단계 — 숫자 칸 셋. 비워도 넘어간다(그러면 기본 가정으로 계산한다).
              isNums: !!(cur&&cur.nums),
              numFields: (cur&&cur.nums||[]).map(f=>({
                label:f.label,
                value:(f.value==null?'':String(f.value)),
                // 숫자만 받는다.
                //   비우면 '안 넣음'으로 되돌린다 — 값도 기본으로, 표시도 '기본 가정'으로.
                //   (비운 걸 0 으로 두면 임대료 0원·평수 1평으로 계산돼 본전선이 통째로 어긋난다.)
                //   어느 칸을 실제로 손댔는지 기억한다 — 임대료·평수는 기본값(400·15)이 미리 들어
                //   있어서, 그냥 넘긴 값을 리포트에 '직접 넣으신 값'이라고 적으면 거짓말이 된다(§1).
                onChange:e=>{ const raw=String(e.target.value||'').replace(/[^0-9]/g,'').slice(0,7);
                  const t={...(S.rp_touched||{})};
                  if(raw===''){ delete t[f.key]; }
                  else t[f.key]=true;
                  this.setState({[f.key]: raw===''? f.blank : Math.min(Number(raw), f.max),
                                 rp_sent:false, rp_touched:t}); },
                style:'width:100%;font-size:16px;font-weight:500;color:var(--ink);background:var(--surface);'
                  +'border:none;border-radius:14px;padding:0 16px;height:52px;outline:none'
              })),
              numsNext: ()=>this.setState({rp_cost:'입력함', rp_step:step+1, rp_q:'', rp_sent:false}),
              numsLabel:'다음',
              numsNextStyle:'width:100%;margin-top:18px;font-size:15.5px;font-weight:600;border:none;'
                +'border-radius:14px;height:50px;cursor:pointer;transition:filter .16s;'
                +'background:var(--accent);color:var(--on-accent)',

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
                +'background:var(--accent);color:var(--on-accent)',
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
              // 공고 목록은 '가게 조건'·'이메일' 뒤에 숨어 있었다. 두 단계는 공고 매칭에
              // 쓰지 않는데도(임대료·평수·직원 수·이메일은 자격 요건에 안 나온다),
              // 이메일을 안 남기면 설문의 결론을 영영 못 보게 돼 있었다.
              spReady: !cur || cur.k==='email' || cur.k==='cost',
              // 다 답한 뒤엔 카드가 사라진다. 답을 다시 볼 수 있게 한 줄만 남긴다.
              // 이어 붙인 뒤에는 사전이 못 찾는다 — 조각마다 옮긴 뒤 잇는다.
              // '가게 조건'은 숫자라 요약에 넣지 않는다('입력함'은 사장님께 아무 뜻이 없다).
              doneLine: STEPS.map(st=>{
                  if(st.k==='cost') return '';
                  const v=shown(st.val, st.isZone);
                  return st.k==='ind'? (st.val? this.indName(st.val) : '') : v;
                }).filter(v=>v&&v!=='건너뜀'&&v!=='없음').map(v=>this.tr(v)).join(' · '),
              editAgain: ()=>this.setState({rp_step:0, rp_q:''})
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
            +((ok&&!sent)?'cursor:pointer;background:var(--accent);color:var(--on-accent)'
              :(sent?'cursor:default;background:var(--good);color:var(--on-good)'
                :'cursor:pointer;background:var(--accent-3);color:var(--accent-hover)')),
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
            const guNow=(S.rp_gu && S.rp_gu!=='아직 몰라요')? S.rp_gu : '';
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
                    // 어두운 화면의 빨강(#FF6B60)에 흰 글자를 얹으면 2.79:1 이라 AA(4.5) 미달이다.
                    :(soon?'background:var(--err);color:var(--on-err)':'background:var(--accent-3);color:var(--accent-hover)')),
                period:[it.start,it.deadline].filter(Boolean).join(' ~ ')||'',
                hasPeriod:!!(it.start||it.deadline),
                why:o.why.map(w=>({text:w})),
                hasWhy:o.why.length>0,
                url:it.url||'', hasUrl:!!it.url,
                // 아래 '조건에 걸리지 않은 공고' 격자에서는 카드 높이를 맞춘다
                style:'display:flex;flex-direction:column;gap:0;padding:22px;border-radius:var(--r-lg);height:100%;'
                  +'background:var(--bg);border:1px solid '+(soon?'var(--accent-2)':'var(--line)')
                  +';min-width:0'
              };
            };
            const top=matched.filter(o=>{ const dd=ddOf(o.it); return horizon==null||dd==null||dd<=horizon; });
            const shownList=(top.length?top:matched).slice(0,12);
            const list=shownList.map(card);
            // 화면에 뜬 그대로를 리포트(미리보기·CSV·메일)에도 담는다 — 다시 고르지 않는다.
            supportForReport=shownList.map(o=>({
              title:o.it.title||'',
              org:o.it.org||'',
              amount:o.it.amount||'',
              period:[o.it.start,o.it.deadline].filter(Boolean).join(' ~ '),
              // 이어 붙인 뒤에는 사전이 통째로는 못 찾는다 — 조각마다 옮긴 뒤 잇는다
              why:o.why.map(w=>this.tr(w)).join(' · '),
              url:o.it.url||''
            }));
            const nearest=(top.length?top:matched).map(o=>ddOf(o.it)).filter(v=>v!=null).sort((a,b)=>a-b)[0];

            // ── '최대 얼마까지' ────────────────────────────────────────
            // 화면에 뜬 공고들의 금액 글자에서 숫자를 읽어 가장 큰 값을 앞에 세운다.
            // 읽어낸 게 하나도 없으면 이 줄은 아예 안 나온다 — 없는 값을 지어내지 않는다(§1).
            // 자격을 판정한 값이 아니다(§17). 그래서 어느 공고의 금액인지 이름을 같이 적는다.
            let maxOf=null;
            shownList.forEach(o=>{
              const v=this.wonParse(o.it.amount);
              if(v!=null && (maxOf==null||v>maxOf.v)) maxOf={v:v, title:o.it.title||''};
            });
            supportMaxForReport = maxOf? {amount:this.won(maxOf.v), title:maxOf.title} : null;

            return {
              loading:!d,
              notConfigured:!!d&&d.configured===false,
              failed:!!d&&d.configured!==false&&!d.ok,
              ready:!!d&&!!d.ok,
              // 사용자용 문구만. 환경변수 이름 같은 개발자 메시지는 내보내지 않는다.
              message: (!!d&&d.configured===false)
                ? '지원사업 정보를 준비 중이에요. 준비되면 이 자리에 신청할 수 있는 공고가 떠요.'
                : '지원사업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
              retry:()=>{this._spLoading=false;this.setState({sp:null});},
              countLabel:list.length+'개',
              nearest: nearest==null? '—' : (nearest===0?'오늘':'D-'+nearest),
              hasNearest: nearest!=null,
              hasMax: !!maxOf,
              maxAmount: maxOf? this.wonMax(maxOf.v) : '',
              maxFrom: maxOf? maxOf.title : '',
              items:list,
              hasItems:list.length>0,
              empty:!!d&&!!d.ok&&all.length===0,
              noMatch:!!d&&!!d.ok&&all.length>0&&list.length===0,
              hasRest:rest.length>0,
              rest:rest.slice(0,20).map(card),
              restLabel:'조건에 걸리지 않은 공고 '+rest.length+'개도 보기',
              showRest:!!S.spRest,
              toggleRest:()=>this.setState({spRest:!S.spRest}),
              // 세 조각을 이어 붙인 뒤에는 사전이 통째로는 못 찾는다 — 조각마다 옮긴 뒤 잇는다.
              warn:[
                this.tr('자격을 판정한 목록이 아니에요. 실제 신청 자격은 업력·매출·지역·업종·소상공인 여부에 따라 달라요. '
                  +'여기 있는 건 답하신 조건과 겹치는 공고이고, 신청 가능 여부는 반드시 원문에서 확인해 주세요.'),
                (d&&d.undated)? this.tr('마감일을 읽지 못한 공고 '+d.undated+'개가 섞여 있어요(상시 모집일 수 있어요).') : '',
                (d&&d.expired)? this.tr('마감이 지난 '+d.expired+'개는 뺐어요.') : ''
              ].filter(Boolean).join(' ')
            };
          })(),

          // 엑셀에서 바로 열리는 CSV. 서버 없이 지금 화면의 값만 담는다.
          csv:()=>{
            
            const p=buildReport();
            const rows=[['항목','값','비고'],
              ['기준 분기',S.zi?this.qtr(S.zi.quarter):'','원자료 기준'],
              ['장사',p.ind,''],
              // 인쇄본과 같은 안내를 CSV 에도 남긴다 — 고른 적 없는 상권이면 그렇다고 적는다(§1)
              // 이름이 문장 가운데 들어가면 통째로는 사전에서 못 찾는다 — 자리표시자로 옮긴 뒤 끼운다
              ['동네',p.zone, p.zoneAuto? this.tr('직접 고른 상권이 아니라 {0} 이 업종 1위 상권')
                .split('{0}').join(this.placeName(p.zoneAutoGu||'서울')) : ''],
              ...(p.survey||[]).map(x=>[x.label,x.value,'설문 답']),
              ...(p.support||[]).map(x=>[x.title,[x.amount,x.period].filter(Boolean).join(' · '),
                                         [x.org,x.why,x.url].filter(Boolean).join(' · ')]),
              ...(p.bep||[]).map(x=>[x.label,x.value,x.tag]),
              ...(p.zones||[]).map(x=>[x.name,x.score+'점','비교 후보'])];
            const q=v=>{let t=String(v==null?'':v);if(/^[\s]*[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
            // 화면은 영어인데 받은 파일만 한국어면 쓸 수 없다. 화면과 같은 표(@phrases)로 옮긴다 —
            // 공고 제목·기관명·상권 이름 같은 고유명사는 표에 없어 원문 그대로 남는다(그게 맞다).
            const body=rows.map(r=>r.map(v=>q(this.tr(String(v==null?'':v)))).join(',')).join('\r\n');
            // 엑셀이 한글을 깨지 않게 BOM을 붙인다
            const blob=new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'});
            const a=document.createElement('a');
            a.href=URL.createObjectURL(blob);
            // 파일 이름에 한글을 넣으면 **크로미움이 이름을 통째로 버린다** —
            // 확장자 없는 'download' 로 저장돼 엑셀이 더블클릭으로 못 연다(재현 확인).
            // 로마자로 옮기고 ASCII 만 남긴다. 날짜를 붙여 여러 번 받아도 안 겹친다.
            const asciiName=t=>String(t||'').replace(/[^\x20-\x7E]/g,'').trim()
              .replace(/\s+/g,'-').replace(/[^A-Za-z0-9._-]/g,'').replace(/-{2,}/g,'-').slice(0,40);
            const zoneName=asciiName(this.romanizeName(S.homeZoneName||''))||'Seoul';
            const indName =asciiName(this.romanizeName(S.ind?this.indName(S.ind):''));
            const day=new Date().toISOString().slice(0,10);
            a.download=['MYSBIZON',zoneName,indName,day].filter(Boolean).join('_')+'.csv';
            document.body.appendChild(a); a.click();
            setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
          },
          // 리포트에는 본전 계산을 넣지 않는다(사장님 지시 2026-09-07).
          // 리포트 탭은 설문 → 찾은 지원사업, 딱 둘이다. 본전 계산은 ② 정밀분석 안에 따로 있다.
          // 여기 있던 rv(화면 안 본전 리포트) 블록은 어느 조각도 참조하지 않는 죽은 코드라 지웠다.
          // 인쇄본으로 넘어가기 전에 지금 상태를 담아 둔다.
          // 설문 답(rp_*)도 같이 담아야 '돌아가기' 로 왔을 때 다시 안 물어본다.
          preview:()=>{try{
            // 인쇄본도 화면과 같은 언어로 나가야 한다 — 담기 전에 한 번 옮긴다.
            // 한국어면 trDeep 이 아무 일도 하지 않는다.
            const payload=this.trDeep(buildReport());
            sessionStorage.setItem('mysbizon.report',JSON.stringify(payload));
            const restore=Object.fromEntries(
              ['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen','picks',
               'rp_sido','rp_gu','rp_ind','rp_stage','rp_age','rp_biz','rp_when','rp_need',
               'rp_cost','rp_email','rp_agree','rp_step','rp_touched'].map(k=>[k,S[k]]));
            sessionStorage.setItem('mysbizon.return',JSON.stringify(restore));
            location.href='report-print.html';
          }catch{this.setState({rp_error:'브라우저 저장 공간을 쓸 수 없어요. CSV 저장을 이용해 주세요.'});}},
          submit:async()=>{
            if(!enabled||!ok||sent||sending||this._reportSending)return;
            this._reportSending=true;
            this.setState({rp_sending:true,rp_error:''});
            try {
              // 메일도 화면과 같은 언어로 나간다(한국어면 trDeep 이 아무 일도 하지 않는다)
              const p=this.trDeep(buildReport());
              // 지원사업이 먼저고 손익이 그 다음이다 — 화면과 같은 순서로 담는다.
              const body=JSON.stringify({email,agreed:S.rp_agree===true,headline:this.tr('창업 지원사업 리포트'),sub:p.zone+' · '+p.ind,
                facts:[...(p.support||[]).map(x=>({label:x.title, value:[x.amount,x.period].filter(Boolean).join(' · '), tag:x.org})),
                       ...(p.bep||[])],
                survey:p.survey||[],zones:(p.zones||[]).map(z=>({name:z.name,value:z.score+'점'})),
                honesty:this.tr('지원사업은 자격을 판정한 목록이 아니에요 — 답하신 조건과 겹치는 공고라, 신청 가능 여부는 공고 원문에서 확인해 주세요. 손익은 상권 집계에서 계산한 추정치이고, 넣어 주신 조건은 서버에서 다시 검증하지 않았어요.')});
              if(this._reportBody!==body){this._reportBody=body;this._reportKey=crypto.randomUUID();}
              const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':this._reportKey},body,signal:AbortSignal.timeout(15000)});
              const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'발송하지 못했어요.');
              this.setState({rp_sent:true});
            }catch(e){this.setState({rp_error:e.name==='TimeoutError'?'응답을 확인하는 데 시간이 너무 걸렸어요. 수신함을 확인한 뒤 다시 시도해 주세요.':e.message});}
            finally{this._reportSending=false;this.setState({rp_sending:false});}
          },
          note:S.rp_error||(sent?'메일 서비스에 발송을 요청했어요. 스팸함도 확인해 주세요.':!enabled?'현재는 미리보기와 CSV 저장을 이용할 수 있어요. 이메일 발송은 준비가 끝나면 열어 드릴게요.':'이메일은 요청하신 리포트 발송에만 써요. 매출 추정치와 직접 넣으신 조건은 구분해서 담아요.')
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
      sidoNote:this.t('sido.notYet',{sido:this.placeName(S.sido||'서울특별시')}),
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
            style:'display:inline-flex;align-items:baseline;gap:6px;padding:7px 12px;border-radius:999px;'
              +'background:var(--surface);white-space:nowrap;min-width:0'})),
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
                    peekStyle: peek ? 'font-weight:600;color:var(--accent-text)' : 'color:var(--ink2)',
                    style:this.ds('cta')+';display:inline-flex;align-items:center;justify-content:center;'
                      +'gap:8px;'+this.L('width:100%','','')+';max-width:100%',
                    go:()=>this.setState({screen:next,menu:null})};
          })(),
          // 나머지는 한 줄짜리 목록. 카드 셋을 나란히 두면 무게가 같아져 강조가 사라진다.
          rest:(g?g.items:[]).filter(([key])=>key!==next).map(([key,label])=>{
            const c=CARD[key]||{d:''};
            return {
              label:label, sub:c.d,
              go:()=>this.setState({screen:key,menu:null}),
              row:'display:flex;align-items:center;gap:14px;padding:'+this.L('15px 0','16px 0','17px 0')
                +';border-top:1px solid var(--line);cursor:pointer;min-width:0',
              labelStyle:'flex:0 0 auto;font-size:16px;font-weight:600;letter-spacing:-.01em;white-space:nowrap',
              // 모바일에서는 설명을 접는다 — 칸이 좁아 어차피 말줄임으로 잘린다.
              subStyle:this.bp()==='mobile' ? 'display:none'
                : 'flex:1 1 auto;min-width:0;font-size:13.5px;color:var(--ink3);'
                  +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
              spacerStyle:this.bp()==='mobile' ? 'flex:1 1 auto' : 'display:none'
            };
          })
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
        +'background:var(--bg);color:var(--accent-text);border:1px solid var(--line-strong);cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.06);'
        +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
        +this.L('right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));',
                'right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));',
                'right:28px;bottom:calc(28px + env(safe-area-inset-bottom,0px));'),
      // CTA 체계 — 주 행동 하나만 강조한다
      ctaPrimary:'font-size:16px;font-weight:600;color:var(--on-accent);background:var(--accent);border:none;border-radius:16px;padding:0 26px;height:54px;cursor:pointer;box-shadow:0 6px 16px -6px rgba(0,0,0,.18);transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1)',
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
