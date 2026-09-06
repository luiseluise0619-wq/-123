'use strict';
globalThis.MysbizonLogic = function(DCLogic, React) {

class Component extends DCLogic {
  state = {
    zi:null, sbi:null, sti:null, rentStats:null, salesHistory:null, hist:[], err:'',
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
    // 히어로가 검색줄을 화면 한참 아래로 밀어 놓는다. 그 자리에서 목록을 열면
    // 아래에 남은 자리가 100~200px 뿐이라 두 줄쯤 보이고 잘린다 — 고장난 것처럼 보인다.
    // 그래서 '갓 열렸는데 아래가 좁으면' 검색줄을 화면 위쪽으로 올려 자리를 만든다.
    // 한 번만 한다(_panelOpen) — 매 렌더마다 스크롤하면 사용자가 스크롤을 못 한다.
    if(!this._panelOpen){
      this._panelOpen=true;
      const room=window.innerHeight-bounds.bottom;
      if(room<340){
        const reduce=typeof matchMedia==='function'
          && matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({top:Math.max(0,window.scrollY+bounds.top-110),
                         behavior:reduce?'auto':'smooth'});
        clearTimeout(this._panelT);
        this._panelT=setTimeout(()=>this.placePanel(), 360);   // 스크롤이 멈춘 뒤 다시 잰다
      }
    }
    // 예전에는 top:calc(100% + 8px) 였다. 그 100% 는 패널의 기준 상자(offsetParent) 높이인데
    // 그 상자가 검색창보다 훨씬 커서 목록이 입력칸에서 174px 나 떨어져 떴다.
    // 입력칸에 붙어야 '이 칸의 후보'로 읽힌다 → 기준 상자 대비 실제 위치를 재서 붙인다.
    const base=panel.offsetParent||panel.parentElement;
    const br=base?base.getBoundingClientRect():{top:0,left:0};
    Object.assign(panel.style,{
      left:Math.round(bounds.left-br.left)+'px',
      top:Math.round(bounds.bottom-br.top+6)+'px',
      width:Math.round(bounds.width)+'px',
      // 화면 아래 끝까지 쓴다 — 남기는 여백을 줄일수록 목록이 더 많이 보인다
      maxHeight:Math.max(120,window.innerHeight-bounds.bottom-14)+'px',
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
    if(this._screen!==this.state.screen){this._screen=this.state.screen;window.scrollTo({top:0,behavior:'auto'});}
    if(this.state.screen==='report') this.loadSupport();
    this.placePanel();this.syncTrack();
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
    clearTimeout(this._sc);clearTimeout(this._autoT);clearTimeout(this._panelT);this._dragCleanup?.();
  }

  // 미디어 쿼리를 쓸 수 없으므로 폭을 재서 분기한다
  bp(){
    const w=this.state.vw||(typeof window!=='undefined'?window.innerWidth:1200);
    return w<600?'mobile':(w<1024?'tablet':'desktop');
  }
  L(mobile,tablet,desktop){
    const b=this.bp();
    return b==='mobile'?mobile:(b==='tablet'?tablet:desktop);
  }

  componentDidMount(){
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
      this.loadData('data/v3/rent.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/sales_history.json').then(r=>r.json()).catch(()=>null),
      this.loadData('data/v3/income.json').then(r=>r.json()).catch(()=>null)
    ]).then(([zi,sbi,sti,zgu,zbd,smap,zlp,rent,hist,income])=>this.setState({zi,sbi,sti,zgu,zbd,smap,zlp:Object.fromEntries(Object.entries(zlp||{}).filter(([,v])=>v&&Number.isFinite(v.tot)&&v.tot>0&&Array.isArray(v.age)&&v.age.length===6&&v.age.every(Number.isFinite))),rentStats:rent,salesHistory:hist,income}))
      .catch(()=>this.setState({err:'분석 자료를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'}));
    try{ const r=JSON.parse(localStorage.getItem('mysbizon.recentZones')||'[]');
      if(Array.isArray(r)&&r.length) this.setState({recent:r}); }catch(e){}
  }

  loadData(url){return fetch(url,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error('Data unavailable');return r;});}
  fmt(v){ if(v==null||!isFinite(v)) return '—';
    if(v>=1e8) return (v/1e8).toFixed(v>=1e9?0:1)+'억';
    return Math.round(v/1e4).toLocaleString()+'만'; }
  man(v){ if(v==null||!isFinite(v)) return '—';
    const s=v<0?'−':'', a=Math.abs(v);
    if(a>=10000) return s+(a/10000).toFixed(a>=100000?0:1)+'억원';
    return s+Math.round(a).toLocaleString()+'만원'; }
  qtr(q){ const s=String(q||''); return s.length===5? s.slice(0,4)+'년 '+s.slice(4)+'분기':s; }

  rank(){
    const {zi,ind}=this.state;
    if(!zi||!ind||!Array.isArray(zi.inds)||!zi.zones) return null;
    if(this._rankCache?.zi===zi&&this._rankCache.ind===ind)return this._rankCache.value;
    const i=zi.inds.indexOf(ind);
    if(i<0) return null;
    const L=[];
    for(const k in zi.zones){
      const z=zi.zones[k], row=(z.rows||[]).find(r=>r[0]===i);
      if(!row||![row[1],row[2]].every(v=>Number.isFinite(v)&&v>0)) continue;
      L.push({id:k,name:z.nm,stores:row[1],sales:row[2],unit:Number.isFinite(row[3])&&row[3]>=0?row[3]:0,per:row[2]/row[1]});
    }
    if(!L.length) return null;
    const pct=(key,inv)=>{ const sorted=[...L].sort((a,b)=>a[key]-b[key]), n=sorted.length;
      for(let start=0;start<n;){let end=start;while(end+1<n&&sorted[end+1][key]===sorted[start][key])end++;
        const value=n===1?50:((start+end)/2)/(n-1)*100;
        for(let j=start;j<=end;j++)sorted[j]['_'+key]=inv?100-value:value;start=end+1;}
    };
    pct('sales',false); pct('stores',true); pct('per',false);
    L.forEach(o=>{ o.c1=o._sales*0.45; o.c2=o._stores*0.35; o.c3=o._per*0.20; o.score=o.c1+o.c2+o.c3; });
    const thin=o=>o.stores<=5?1:0;
    L.sort((a,b)=>(thin(a)-thin(b))||(b.score-a.score));
    const value={list:L,covered:L.length,total:zi.n_zones,quarter:zi.quarter,updated:zi.updated};
    this._rankCache={zi,ind,value};return value;
  }

  // 평수 하나로 직원 수와 운영비가 같이 움직인다.
  // 기준: 10평당 1명, 평당 6만원 — 우리가 정한 값이고 공표 통계가 아니다.
  // 임대료는 상권별 평당 시세가 공개되지 않아 연동하지 않는다(직접 입력).
  bound(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;}
  size(){
    const S=this.state, a=this.bound(S.area,1,1000,15);
    return {
      area:a,
      staff: S.staffOv!=null? Math.round(this.bound(S.staffOv,0,100,0)) : Math.max(Math.round(a/10),1),
      etc: S.etcOv!=null? this.bound(S.etcOv,0,100000,0) : Math.round(a*6),
      staffAuto: S.staffOv==null, etcAuto: S.etcOv==null
    };
  }

  // 만원 단위. 본전 = 고정비 ÷ (1 − 원가율)
  calc(z){
    const S=this.state, sz=this.size();
    const rent=this.bound(S.rent,0,100000,0), etc=sz.etc, staff=sz.staff;
    const cogs=this.bound(S.cogs,0,95,30)/100;
    const labor=staff*250, fixed=rent+labor+etc, bep=fixed/(1-cogs);
    const mult=(S.scen==='적게 팔릴 때'?0.7:(S.scen==='잘될 때'?1.3:1));
    const avg=z? z.per/3/1e4 : 0;
    const rev = avg*mult;
    return {rent,etc,staff,labor,cogs,fixed,bep,avg,rev,mult,area:sz.area,
      staffAuto:sz.staffAuto, etcAuto:sz.etcAuto,
      profit:rev*(1-cogs)-fixed};
  }

  // Lucide 아이콘 (lucide-icons/lucide@main, ISC). 텍스트 글리프(✕, ›) 대신 쓴다.
  ui(name){
    const I={
      search:[{d:'m21 21-4.34-4.34'},{c:[11,11,8]}],
      x:[{d:'M18 6 6 18'},{d:'m6 6 12 12'}],
      chevronDown:[{d:'m6 9 6 6 6-6'}],
      chevronRight:[{d:'m9 18 6-6-6-6'}],
      mapPin:[{d:'M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0'},{c:[12,10,3]}],
      arrowLeft:[{d:'m12 19-7-7 7-7'},{d:'M19 12H5'}],
      arrowRight:[{d:'M5 12h14'},{d:'m12 5 7 7-7 7'}],
      loader:[{d:'M21 12a9 9 0 1 1-6.219-8.56'}],
      up:[{d:'M16 7h6v6'},{d:'m22 7-8.5 8.5-5-5L2 17'}],
      down:[{d:'M16 17h6v-6'},{d:'m22 17-8.5-8.5-5 5L2 7'}]
    };
    return (I[name]||[]).map(p=>({d:p.d||'', cx:p.c?p.c[0]:null, cy:p.c?p.c[1]:null, r:p.c?p.c[2]:null, isCircle:!!p.c}));
  }

  // 업로드된 Lucide 선 아이콘 6종 — 건물 블록 대신 실제 건물 형태로 쓴다
  icon(name){
    const P={
      building:['M12 10h.01','M12 14h.01','M12 6h.01','M16 10h.01','M16 14h.01','M16 6h.01','M8 10h.01','M8 14h.01','M8 6h.01','M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3'],
      building2:['M10 12h4','M10 8h4','M14 21v-3a2 2 0 0 0-4 0v3','M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2','M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16'],
      hospital:['M12 7v4','M14 21v-3a2 2 0 0 0-4 0v3','M14 9h-4','M18 11h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h2','M18 21V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16'],
      hotel:['M10 22v-6.57','M12 11h.01','M12 7h.01','M14 15.43V22','M15 16a5 5 0 0 0-6 0','M16 11h.01','M16 7h.01','M8 11h.01','M8 7h.01'],
      house:['M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8','M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
      store:['M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5','M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244','M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05']
    };
    const RECT={building:1,hotel:1};
    return {paths:P[name]||[], rect:!!RECT[name]};
  }

  // 살아 움직이는 도시. 좌표·박자는 고정 배열이라 리렌더에도 흔들리지 않는다.
  // 화면 가운데(제목·검색창)를 비우도록 좌표를 좌우·상하 가장자리에만 둔다.
  graphic(){
    const picking=!!this.state.picking;
    // [x, y, size(px), duration, delay, 아이콘]
    // 아래쪽 스카이라인 — 바닥선(bottom 19%)에 밑을 맞춰 한 줄로 선다
    // [x%, 아이콘 크기(px), duration, delay, 아이콘] — 바닥선에 밑을 맞춰 선다
    // 8개만 세운다. 15개는 820px 줄에 들어가지 않아 양끝이 잘렸다.
    // delay는 이웃끼리 최소 4초 이상 벌려, 붙은 두 칸이 동시에 비지 않게 한다.
    // 배경 건물 아이콘은 뺐다(2026-09-05). 제목·검색창과 시선을 다투기만 했고,
    // 하이드레이션 전에 자리표시자가 SVG 속성으로 새어 콘솔 오류 35건을 만들고 있었다.
    // 목록을 비우면 blocks 가 빈 배열이 되어 아무것도 그리지 않는다.
    const ALL=[];
    // 좁은 화면에서는 개수를 줄이고 크기도 낮춘다
    const n=this.L(4,6,8), sc=this.L(0.72,0.86,1);
    const B=ALL.slice(0,n).map(a=>[a[0],Math.round(a[1]*sc),a[2],a[3],a[4]]);
    // 뜻 없는 장식 점은 뺐다. 남긴 것은 도시 형태와 바닥선뿐.
    const D=[];
    const DR=['driftA','driftB','driftC'];
    return {
      // 파란 영역은 '고른 지역'을 뜻할 때만 나타난다. 평소에는 없다.
      areaStyle:'position:absolute;left:50%;top:36%;width:min(760px,120%);height:520px;transform:translate(-50%,-50%);border-radius:50%;'
        +'background:radial-gradient(closest-side,rgba(22,124,104,'+(picking?'.14':'.05')+'),transparent 72%);'
        +'transition:opacity .7s cubic-bezier(.22,.7,.25,1)',
      // 채워진 기하 블록. 선 아이콘은 배경에서 시선을 끌어 제목과 경쟁한다.
      // flex 한 줄에 세운다 — 간격은 gap이 맡고, 크기 차이가 간격을 흔들지 않는다
      blocks:B.map(([x,size,dur,del,name])=>{
        const ic=this.icon(name);
        void x;
        return {
          style:'flex:0 1 auto;width:'+size+'px;height:'+size+'px;min-width:0;'
            +'color:var(--line-strong);'
            // 음수 delay — 첫 페인트부터 주기 중간에서 시작하므로 빈 스카이라인이 없다
            +'transform-origin:bottom;opacity:.22;will-change:transform,opacity;animation:buildLoop '+dur+'s cubic-bezier(.33,.7,.3,1) -'+del+'s infinite',
          paths:ic.paths.map(d=>({d:d})), rect:ic.rect
        };
      }),
      dots:D.map(([x,y,v],i)=>{
        const core=i%3===0;
        return {
          wrap:'position:absolute;left:'+x+'%;bottom:'+y+'%;will-change:transform;animation:'+DR[(v-1)%3]+' '+(16+i%5*3)+'s ease-in-out '+(i*0.6).toFixed(1)+'s infinite',
          style:'width:'+(core?7:5)+'px;height:'+(core?7:5)+'px;border-radius:50%;background:'+(core?'var(--accent)':'var(--ink3)')+';opacity:0;will-change:transform,opacity;animation:dotLoop '+(9+i%4*2.5)+'s ease-in-out '+(i*0.8).toFixed(1)+'s infinite'
        };
      })
    };
  }

  home(){
    const S=this.state, g=this.graphic();
    // 원자료의 골목상권 이름에는 주민센터·은행지점·학교 같은 POI가 섞여 있다.
    // 지역을 찾는 사람에게 학교나 은행을 보여주지 않도록 걸러낸다.
    const POI=/주민센터|지점|초등학교|중학교|고등학교|중부중|병원|우체국|파출소|지구대|시장\)|아파트|교회|성당|역\d|출구/;
    const POP_Z=['강남역','홍대입구','성수','연남','을지로','서울대입구','가로수길','건대입구'];
    const POP=['한식음식점','커피-음료','치킨전문점','미용실','편의점','호프-간이주점','분식전문점','일반의원','제과점','일반교습학원'];
    const q=(S.zq||'').trim();
    // 목록 각 줄에 판단 근거를 붙인다 — 이름만으로는 고를 수 없다
    // 경계에 걸친 상권은 두 구를 함께 쓴다 (강남역은 강남대로 서쪽이라 서초구다)
    const guOf=id=>{
      const own=(S.zgu&&S.zgu[id])||'';
      const b=S.zbd&&S.zbd[id];
      return (own&&b&&b[1])? own+'·'+b[1]+' 경계' : own;
    };
    const meta=id=>{
      if(!S.zi||!S.zi.zones[id]) return '';
      const rows=(S.zi.zones[id].rows||[]).filter(r=>r[1]&&r[2]);
      const g=guOf(id);
      // 가게 개수는 고를 때 쓰지 않는다 — 자치구만 남긴다
      return g || (rows.length? '' : '데이터 없음');
    };
    let list=[], heading='', empty=false, emptyText='';
    if(S.zi){
      const names=[];
      for(const k in S.zi.zones){ const z=S.zi.zones[k]; names.push({id:k,name:z.nm}); }
      if(q){
        const hit=names.filter(z=>z.name.indexOf(q)>=0);
        // 검색은 사용자가 직접 친 말이므로 POI도 남기되 뒤로 보낸다
        list=hit.filter(z=>!POI.test(z.name)).concat(hit.filter(z=>POI.test(z.name))).slice(0,40);
        heading=list.length? '검색 결과 '+list.length+'곳' : '';
        empty=!list.length; emptyText='‘'+q+'’와 맞는 동네가 없어요';
      } else {
        const recent=(S.recent||[]);
        if(recent.length){
          heading='최근 본 지역';
          list=recent.map(nm=>names.find(z=>z.name===nm)).filter(Boolean).slice(0,4);
        }
        if(!list.length){
          heading='많이 찾는 지역';
          POP.forEach(p=>{
            const hit=names.filter(z=>z.name.indexOf(p)>=0 && !POI.test(z.name))
              .sort((a,b)=>a.name.length-b.name.length)[0];
            if(hit&&!list.find(x=>x.id===hit.id)) list.push(hit);
          });
          if(list.length<6){
            names.filter(z=>!POI.test(z.name)&&z.name.length<=6).slice(0,8)
              .forEach(z=>{ if(list.length<8&&!list.find(x=>x.id===z.id)) list.push(z); });
          }
          list=list.slice(0,8);
        }
      }
    } else { heading='지역을 불러오는 중이에요'; }

    const rowS='display:flex;align-items:center;gap:12px;padding:13px 20px 13px 14px;border-radius:12px;cursor:pointer;font-size:15.5px;min-height:46px;transition:background .12s';

    // 업종 · 지역 두 칸. 업종은 필수, 지역은 비워두면 서울 전체.
    const open=S.pickOpen||null;
    // 칸 자체가 입력창이다 — 드롭다운 안에 또 검색창을 두지 않는다
    const zq=S.zq||'', iq=S.iq||'';
    const typed=open==='zone'?zq:iq;
    const picked=open==='zone'?(S.homeZoneName||''):(S.homeInd?this.indName(S.homeInd):'');
    const pq=(typed.trim()===picked.trim())?'':typed.trim();
    const hasInd=!!S.homeInd;
    const indsAll=S.zi?S.zi.inds:[];
    // cmdk 점수로 정렬 — '카페'로도 '커피-음료'가 나오고, 오타·약칭도 걸린다
    const sc=this._score;
    const rank=(label,aliases)=>{
      if(!pq) return 1;
      if(sc) return sc(label,pq,aliases||[]);
      return (label+' '+(aliases||[]).join(' ')).indexOf(pq)>=0?1:0;
    };
    const indMatch=n=>rank(this.indName(n),[n])>0;
    const indList=(pq
      ? indsAll.map(n=>({n:n,s:rank(this.indName(n),[n])})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.n)
      : [...POP.filter(n=>indsAll.indexOf(n)>=0),...indsAll.filter(n=>POP.indexOf(n)<0)]).slice(0,60);
    const zoneAll=[];
    if(S.zi) for(const k in S.zi.zones) zoneAll.push({id:k,name:S.zi.zones[k].nm});
    const zoneHits=pq
      ? zoneAll.map(z=>({z:z,s:rank(z.name,[])})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.z)
      : [];
    // 최근 본 곳이 인기 동네를 대체하면 목록이 두세 줄로 줄어든다 — 둘을 합친다
    const zoneDefault=(()=>{
      const out=(S.recent||[]).map(nm=>zoneAll.find(z=>z.name===nm)).filter(Boolean).slice(0,3);
      POP_Z.forEach(p=>{
        const h=zoneAll.filter(z=>z.name.indexOf(p)>=0&&!POI.test(z.name)).sort((a,b)=>a.name.length-b.name.length)[0];
        if(h&&!out.find(x=>x.id===h.id)) out.push(h);
      });
      return out.slice(0,10);
    })();
    const zoneList=(pq?zoneHits.filter(z=>!POI.test(z.name)).concat(zoneHits.filter(z=>POI.test(z.name))):zoneDefault).slice(0,40);
    // 대분류는 우리가 나눈 것이다. 통계에는 분류 필드가 없다.
    const CATS=['외식','서비스','도소매','교육','의료','여가'];
    const CATMAP={
      외식:/음식점|커피|호프|치킨|분식|제과|패스트푸드|주점|반찬|일식|중식|양식|한식/,
      서비스:/미용|네일|피부|세탁|부동산|수리|정비|이발|스포츠 강습|사진|여관|숙박|철물|인테리어|가정용/,
      도소매:/판매|편의점|슈퍼|의류|화장품|안경|가방|신발|시계|귀금속|문구|서적|완구|가전|컴퓨터|핸드폰|청과|육류|수산|가구|조명|의약품|의료기기|섬유|자전거|예술품|고인용품|전자상거래/,
      교육:/학원|교습|어학|독서실|스터디/,
      의료:/의원|치과|한의원|병원|약국/,
      여가:/pc방|노래방|당구|골프|스포츠클럽|애완|여가|오락|볼링|헬스/i
    };
    const catOf=n=>{
      for(const c of CATS) if(CATMAP[c].test(n)) return c;
      return '도소매';
    };
    const cat=S.indCat||'외식';
    const catList=pq
      ? indsAll.filter(indMatch).slice(0,40)
      : indsAll.filter(n=>catOf(n)===cat);
    const storeText=n=>{
      const R=S.sti&&S.sti.ind?S.sti.ind[n]:null;
      return R? '서울 '+R.stores.toLocaleString()+'곳' : '집계 없음';
    };
    // 자치구 목록과 선택된 구의 동네 (좌표로 계산한 zone_gu.json)
    const GU_LIST=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const guTab=S.guTab||'강남구';
    const guZoneList=(()=>{
      if(!S.zi||!S.zgu) return [];
      const out=[];
      for(const k in S.zi.zones){
        if(S.zgu[k]!==guTab) continue;
        const rows=(S.zi.zones[k].rows||[]).filter(r=>r[1]&&r[2]);
        out.push({id:k, name:S.zi.zones[k].nm, n:rows.reduce((a,r)=>a+r[1],0),
          stores:rows.length? '' : '데이터 없음'});
      }
      return out.sort((a,b)=>b.n-a.n);
    })();
    const fieldBase='flex:1 1 0;min-width:0;display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:'+this.L('14px','16px','16px')+';transition:background .16s;'
      // 라벨 21px + 입력 22px 이 들어간다. 56 이면 위아래 6px 밖에 안 남아 꾸겨 보였다.
      +'padding:0 '+this.L('14px','18px','18px')+';height:'+this.L('58px','64px','64px')+';';
    const valBase='font-size:15px;font-weight:500;letter-spacing:-0.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    // 인기 검색 — 실제 데이터에서 뽑는다. 그 동네에 그 장사 기록이 있는 조합만.
    const tagSrc=['성수','연남','가로수길'];
    const tags=[];
    if(S.zi){
      tagSrc.forEach(p=>{
        const z=zoneAll.filter(x=>x.name.indexOf(p)>=0&&!POI.test(x.name)).sort((a,b)=>a.name.length-b.name.length)[0];
        if(!z) return;
        const rows=(S.zi.zones[z.id].rows||[]).filter(r=>r[1]&&r[2]);
        if(!rows.length) return;
        const top=rows.sort((a,b)=>b[2]-a[2])[0];
        const raw=S.zi.inds[top[0]];
        const zl=this.zoneLabelOf(z.name);
        tags.push({
          label:zl+' '+this.indName(raw),
          // 두 칸의 입력값(zq·iq)까지 채워야 화면과 상태가 어긋나지 않는다
          pick:()=>this.setState({
            homeZoneName:z.name, zoneId:z.id,sel:z.id, zq:zl,
            homeInd:raw, ind:raw, iq:this.indName(raw),
            pickOpen:null, cursor:0
          }),
          style:'flex:none;font-size:13px;padding:8px 14px;border-radius:999px;background:var(--surface);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;transition:background .16s,color .16s'
        });
      });
    }

    return {
      ...g,
      badgeStyle:'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2);background:var(--surface);border-radius:999px;padding:7px 14px;margin:0 auto 26px;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .7s cubic-bezier(.22,.7,.25,1) .5s forwards'),
      countLabel:(S.count!=null?S.count:1564).toLocaleString(),
      // 한 줄로 쓴다 — 줄바꿈 없이 들어가는 크기까지만 키운다(칸 폭 ÷ 글자수 기준)
      titleStyle:'font-size:'+this.L('23px','44px','52px')+';font-weight:700;letter-spacing:-0.025em;line-height:1.15;margin:0;white-space:nowrap',
      tagRow:'display:flex;align-items:center;gap:8px;margin-top:20px;flex-wrap:wrap;justify-content:center;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .8s cubic-bezier(.22,.7,.25,1) 2.7s forwards'),
      tags:tags,
      // 이메일을 받게 되었으니 소개의 약속 문구도 바꾼다

      // 드롭다운이 잘리지 않도록 세로 클리핑은 하지 않는다(배경 그래픽은 자체 마스크로 처리)
      heroSection:'position:relative;min-height:calc(100vh - '+this.L('56px','60px','64px')+');display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:'+this.L('52px','76px','88px')+' 0 0;overflow:visible',
      // 아무 곳이나 누르면 도입부를 건너뛴다. 재방문·급한 사용자가 기다리지 않게.
      skipAnim:()=>{ if(!S.skip) this.setState({skip:true}); },
      // z-index:2면 스태킹 컨텍스트가 되어 드롭다운이 헤더(50) 아래로 갇힌다
      // 헤더(50)보다 낮아야 한다. 60이면 스크롤할 때 제목이 헤더 위로 지나간다.
      // 드롭다운은 이 안에서만 위로 올라가면 되고(배경 그래픽 위), 헤더까지 넘을 필요는 없다
      // — 검색창이 헤더에서 한참 아래라 열린 목록이 헤더에 닿지 않는다.
      heroInner:'position:relative;z-index:10;width:100%;max-width:'+this.L('100%','620px','740px')+';text-align:center;'
        +(S.skip
          ? 'opacity:1'
          : 'opacity:0;will-change:transform,opacity;animation:heroRise 2.9s cubic-bezier(.22,.72,.24,1) .25s forwards'),
      subStyle:'font-size:17px;font-weight:500;color:var(--ink2);margin:22px 0 0;line-height:1.7;white-space:normal;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .8s cubic-bezier(.22,.7,.25,1) .95s forwards'),
      searchWrap:'position:relative;margin-top:40px;text-align:left;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .85s cubic-bezier(.22,.7,.25,1) 2.5s forwards'),
      skylineRow:'position:absolute;left:0;right:0;bottom:19%;display:flex;align-items:flex-end;justify-content:space-between;gap:'+this.L('10px','14px','18px')+';padding:0 '+this.L('18px','32px','48px'),
      // 가운데를 비우는 마스크 — 모바일에서 그래픽이 글자를 방해하지 않게 한다
      // 위로 갈수록 사라지게 해서 제목·검색창과 겹치지 않는다
      heroWrap:'position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;overflow:hidden;'
        +'-webkit-mask-image:linear-gradient(to bottom,transparent 34%,#000 62%);'
        +'mask-image:linear-gradient(to bottom,transparent 34%,#000 62%);'
        +'transition:transform .9s cubic-bezier(.22,.7,.25,1),opacity .9s;'
        +(S.picking?'opacity:.45;transform:scale(1.1)':''),
      // 테두리 없이 그림자만. 상자 속 상자를 만들지 않는다.
      // 모바일에서는 가로 3분할이 각 칸을 25px로 만든다 — 세로로 쌓아 전폭을 준다
      pickerRow:'display:flex;background:var(--bg);border-radius:20px;padding:6px;transition:box-shadow .22s;'
        +this.L('flex-direction:column;align-items:stretch;gap:4px;','align-items:center;gap:0;','align-items:center;gap:0;')
        +(open
          ? 'box-shadow:0 16px 40px rgba(0,0,0,.12)'
          : 'box-shadow:0 12px 32px rgba(0,0,0,.08)'),
      segInput:'width:100%;min-width:0;font-size:15px;font-weight:500;letter-spacing:-0.015em;color:var(--ink);'
        +'background:transparent;border:none;padding:0;height:22px;outline:none',
      zq:zq, iq:iq,
      onZoneQ:e=>this.setState({zq:e.target.value,pickOpen:'zone',cursor:0}),
      onIndQ:e=>this.setState({iq:e.target.value,pickOpen:'ind',cursor:0}),
      // ↑↓로 항목을 옮기고 Enter로 고른다 (cmdk 방식)
      onZoneKey:e=>{
        const n=zoneList.length;
        if(e.key==='Escape'){ this.setState({pickOpen:null,cursor:0}); e.target.blur(); return; }
        if(e.key==='ArrowDown'){ e.preventDefault(); this.setState({pickOpen:'zone',cursor:Math.min((S.cursor||0)+1,n)}); return; }
        if(e.key==='ArrowUp'){ e.preventDefault(); this.setState({cursor:Math.max((S.cursor||0)-1,0)}); return; }
        if(e.key==='Enter'){
          e.preventDefault();
          const c=S.cursor||0;
          if(c===0){ this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null,cursor:0}); return; }
          const f=zoneList[c-1];
          if(f) this.setState({homeZoneName:f.name,zoneId:f.id,zq:f.name,pickOpen:null,cursor:0});
        }
      },
      onIndKey:e=>{
        const list=catList;
        if(e.key==='Escape'){ this.setState({pickOpen:null,cursor:0}); e.target.blur(); return; }
        if(e.key==='ArrowDown'){ e.preventDefault(); this.setState({pickOpen:'ind',cursor:Math.min((S.cursor||0)+1,Math.max(list.length-1,0))}); return; }
        if(e.key==='ArrowUp'){ e.preventDefault(); this.setState({cursor:Math.max((S.cursor||0)-1,0)}); return; }
        if(e.key==='Enter'){
          e.preventDefault();
          const f=list[S.cursor||0];
          if(f) this.setState({homeInd:f,ind:f,iq:this.indName(f),pickOpen:null,cursor:0});
          return;
        }
        // 빈 칸에서 Backspace면 앞 칸으로
        if(e.key==='Backspace' && !iq){
          e.preventDefault();
          this.setState({pickOpen:'zone'});
          const el=document.querySelectorAll('[data-search] input')[0];
          if(el) el.focus();
        }
      },
      dividerStyle:this.L('flex:none;height:1px;margin:0 16px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)'),
      indBtn:fieldBase+(open==='ind'?'background:rgba(0,0,0,.04)':''),
      zoneBtn:fieldBase+(open==='zone'?'background:rgba(0,0,0,.04)':''),
      // 값이 있을 때만 나오는 지우기. 메인 버튼과 12px 이상 떨어져 있고 클릭이 위로 전파되지 않는다.
      hasZone:!!S.homeZoneName, hasIndVal:hasInd,
      clearStyle:'flex:none;width:32px;height:32px;margin-left:8px;border-radius:50%;background:var(--surface);color:var(--ink3);'
        +'font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s',
      clearZone:e=>{ e.stopPropagation(); this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null}); },
      clearInd:e=>{ e.stopPropagation(); this.setState({homeInd:null,iq:'',pickOpen:null}); },
      indLabel:S.homeInd?this.indName(S.homeInd):'예: 카페, 편의점',
      zoneLabel:S.homeZoneName||'서울 전체',
      zoneHint:S.homeZoneName?'':'· 몰라도 돼요',
      indHint:'',
      indValStyle:valBase+(hasInd?'color:var(--ink)':'color:var(--ink3)'),
      zoneValStyle:valBase+(S.homeZoneName?'color:var(--ink)':'color:var(--ink3)'),
      openInd:()=>{ if(open!=='ind') this.setState({pickOpen:'ind'});
        const el=document.querySelectorAll('[data-search] input')[1]; if(el) el.focus(); },
      openZone:()=>{ if(open!=='zone') this.setState({pickOpen:'zone'});
        const el=document.querySelectorAll('[data-search] input')[0]; if(el) el.focus(); },
      pickOpen:!!open, indPanel:open==='ind', zonePanel:open==='zone',
      // 통째로 교체되는 목록은 위치 애니메이션 대신 짧은 페이드로 바꾼다
      indGridStyle:'display:grid;grid-template-columns:'+this.L('1fr','1fr 1fr','1fr 1fr')+';gap:8px;'
        +'animation:fadeIn .14s linear both',
      hotInds:[['커피-음료','☕'],['치킨전문점','🍗'],['편의점','🏪'],['미용실','💇'],['한식음식점','🍚'],['호프-간이주점','🍺']]
        .filter(([n])=>indsAll.indexOf(n)>=0)
        .map(([n,em])=>({label:em+' '+this.indName(n),
          pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null}),
          style:'flex:none;font-size:13.5px;font-weight:500;padding:9px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
            +(n===S.homeInd?'background:var(--accent);color:#FFFFFF':'background:var(--surface);color:var(--ink2)')})),
      indCats:CATS.map(c=>({label:c,
        pick:()=>this.setState({indCat:c}),
        style:'font-size:13.5px;font-weight:500;padding:11px 12px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:background .14s,color .14s;'
          +(c===cat?'background:var(--line);color:var(--ink);font-weight:600':'color:var(--ink2)')})),
      indCards:catList.map((n,i)=>({name:this.indName(n), stores:'',
        pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null,cursor:0}),
        style:'display:flex;align-items:center;min-width:0;padding:14px 12px;border-radius:12px;cursor:pointer;transition:background .14s;'
          +(n===S.homeInd?'background:var(--accent-3)'
            :(i===(S.cursor||0)&&open==='ind'?'background:var(--line)':'background:var(--surface)'))})),
      indEmpty:catList.length===0,
      indEmptyText: pq? '‘'+pq+'’와 맞는 장사가 없어요' : '이 분류에 해당하는 장사가 없어요',
      pickHeading: open==='zone'
        ? (pq? (zoneList.length? '찾은 곳 '+zoneList.length+'군데':'')
             : ((S.recent||[]).length?'최근에 본 곳과 많이 찾는 동네':'많이 찾는 동네')+' · 모두 '+zoneAll.length.toLocaleString()+'곳 검색 가능')
        : (pq? (indList.length? '찾은 장사 '+indList.length+'가지':'') : '많이 찾는 장사 · 모두 '+indsAll.length+'가지'),
      pickList: open==='zone'
        ? (()=>{
            const out=[{row:true, name:'서울 전체', meta:'아직 안 정함',
              pick:()=>this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null})}];
            let n=0;
            const push=z=>{ out.push({row:true, name:this.zoneLabelOf(z.name), meta:meta(z.id),
              pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null,cursor:0})}); n++; };
            if(pq){ zoneList.forEach(push); }
            else {
              const rec=zoneList.filter(z=>(S.recent||[]).indexOf(z.name)>=0);
              const hot=zoneList.filter(z=>(S.recent||[]).indexOf(z.name)<0);
              if(rec.length){ out.push({header:true,name:'⏱️ 최근 본 동네'}); rec.forEach(push); }
              if(hot.length){ out.push({header:true,name:'🔥 많이 찾는 동네'}); hot.forEach(push); }
            }
            let ri=-1;
            return out.map(o=>{
              if(o.header) return {isHeader:true,isRow:false,name:o.name,meta:'',style:'',pick:()=>{}};
              ri++;
              return {isHeader:false,isRow:true,name:o.name,meta:o.meta,pick:o.pick,
                style:rowS+(ri===(S.cursor||0)?';background:var(--line)':'')};
            });
          })()
        : indList.map(n=>({isHeader:false,isRow:true,name:this.indName(n), meta:'',
            pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null}),
            style:rowS+(n===S.homeInd?';background:var(--surface);font-weight:600':'')})),
      // 검색 중이면 결과 목록, 아니면 자치구 2단
      zoneSearching: open==='zone' && !!pq,
      zoneBrowsing: open==='zone' && !pq,
      allCardStyle:'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:12px;background:var(--surface);cursor:pointer;transition:background .14s'
        +(S.homeZoneName?'':';box-shadow:inset 0 0 0 1.5px var(--accent)'),
      pickAll:()=>this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null}),
      // 목록 높이를 끌어서 늘릴 수 있다. 최소 150 / 최대 420px로 묶는다.
      colsStyle:'flex:none;height:'+(S.colsH||190)+'px;display:flex;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)',
      onResize:e=>{
        const startY=(e.touches?e.touches[0].clientY:e.clientY);
        const startH=S.colsH||190;
        const move=ev=>{
          const y=(ev.touches?ev.touches[0].clientY:ev.clientY);
          const h=Math.min(Math.max(startH+(y-startY),150),420);
          this.setState({colsH:h});
        };
        const up=()=>{
          window.removeEventListener('mousemove',move);
          window.removeEventListener('mouseup',up);
          window.removeEventListener('touchmove',move);
          window.removeEventListener('touchend',up);
          window.removeEventListener('touchcancel',up);
        };
        this._dragCleanup?.();this._dragCleanup=up;
        window.addEventListener('touchcancel',up);
        window.addEventListener('mousemove',move);
        window.addEventListener('mouseup',up);
        window.addEventListener('touchmove',move,{passive:false});
        window.addEventListener('touchend',up);
      },
      hasRecent:(S.recent||[]).length>0,
      recentChips:(S.recent||[]).map(nm=>zoneAll.find(z=>z.name===nm)).filter(Boolean).slice(0,4).map(z=>({
        name:this.zoneLabelOf(z.name), meta:guOf(z.id),
        pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null}),
        style:'flex:none;display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;background:var(--surface);cursor:pointer;white-space:nowrap;min-height:38px;transition:background .14s,color .14s'
      })),
      guTabs:GU_LIST.map(g=>({
        label:g, pick:()=>this.setState({guTab:g}),
        style:'flex:none;font-size:13.5px;font-weight:500;padding:10px 8px;border-radius:9px;cursor:pointer;white-space:nowrap;transition:background .14s,color .14s;'
          +(g===guTab?'background:var(--line);color:var(--ink);font-weight:600':'color:var(--ink2)')
      })),
      guZones:guZoneList.map(z=>({
        name:this.zoneLabelOf(z.name), meta:z.stores,
        pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(z.id===S.zoneId?'background:var(--accent-3)':'')
      })),
      guEmpty:guZoneList.length===0, guEmptyText:'이 구에는 데이터가 없어요',
      pickEmpty: !!pq && (open==='zone'? zoneList.length===0 : indList.length===0),
      pickEmptyText:'‘'+pq+'’와 맞는 '+(open==='zone'?'동네가':'장사가')+' 없어요',
      startDisabled:!!S.starting,
      starting:!!S.starting, notStarting:!S.starting,
      startStyle:this.L('flex:none;width:100%;margin-top:4px;','flex:none;','flex:none;')
        +'font-size:15px;font-weight:600;border:none;border-radius:14px;height:'+this.L('46px','48px','48px')+';'
        +this.L('','min-width:106px;','min-width:116px;')+'padding:0 '+this.L('18px','22px','26px')+';white-space:nowrap;'
        +'display:inline-flex;align-items:center;justify-content:center;'
        +'transition:transform .2s cubic-bezier(.2,0,0,1),background .18s,box-shadow .2s,filter .18s;'
        // 비활성이어도 브랜드 컬러 글자와 옅은 배경을 남겨 누를 수 있는 요소로 읽히게 한다
        +(hasInd
          ? 'cursor:'+(S.starting?'default':'pointer')+';background:var(--accent);color:#FFFFFF;box-shadow:0 6px 16px -6px rgba(0,0,0,.2)'
          : 'cursor:pointer;background:var(--accent-3);color:var(--accent)'),
      startActive:S.starting?'':'transform:scale(.96)',
      startHover:S.starting?'':(hasInd?'filter:brightness(1.05)':'filter:brightness(.97)'),
      start:()=>{
        if(S.starting) return;
        if(!hasInd){ this.setState({pickOpen:'ind'});
          const el=document.querySelectorAll('[data-search] input')[1]; if(el) el.focus(); return; }
        this.setState({starting:true,pickOpen:null});
        if(S.zoneId){ this.startZone(); return; }
        this.setState({screen:'find',sel:null,fromRegion:false,homeZone:null,starting:false,hist:['home']});
      },
      // 흰 필드 + 아주 얕은 그림자. 회색 덩어리보다 가볍고 정확해 보인다.
      searchBox:'position:relative;display:flex;align-items:center;gap:14px;background:var(--bg);border-radius:20px;padding:0 24px;transition:box-shadow .18s;'
        +(S.zFocus
          ? 'box-shadow:0 0 0 1.5px var(--accent),0 8px 24px rgba(0,0,0,.08)'
          : 'box-shadow:0 0 0 1px var(--line-strong),0 4px 16px rgba(0,0,0,.05)'),
      onZq:e=>this.setState({zq:e.target.value,zFocus:true}),
      onZfocus:()=>{
        this.setState({zFocus:true});
        const el=document.querySelector('input[placeholder*="지역"]');
        if(el) el.focus();
      },
      clearZq:()=>this.setState({zq:'',zFocus:true}),
      picking:!!S.picking,
      pickingText:S.picking? S.picking+' 상권을 분석하고 있어요' : ''
    };
  }

  // 지역까지 고른 경우 — 짧은 전환 뒤 그 지역 화면으로
  startZone(){
    const S=this.state, name=S.homeZoneName;
    const prev=(S.recent||[]).filter(n=>n!==name);
    const recent=[name,...prev].slice(0,4);
    try{ localStorage.setItem('mysbizon.recentZones',JSON.stringify(recent)); }catch(e){}
    this.setState({picking:name,pickOpen:null,recent:recent});
    this.setState({screen:'region',picking:null,starting:false,homeZone:name,regPick:S.homeInd||null,hist:['home']});
  }

  pickZone(z){
    const prev=(this.state.recent||[]).filter(n=>n!==z.name);
    const recent=[z.name,...prev].slice(0,4);
    try{ localStorage.setItem('mysbizon.recentZones',JSON.stringify(recent)); }catch(e){}
    this.setState({picking:z.name,zFocus:false,recent:recent});
    this.setState({screen:'region',picking:null,homeZone:z.name,zoneId:z.id,sel:z.id,regPick:null,hist:['home']});
  }

  // 순수 SVG 꺾은선 — 차트 라이브러리를 쓰지 않는다
  linePath(vals,w,h,pad){
    if(!vals||vals.length<2) return {d:'',area:'',pts:[]};
    const mn=Math.min(...vals), mx=Math.max(...vals);
    const span=(mx-mn)||1;
    const pts=vals.map((v,i)=>[
      pad+ i*(w-pad*2)/(vals.length-1),
      h-pad- ((v-mn)/span)*(h-pad*2)
    ]);
    const d='M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join('L');
    const area=d+'L'+pts[pts.length-1][0].toFixed(1)+' '+(h-pad)+'L'+pad+' '+(h-pad)+'Z';
    return {d:d, area:area, pts:pts.map((p,i)=>({x:+p[0].toFixed(1),y:+p[1].toFixed(1),last:i===pts.length-1}))};
  }

  // 시세분석 — 임대료·공실률·업종 매출·소비 구성. 전부 공개 통계.
  priceView(){
    const S=this.state;
    const CATS=[
      {k:'rent', label:'상가 임대료'},
      {k:'vacancy', label:'빈 상가 비율'},
      {k:'sales', label:'장사별 매출 추이'},
      {k:'spend', label:'자치구 소비 구성'},
      {k:'churn', label:'문 열고 닫는 수'},
      {k:'fr', label:'프랜차이즈 비중'}
    ];
    const cat=S.prCat||'rent';
    const W=640,H=200,PAD=16;
    const out={cats:CATS.map(c=>({label:c.label, pick:()=>this.setState({prCat:c.k,prPick:null}),
      style:'font-size:14px;font-weight:500;padding:12px 14px;border-radius:11px;cursor:pointer;white-space:nowrap;transition:background .14s,color .14s;'
        +(c.k===cat?'background:var(--line);color:var(--ink);font-weight:600':'color:var(--ink2)')})),
      title:'', unit:'', now:'', nowLabel:'', delta:'', deltaStyle:'display:none',
      labels:[], line:{d:'',area:'',pts:[]}, list:[], listTitle:'', note:'', w:W, h:H,
      missing:'', hasChart:false, pairs:null, dots:null, legend:null, bars:null};

    const R=S.rentStats, HI=S.salesHistory;
    if(cat==='rent'||cat==='vacancy'){
      if(!R||!Array.isArray(R.quarters)||!R.quarters.length||!R.zones) { out.note='임대료 자료가 없거나 아직 불러오지 못했어요.'; return out; }
      const zones=Object.values(R.zones||{});
      const pickNm=S.prPick|| (zones[0]&&zones[0].nm);
      const z=zones.find(o=>o.nm===pickNm)||zones[0];
      const isRent=cat==='rent';
      const rawTrend=z? (isRent? z.rent_trend : z.vacancy_trend) : [];
      const trend=Array.isArray(rawTrend)?rawTrend:[];
      if(!trend.length||!trend.every(Number.isFinite)){out.note='이 지역의 추이를 표시할 자료가 부족해요.';return out;}
      const cur=trend[trend.length-1], prev=trend[0];
      const d=cur-prev;
      out.title=(z?z.nm:'')+' · '+(isRent?'㎡당 월 임대료':'빈 상가 비율');
      out.now=isRent? (cur||0).toFixed(1)+'만원' : (cur||0).toFixed(1)+'%';
      out.nowLabel=R.quarters[R.quarters.length-1]+' 기준';
      out.delta=(d>0?'▲ ':(d<0?'▼ ':''))+Math.abs(d).toFixed(1)+(isRent?'만원':'%p')+' · 2년 전 대비';
      out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(d>0?'var(--warn)':(d<0?'var(--good)':'var(--ink3)'));
      out.labels=[R.quarters[0], R.quarters[R.quarters.length-1]];
      out.line=this.linePath(trend,W,H,PAD);
      out.hasChart=trend.length>1;
      out.listTitle='상권 '+zones.length+'곳';
      out.list=zones.slice().sort((a,b)=>(isRent?b.rent-a.rent:b.vacancy-a.vacancy)).map(o=>({
        name:o.nm, meta:o.gwon,
        value:isRent? o.rent.toFixed(1)+'만원' : o.vacancy.toFixed(1)+'%',
        pick:()=>this.setState({prPick:o.nm}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(o.nm===(z&&z.nm)?'background:var(--accent-3)':'')
      }));
      out.note='한국부동산원 상업용부동산 임대동향조사(중대형 상가). '+R.unit+'. 이 조사의 상권 구획은 서울시 상권분석의 동네 1,564곳과 다른 지리라 동네별 임대료로 쓸 수 없어요. 권역 수준의 참고값이에요.';
      return out;
    }

    if(cat==='sales'){
      if(!HI){ out.note='매출 추이 자료를 불러오는 중입니다.'; return out; }
      const inds=Object.keys(HI.ind);
      const pick=S.prPick|| (inds.indexOf(S.ind)>=0? S.ind : inds[0]);
      const series=HI.ind[pick]||{};
      const qs=HI.quarters.filter(q=>series[q]!=null);
      const vals=qs.map(q=>series[q]);
      const cur=vals[vals.length-1], prev=vals[vals.length-5];
      const pct=prev? (cur-prev)/prev*100 : 0;
      out.title=this.indName(pick)+' · 서울 전체 분기 매출';
      out.now=this.fmt(cur)+'원';
      out.nowLabel=this.qtr(qs[qs.length-1])+' 기준';
      out.delta=(pct>0?'▲ ':'▼ ')+Math.abs(pct).toFixed(1)+'% · 1년 전 대비';
      out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(pct>=0?'var(--good)':'var(--warn)');
      out.labels=[this.qtr(qs[0]), this.qtr(qs[qs.length-1])];
      out.line=this.linePath(vals,W,H,PAD);
      out.hasChart=vals.length>1;
      out.listTitle='장사 '+inds.length+'가지';
      out.list=inds.map(n=>({
        name:this.indName(n), meta:'',
        value:this.fmt(series[qs[qs.length-1]]||HI.ind[n][HI.quarters[HI.quarters.length-1]])+'원',
        pick:()=>this.setState({prPick:n}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(n===pick?'background:var(--accent-3)':'')
      }));
      out.note='서울시 상권분석서비스 추정매출을 분기별로 합산한 값이에요. 서울 전체 합계이고 동네별 값이 아니에요.';
      return out;
    }

    // 문 열고 닫는 수 — 개업/폐업을 한 줄에 두 색으로
    if(cat==='churn'||cat==='fr'){
      const ST=S.sti&&S.sti.ind;
      if(!ST){ out.note='개·폐업 자료를 불러오는 중입니다.'; return out; }
      const rows=Object.keys(ST).map(n=>({raw:n,name:this.indName(n),...ST[n]}))
        .filter(o=>o.stores);
      if(cat==='churn'){
        rows.sort((a,b)=>(b.closed-b.opened)-(a.closed-a.opened));
        const mx=Math.max(...rows.map(o=>Math.max(o.opened,o.closed)),1);
        const pick=S.prPick||rows[0].raw;
        const z=rows.find(o=>o.raw===pick)||rows[0];
        out.title=z.name+' · 3개월 동안';
        out.now=(z.closed-z.opened>0?'+':'')+(z.closed-z.opened).toLocaleString()+'곳';
        out.nowLabel='문 닫은 곳에서 새로 연 곳을 뺀 수';
        out.delta=z.closed>z.opened?'줄고 있어요':'늘고 있어요';
        out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(z.closed>z.opened?'var(--warn)':'var(--good)');
        out.pairs=rows.slice(0,14).map(o=>({
          label:o.name,
          openBar:'display:block;width:'+(o.opened/mx*100).toFixed(1)+'%;height:100%;background:var(--accent);opacity:.45;border-radius:3px',
          closeBar:'display:block;width:'+(o.closed/mx*100).toFixed(1)+'%;height:100%;background:var(--warn);opacity:.75;border-radius:3px',
          open:o.opened.toLocaleString(), close:o.closed.toLocaleString(),
          pick:()=>this.setState({prPick:o.raw}),
          style:'display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-radius:11px;cursor:pointer;transition:background .14s;'
            +(o.raw===z.raw?'background:var(--accent-3)':'')
        }));
        out.legend=[{label:'새로 연 곳',color:'var(--accent)',op:'.45'},{label:'문 닫은 곳',color:'var(--warn)',op:'.75'}];
        out.list=[]; out.listTitle='';
        out.note='서울 전체 3개월 기준이에요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 데이터가 구분하지 않아요.';
        return out;
      }
      // 프랜차이즈 산점도 — x 총 가게, y 프랜차이즈 수, 점 크기 비중
      rows.sort((a,b)=>b.fr_share-a.fr_share);
      const mxS=Math.max(...rows.map(o=>o.stores),1);
      const mxF=Math.max(...rows.map(o=>o.stores*o.fr_share/100),1);
      const top=rows[0];
      out.title='장사별 프랜차이즈 비중';
      out.now=top.name+' '+top.fr_share+'%';
      out.nowLabel='프랜차이즈 비중이 가장 높은 장사';
      out.dots=rows.map(o=>{
        const fr=o.stores*o.fr_share/100;
        return {
          cx:(8+o.stores/mxS*84).toFixed(1),
          cy:(92-fr/mxF*84).toFixed(1),
          r:(1.6+o.fr_share/100*4.2).toFixed(2),
          op:(0.28+0.5*o.fr_share/100).toFixed(2),
          name:o.name
        };
      });
      out.list=rows.slice(0,20).map(o=>({
        name:o.name, meta:o.stores.toLocaleString()+'곳',
        value:o.fr_share+'%',
        pick:()=>{}, style:'display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;font-size:15px'
      }));
      out.listTitle='비중 높은 순';
      out.note='점 하나가 장사 한 가지예요. 오른쪽으로 갈수록 가게가 많고, 위로 갈수록 프랜차이즈가 많고, 점이 클수록 그 비중이 높아요. 프랜차이즈가 많은 자리는 개인 가게가 버티기 어려울 수 있어요.';
      return out;
    }

    // 소비 구성
    const IC=S.income;
    if(!IC){ out.note='소비 자료를 불러오는 중입니다.'; return out; }
    const gus=Object.keys(IC.gu||{});
    const pick=S.prPick|| gus[0];
    const spend=((IC.gu[pick]||{}).spend)||[];
    const mx=Math.max(...spend.map(o=>o.pct),1);
    out.title=pick+' · 가구가 돈을 쓰는 곳';
    out.now=spend.length? spend.slice().sort((a,b)=>b.pct-a.pct)[0].name : '—';
    out.nowLabel='가장 많이 쓰는 항목';
    out.hasChart=false;
    out.bars=spend.slice().sort((a,b)=>b.pct-a.pct).map(o=>({
      label:o.name, pct:o.pct.toFixed(1)+'%',
      bar:'display:block;width:'+(o.pct/mx*100).toFixed(1)+'%;height:100%;background:var(--accent);opacity:'+(0.35+0.65*(o.pct/mx)).toFixed(2)+';border-radius:3px'
    }));
    out.listTitle='자치구 '+gus.length+'곳';
    out.list=gus.map(g=>({
      name:g, meta:'', value:'',
      pick:()=>this.setState({prPick:g}),
      style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
        +(g===pick?'background:var(--accent-3)':'')
    }));
    out.note=IC.income_note||'서울 열린데이터광장 가구 소비 자료예요.';
    return out;
  }

  // 자치구 표기 — 경계에 걸친 상권은 두 구를 함께
  guLabel(id){
    const S=this.state;
    const own=(S.zgu&&S.zgu[id])||'';
    const b=S.zbd&&S.zbd[id];
    return (own&&b&&b[1])? own+'·'+b[1]+' 경계' : own;
  }

  // 정밀분석 상세 근거 다섯 절 — 카드 하나씩 그린다
  mvSections(sel,L){
    const S=this.state;
    const lp=S.zlp&&S.zlp[sel.id];
    const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
    const HI=S.salesHistory, RENT=S.rentStats;
    const med=key=>{ const v=L.map(o=>o[key]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
    const AL=['10대','20대','30대','40대','50대','60대+'];
    const bar=p=>'display:block;width:'+Math.max(Math.min(p,100),2).toFixed(0)
      +'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.4+0.6*Math.min(p,100)/100).toFixed(2);
    const out=[];

    // 수요
    const dRows=[], dBars=[];
    if(lp){
      const mxA=Math.max(...lp.age,1);
      lp.age.forEach((v,i)=>dBars.push({label:AL[i], value:Math.round(v).toLocaleString()+'명', bar:bar(v/mxA*100)}));
      dRows.push({label:'추정 객단가', value:Math.round(sel.unit).toLocaleString()+'원', tag:'원자료 · 결제 1건당'});
      dRows.push({label:'여성 / 남성', value:Math.round(lp.f/lp.tot*100)+'% / '+Math.round(lp.m/lp.tot*100)+'%', tag:'공공 집계'});
    }
    out.push({key:'demand', title:'수요 · 누가 오나요',
      q:'하루에 사람이 얼마나 오나요?',
      big: lp? Math.round(lp.tot).toLocaleString()+'명' : '데이터 없음',
      bigLabel: lp? lp.dong+' 행정동 하루 유동인구 · 공공 집계' : '유동인구 데이터가 없어요',
      verdict:(()=>{
        if(!lp) return '유동인구 데이터가 없어서 수요는 판단하지 못했어요.';
        const t=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l?l.tot:null; }).filter(v=>v!=null).sort((a,b)=>a-b);
        const m=t[Math.floor(t.length/2)];
        return lp.tot>=m*1.2? '사람이 많이 오는 편이에요.' : (lp.tot>=m*0.8? '사람은 보통 수준이에요.' : '사람이 적은 편이에요.');
      })(),
      rows:dRows, bars:dBars,
      note: lp? '유동인구는 '+lp.dong+' 행정동 값이라 상권보다 넓어요. 시간대·요일 데이터는 아직 없어요.' : ''});

    // 경쟁
    const cRows=[{label:'같은 장사 수', value:sel.stores.toLocaleString()+'곳', tag:'공공 집계'},
      {label:'서울 중앙값', value:Math.round(med('stores')).toLocaleString()+'곳', tag:'이 장사 동네들의 중앙값'}];
    let satWord='';
    if(lp){
      const sat=sel.stores/(lp.tot/10000);
      const sats=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l&&l.tot?o.stores/(l.tot/10000):null; })
        .filter(v=>v!=null).sort((a,b)=>a-b);
      const sm=sats[Math.floor(sats.length/2)];
      cRows.push({label:'사람 1만 명당 가게', value:sat.toFixed(1)+'개', tag:'계산값 · 가게 ÷ 유동인구'});
      cRows.push({label:'서울 중앙값', value:sm.toFixed(1)+'개', tag:'포화도 기준선'});
      satWord = sat<=sm*0.7? '사람 수에 비해 가게가 적어요.' : (sat<=sm*1.3? '경쟁은 보통 수준이에요.' : '사람 수에 비해 가게가 많은 편이에요.');
    }
    out.push({key:'comp', title:'경쟁 · 얼마나 치열한가요',
      q:'같은 장사가 몇 곳 있나요?',
      big:sel.stores.toLocaleString()+'곳',
      bigLabel:'서울 중앙값 '+Math.round(med('stores')).toLocaleString()+'곳',
      verdict: satWord || (sel.stores<=med('stores')? '같은 장사가 서울 중앙값보다 적어요.' : '같은 장사가 많은 편이에요.'),
      rows:cRows, bars:[],
      note:'가게 수만 보면 큰 동네가 늘 불리해 보여요. 그래서 사람 수로 나눠 견줘요.'});

    // 매출
    const mp=med('per'), diff=Math.round((sel.per-mp)/mp*100);
    const sRows=[{label:'가게 한 곳당 월매출', value:this.fmt(sel.per/3)+'원', tag:'추정 · 매출 ÷ 가게 수'},
      {label:'서울 중앙값', value:this.fmt(mp/3)+'원', tag:'이 장사 동네들의 중앙값'},
      {label:'손님이 쓴 돈 (3개월)', value:this.fmt(sel.sales)+'원', tag:'공공 집계 · 카드 결제'}];
    let trend=null;
    if(HI&&HI.ind[S.ind]){
      const series=HI.ind[S.ind];
      const qs=HI.quarters.filter(q=>series[q]!=null);
      const last4=qs.slice(-4), prev4=qs.slice(-8,-4);
      const sum=a=>a.reduce((x,q)=>x+series[q],0);
      const cur=sum(last4), prv=prev4.length?sum(prev4):0;
      const pct=prv? (cur-prv)/prv*100 : null;
      const vals=last4.map(q=>series[q]);
      const mn=Math.min(...vals), mx=Math.max(...vals), sp=(mx-mn)||1;
      trend={label:'최근 4분기 흐름',
        delta: pct==null?'—':((pct>0?'+':'')+pct.toFixed(1)+'%'),
        deltaStyle:'font-size:14px;font-weight:700;white-space:nowrap;color:'+(pct==null?'var(--ink3)':(pct>=0?'var(--good)':'var(--warn)')),
        bars:last4.map((q,i)=>({label:this.qtr(q).replace('년 ','.').replace('분기','Q'),
          bar:'display:block;width:100%;height:'+(18+((vals[i]-mn)/sp)*46).toFixed(0)+'px;border-radius:4px 4px 0 0;background:var(--accent);opacity:'+(0.4+0.6*((vals[i]-mn)/sp)).toFixed(2)})),
        full:'서울 전체 합계라 이 동네만의 흐름은 아니에요. 21분기 전체는 시세분석에서 볼 수 있어요.'};
    }
    out.push({key:'sales', title:'매출 · 얼마나 버나요',
      q:'가게 한 곳이 한 달에 얼마 파나요?',
      big:this.fmt(sel.per/3)+'원',
      bigLabel:'서울 중앙값 '+this.fmt(mp/3)+'원 · 추정',
      verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요.' : (diff<=-10? '서울 중앙값보다 '+Math.abs(diff)+'% 낮아요.' : '서울 중앙값과 비슷해요.')),
      rows:sRows, bars:[], trend:trend,
      note:'한 곳당 매출은 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아니에요.'});

    // 비용
    const kRows=[];
    if(RENT&&RENT.zones){
      const zs=Object.values(RENT.zones);
      const rr=zs.map(o=>o.rent).sort((a,b)=>a-b);
      const vv=zs.map(o=>o.vacancy).sort((a,b)=>a-b);
      kRows.push({label:'서울 권역 ㎡당 월 임대료 중앙값', value:rr[Math.floor(rr.length/2)].toFixed(1)+'만원', tag:'한국부동산원 · 참고값'});
      kRows.push({label:'서울 권역 빈 상가 비율 중앙값', value:vv[Math.floor(vv.length/2)].toFixed(1)+'%', tag:'한국부동산원 · 참고값'});
    }
    kRows.push({label:'권리금 · 인테리어', value:'데이터 없음', tag:'현재 자료에 없어요'});
    out.push({key:'cost', title:'비용 · 얼마가 나가나요',
      q:'임대료는 얼마인가요?',
      big:'데이터 없음',
      bigLabel:'동네별 임대료는 공개되지 않아요',
      verdict:'중개인에게 확인한 금액을 본전 계산에 직접 넣으셔야 해요.',
      rows:kRows, bars:[],
      note:'위 값은 한국부동산원의 넓은 권역 중앙값이라 이 자리 값이 아니에요.'});

    // 시장 구조
    const kk=[];
    if(R){
      const rate=R.stores? R.closed/R.stores*100 : 0;
      kk.push({label:'프랜차이즈 비중', value:R.fr_share+'%', tag:'서울 전체 · 공공 집계'});
      kk.push({label:'새로 연 곳 / 문 닫은 곳', value:R.opened.toLocaleString()+'곳 / '+R.closed.toLocaleString()+'곳', tag:'서울 전체 · 3개월'});
      kk.push({label:'폐업률', value:rate.toFixed(1)+'%', tag:'서울 전체 · 폐업 ÷ 전체'});
    } else kk.push({label:'개·폐업', value:'데이터 없음', tag:''});
    // 이 자리 다른 장사 — 같은 상권 안 다른 업종의 가게 수와 한 곳당 매출
    const nb=(()=>{
      const z=S.zi&&S.zi.zones?S.zi.zones[sel.id]:null;
      if(!z||!z.rows) return null;
      const names=S.zi.inds||[];
      const all=z.rows.map(r=>({idx:r[0], name:names[r[0]]||('업종 '+r[0]), stores:r[1], sales:r[2]}))
        .filter(o=>o.stores>0).map(o=>({...o, per:o.sales/o.stores/3}));
      if(!all.length) return null;
      const mine=all.find(o=>o.name===S.ind);
      const top=all.slice().sort((a,b)=>b.per-a.per).slice(0,8);
      const mx=Math.max(...top.map(o=>o.per));
      return {
        total:all.length,
        mine:mine||null,
        rank:mine? all.slice().sort((a,b)=>b.per-a.per).findIndex(o=>o.name===S.ind)+1 : null,
        bars:top.map(o=>({label:o.name, value:this.fmt(o.per)+'원',
          bar:bar(o.per/mx*100)+(o.name===S.ind?';background:var(--accent)':';background:var(--ink3)')}))
      };
    })();
    if(nb){
      const nRows=[{label:'이 자리 장사 종류', value:nb.total+'가지', tag:'공공 집계'}];
      if(nb.mine) nRows.push({label:'내 장사 순위', value:nb.rank+'위 / '+nb.total+'가지', tag:'가게 한 곳당 매출 기준'});
      out.push({key:'nearby', title:'이 자리 · 다른 장사는 어떤가요',
        q:'이 자리에서 뭐가 가장 잘 팔리나요?',
        big:nb.bars[0].label,
        bigLabel:'가게 한 곳당 월매출 1위 · '+nb.bars[0].value,
        verdict: nb.rank && nb.rank<=3
          ? '고른 장사가 이 자리에서 '+nb.rank+'번째로 잘 팔려요.'
          : (nb.rank? '이 자리에서는 다른 장사가 더 잘 팔려요. 위 목록을 보고 업종을 다시 볼 수도 있어요.' : '고른 장사는 이 자리에 아직 없어요.'),
        rows:nRows, bars:nb.bars,
        note:'같은 상권 안 다른 장사의 가게 수와 매출이에요. 초록색이 지금 고른 장사예요. 잘 팔리는 장사가 늘 좋은 건 아니에요 — 그만큼 이미 자리를 잡았다는 뜻일 수도 있어요.'});
    }

    // 매출 늘리기 — 있는 데이터에서만 뽑는다
    const tips=[];
    if(lp){
      let hi=0; lp.age.forEach((v,i)=>{ if(v>lp.age[hi]) hi=i; });
      const fw=Math.round(lp.f/lp.tot*100);
      tips.push({label:'가장 많은 손님', value:AL[hi], tag:'하루 '+Math.round(lp.age[hi]).toLocaleString()+'명'});
      tips.push({label:'여성 비율', value:fw+'%', tag:fw>=55?'여성 손님이 많아요':(fw<=45?'남성 손님이 많아요':'비슷해요')});
      const perHead=sel.unit;
      tips.push({label:'추정 객단가', value:Math.round(perHead).toLocaleString()+'원',
        tag:'원자료 · 결제 1건당'});
    }
    if(nb&&nb.bars.length>1) tips.push({label:'같이 잘 되는 장사', value:nb.bars.slice(0,2).map(b=>b.label).join(' · '), tag:'이 자리 매출 상위'});
    if(tips.length) out.push({key:'grow', title:'늘리기 · 무엇을 해볼까요',
      q:'이 자리에서 매출을 어떻게 늘리나요?',
      big: lp? AL[(()=>{let h=0;lp.age.forEach((v,i)=>{if(v>lp.age[h])h=i;});return h;})()] : '데이터 없음',
      bigLabel: lp? '가장 많이 오는 나이대에 맞추는 게 먼저예요' : '',
      verdict:(()=>{
        if(!lp) return '유동인구가 없어서 손님 구성을 말하지 못했어요.';
        const perHead=sel.unit;
          return '유동인구 구성은 방문객의 참고 정보입니다. 실제 고객과 메뉴 수요는 현장에서 확인해 주세요.';
      })(),
      rows:tips, bars:[],
      note:'저희가 가진 데이터로 말할 수 있는 것만 적었어요. 메뉴·가격·마케팅은 데이터가 아니라 사장님 판단이에요.'});

    out.push({key:'market', title:'시장 구조 · 누가 버티고 있나요',
      q:'이 장사는 앞으로 어떨까요?',
      big: R? ((R.opened-R.closed>0?'+':'')+(R.opened-R.closed).toLocaleString()+'곳') : '데이터 없음',
      bigLabel: R? '3개월 동안 새로 연 곳 − 문 닫은 곳 · 서울 전체' : '',
      verdict: R? (R.opened>=R.closed
        ? '가게가 늘고 있어요. 지금 계산한 한 곳당 매출은 앞으로 더 나뉠 수 있어요.'
        : '가게가 줄고 있어요. 경쟁이 풀리는 신호일 수도, 장사가 어려워지는 신호일 수도 있어요.') : '개·폐업 데이터가 없어요.',
      rows:kk, bars:[],
      note:'모두 서울 전체 이 장사 기준이라 자리를 바꿔도 변하지 않아요.'});

    return out;
  }

  // 실좌표 SVG 지도 — 지도분석과 비교분석이 같은 그림을 쓴다
  buildMap(list, selId){
    const S=this.state, SM=S.smap;
    if(!SM||!list.length) return {ready:false, gus:[], pins:[], vb:'0 0 100 100', stroke:'0.5', legend:[], legendNote:''};
    const cds=list.map(o=>SM.pts[o.id]).filter(Boolean);
    let x0=100,x1=0,y0=100,y1=0;
    cds.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});
    if(!cds.length){ x0=20;x1=80;y0=20;y1=80; }
    const pad=Math.max((x1-x0),(y1-y0))*0.42+6;
    let vx=x0-pad, vy=y0-pad, vw=(x1-x0)+pad*2, vh=(y1-y0)+pad*2;
    const side=Math.max(vw,vh);
    vx-=(side-vw)/2; vy-=(side-vh)/2;
    // 자치구를 이 장사의 한 곳당 매출로 칠한다
    const agg={};
    if(S.zi&&S.zgu){
      const ix=S.zi.inds.indexOf(S.ind);
      if(ix>=0) for(const k in S.zi.zones){
        const g=S.zgu[k]; if(!g) continue;
        const row=(S.zi.zones[k].rows||[]).find(r=>r[0]===ix);
        if(!row||!row[1]||!row[2]) continue;
        const a=agg[g]||(agg[g]={s:0,n:0}); a.s+=row[2]; a.n+=row[1];
      }
    }
    const per={}; let mx=0;
    for(const g in agg){ const v=agg[g].s/agg[g].n; per[g]=v; if(v>mx) mx=v; }
    const involved={};
    list.forEach(o=>{ const g=(S.zgu&&S.zgu[o.id])||''; if(g) involved[g]=1; });
    return {
      ready:true,
      vb:vx.toFixed(2)+' '+vy.toFixed(2)+' '+side.toFixed(2)+' '+side.toFixed(2),
      stroke:(side/100*0.5).toFixed(2),
      legend:mx>0?[{label:'한 곳당 매출 낮음',op:'0.12'},{label:'보통',op:'0.4'},{label:'높음',op:'0.75'}]:[],
      legendNote:mx>0?'색이 진한 구일수록 이 장사의 가게 한 곳당 매출이 높아요. 데이터가 없는 구는 회색이에요.':'',
      gus:Object.keys(SM.gus).map(g=>{
        const v=per[g];
        return {d:SM.gus[g].d,
          fill:v!=null?'var(--accent)':'var(--surface)',
          op:v!=null?(0.1+0.68*(v/mx)).toFixed(2):'1',
          sw:involved[g]?(side/100*0.9).toFixed(2):(side/100*0.4).toFixed(2),
          sc:involved[g]?'var(--ink)':'var(--line-strong)'};
      }),
      pins:list.filter(o=>SM.pts[o.id]).map((o,i)=>{
        const p=SM.pts[o.id]||[50,50], on=o.id===selId;
        const rr=side/100*(on?3.2:2.5);
        return {n:i+1, name:this.zoneLabelOf(o.name), x:p[0], y:p[1], on:on,
          r:rr.toFixed(2), ty:(p[1]+rr*0.36).toFixed(2), fs:(rr*1.05).toFixed(2),
          fill:on?'var(--accent)':'var(--ink3)',
          chip:'flex:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:36px;transition:background .14s,color .14s;'
            +(on?'background:var(--accent);color:#FFFFFF;font-weight:600':'background:var(--surface);color:var(--ink2)'),
          pick:()=>this.setState({sel:o.id})};
      })
    };
  }

  // 정밀비교 — 한 자치구 안의 동네를 전부 표로 펼친다
  fineCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    const GU=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const gu=S.fcGu|| (S.zoneId&&zgu&&zgu[S.zoneId]) || '강남구';
    // 정렬 기준은 하나로 고정한다 — 네 가지를 고르게 하면 무엇을 보는 화면인지 흐려진다
    const sort='per';
    if(!zi||!zgu) return {gu:gu, guOptions:GU, onGu:()=>{}, ind:'', rows:[], lead:'', note:''};
    const idx=zi.inds.indexOf(S.ind);
    const list=[];
    for(const k in zi.zones){
      if(zgu[k]!==gu) continue;
      const rows=(zi.zones[k].rows||[]).filter(r=>r[1]&&r[2]);
      const mine=idx>=0? rows.find(r=>r[0]===idx) : null;
      if(!mine) continue;
      list.push({id:k, name:this.zoneLabelOf(zi.zones[k].nm), gu:this.guLabel(k),
        stores:mine[1], sales:mine[2], unit:mine[3], per:mine[2]/mine[1]});
    }
    const key={per:'per',sales:'sales',stores:'stores',unit:'unit'}[sort]||'per';
    list.sort((a,b)=>(b[key]||0)-(a[key]||0));
    const maxV=Math.max(...list.map(o=>o[key]||0),1);
    // 이 자치구의 중앙값 — 각 줄이 잘하는 쪽인지 못하는 쪽인지 견줄 기준.
    // 기준선이 없으면 금액만 71줄이라 어느 줄이 좋은 건지 읽히지 않는다.
    const perSorted=list.map(o=>o.per).sort((a,b)=>a-b);
    const medPer=perSorted.length?perSorted[Math.floor(perSorted.length/2)]:0;
    return {
      gu:gu, ind:this.indName(S.ind),
      guOptions:GU,
      onGu:e=>this.setState({fcGu:e.target.value}),
      lead: list.length
        ? gu+' 안의 '+list.length+'곳을 전부 줄 세웠어요'
        : gu+'에는 '+this.indName(S.ind)+' 데이터가 있는 동네가 없어요.',
      // 자치구 중앙값 — 화면 위에 기준선으로 적는다
      medLabel:list.length? this.fmt(medPer/3)+'원' : '',
      hasMed:list.length>0,
      rows:list.map((o,i)=>{
        // 가게가 2곳 이하면 '가게 한 곳당'이 사실상 그 한 가게의 실적이다.
        // 숫자를 지우지는 않고(값은 진짜다) 믿을 만한 정도를 함께 적는다.
        const thin=o.stores<=2;
        return {
        rank:i+1, name:o.name+(o.gu&&o.gu.indexOf('경계')>=0?' · '+o.gu:''),
        per:this.fmt(o.per/3)+'원',
        // 가게 수는 두 가지를 한 번에 말해준다 — 이 숫자를 믿어도 되는지, 경쟁이 얼마나 센지
        storeTag:o.stores.toLocaleString()+'곳'+(thin?' · 표본 적음':''),
        storeStyle:'flex:none;font-size:11.5px;white-space:nowrap;font-variant-numeric:tabular-nums;'
          +(thin?'color:var(--warn)':'color:var(--ink3)'),
        vsMed:medPer? (o.per>=medPer? '중앙값 이상':'중앙값 미만') : '',
        vsStyle:'flex:none;font-size:11.5px;white-space:nowrap;'
          +(medPer&&o.per>=medPer?'color:var(--good)':'color:var(--ink3)'),
        sales:this.fmt(o.sales)+'원',
        stores:o.stores.toLocaleString()+'개',
        unit:o.unit? o.unit.toLocaleString()+'원':'데이터 없음',
        bar:'display:block;width:'+Math.max((o[key]||0)/maxV*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*((o[key]||0)/maxV)).toFixed(2),
        pick:()=>this.setState({sel:o.id,screen:'diag'}),
        row:'display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer'
      };}),
      note:'비교분석은 담아 둔 몇 곳만, 정밀비교는 한 자치구 안을 빠짐없이 봐요. 막대와 금액은 가게 한 곳이 한 달에 파는 돈이에요. 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아니에요. 자치구는 동네 좌표로 계산해 붙였고, 경계에서 250m 안쪽인 곳은 두 구를 함께 적었어요 — 강남역처럼 강남대로를 경계로 서쪽이 서초구인 곳이 그래요. 건물 단위 임대료와 공실은 공개 데이터에 없어요.'
    };
  }

  // 지역비교 — 자치구 25개를 고른 장사 기준으로 묶어 비교한다
  zoneCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    if(!zi||!zgu) return {rows:[], cards:[], ind:'', lead:'', note:'', maxPer:1};
    const idx=zi.inds.indexOf(S.ind);
    if(idx<0) return {rows:[], cards:[], ind:this.indName(S.ind), lead:'', note:'', maxPer:1};
    const agg={};
    for(const k in zi.zones){
      const gu=zgu[k]; if(!gu) continue;
      const row=(zi.zones[k].rows||[]).find(r=>r[0]===idx);
      if(!row||!row[1]||!row[2]) continue;
      const a=agg[gu]||(agg[gu]={gu:gu,stores:0,sales:0,zones:0});
      a.stores+=row[1]; a.sales+=row[2]; a.zones++;
    }
    // 자치구별 유동인구도 합산한다 — 사람 수 대비 경쟁까지 보여주려고
    const pop={};
    if(S.zlp) for(const k in zi.zones){
      const gu=zgu[k]; if(!gu) continue;
      const lp=S.zlp[k]; if(!lp) continue;
      const p=pop[gu]||(pop[gu]={sum:0,n:0,seen:{}});
      if(!p.seen[lp.dong]){ p.seen[lp.dong]=1; p.sum+=lp.tot; p.n++; }
    }
    const list=Object.values(agg).map(a=>({...a,per:a.sales/a.stores,
      pop:pop[a.gu]?pop[a.gu].sum:null}));
    if(!list.length) return {rows:[], cards:[], ind:this.indName(S.ind), lead:'', note:'', maxPer:1};
    const maxPer=Math.max(...list.map(o=>o.per));
    const maxSales=Math.max(...list.map(o=>o.sales));
    list.sort((a,b)=>b.per-a.per);
    const top=list[0];
    return {
      ind:this.indName(S.ind),
      lead:this.indName(S.ind)+this.josa(this.indName(S.ind),'eun')+' '+top.gu+'가 가게 한 곳당 가장 많이 팔아요.',
      // 자치구 카드 — 옆으로 넘기며 본다
      cards:list.map((o,i)=>{
        const perM=o.per/3;
        const sat=o.pop? o.stores/(o.pop/10000) : null;
        const sats=list.map(x=>x.pop? x.stores/(x.pop/10000):null).filter(v=>v!=null).sort((a,b)=>a-b);
        const satMed=sats.length?sats[Math.floor(sats.length/2)]:null;
        const perAll=list.map(x=>x.per).sort((a,b)=>a-b);
        const perMed=perAll[Math.floor(perAll.length/2)];
        const diff=Math.round((o.per-perMed)/perMed*100);
        return {
          style:'flex:0 0 '+this.L('86%','300px','320px')+';scroll-snap-align:start;min-width:0;padding:20px;border-radius:20px;background:'+(i===0?'var(--accent-3)':'#F9FAFB'),
          rank:String(i+1).padStart(2,'0'), gu:o.gu,
          per:this.fmt(perM)+'원',
          verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요' : (diff<=-10? '중앙값보다 '+Math.abs(diff)+'% 낮아요' : '중앙값과 비슷해요')),
          facts:[
            {label:'가게 수', value:o.stores.toLocaleString()+'개', tag:'공공 집계'},
            {label:'데이터 있는 동네', value:o.zones+'곳', tag:'공공 집계'},
            {label:'손님이 쓴 돈 (3개월)', value:this.fmt(o.sales)+'원', tag:'공공 집계 · 카드'},
            (sat!=null
              ? {label:'사람 1만 명당 가게', value:sat.toFixed(1)+'개', tag:satMed!=null?(sat<=satMed*0.7?'여유':(sat<=satMed*1.3?'보통':'과밀')):'계산값'}
              : {label:'사람 1만 명당 가게', value:'데이터 없음', tag:'유동인구 미연결'})
          ],
          bar:'display:block;width:'+Math.max(o.per/Math.max(...list.map(x=>x.per))*100,3).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.45+0.55*(o.per/Math.max(...list.map(x=>x.per)))).toFixed(2)
        };
      }),
      rows:list.map((o,i)=>({
        rank:i+1, gu:o.gu,
        per:this.fmt(o.per/3)+'원',
        stores:o.stores.toLocaleString()+'개',
        zones:o.zones+'곳',
        bar:'display:block;width:'+Math.max(o.per/maxPer*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*(o.per/maxPer)).toFixed(2),
        salesBar:'display:block;width:'+Math.max(o.sales/maxSales*100,2).toFixed(1)+'%;height:100%;background:var(--line-strong);border-radius:3px',
        row:'display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line)'
      })),
      note:'막대는 가게 한 곳이 한 달에 파는 돈이에요. 자치구는 동네 좌표를 서울시 행정구역 경계와 대조해 붙였어요. 이 자료에는 동네별 매출 상위 15개 업종만 포함하니, 이 장사 데이터가 있는 동네만 합산했어요.'
    };
  }

  // 고른 지역 하나 — 그 자리에 기록이 있는 업종만 보여주고 여기서 업종을 고른다
  region(){
    const S=this.state, zi=S.zi;
    if(!zi||!S.zoneId||!zi.zones[S.zoneId]) return {name:'', sub:'', inds:[], stats:[], step:false,
      detail:{name:'',lead:'',facts:[],confirm:()=>{},back:()=>{}},
      trackStyle:'display:flex;width:200%', paneStyle:'width:50%;flex:none'};
    const z=zi.zones[S.zoneId];
    const rows=(z.rows||[]).filter(r=>r[1]&&r[2]);
    const totalStores=rows.reduce((a,r)=>a+r[1],0);
    const totalSales=rows.reduce((a,r)=>a+r[2],0);
    const maxPer=Math.max(...rows.map(r=>r[2]/r[1]),1);
    // 2단: 목록 → (왼쪽으로 밀림) → 상세에서 확정
    const openRow = S.regPick ? rows.find(r=>zi.inds[r[0]]===S.regPick) : null;
    const detail = openRow ? (()=>{
      const stores=openRow[1], sales=openRow[2], unit=openRow[3], per=sales/stores;
      const share=sales/totalSales*100;
      return {
        name:this.indName(S.regPick),
        lead:this.indName(S.regPick)+this.josa(this.indName(S.regPick),'eun')+' 이 동네에서 손님이 쓴 돈의 '+share.toFixed(1)+'%를 차지해요.',
        facts:[
          {label:'가게 한 곳이 한 달에 파는 돈', value:this.fmt(per/3)+'원', tag:'나눠서 낸 값 · 참고용'},
          {label:'가게 수', value:stores.toLocaleString()+'곳', tag:'실제 집계'},
          {label:'손님이 쓴 돈 (3개월)', value:this.fmt(sales)+'원', tag:'카드 결제 실제 집계'},
          {label:'결제 1건당 추정 금액', value:unit? unit.toLocaleString()+'원':'데이터 없음', tag:unit?'실제 집계':'정부 자료에 없어 점수에 넣지 않았습니다'}
        ],
        confirm:()=>this.setState({ind:S.regPick,sel:S.zoneId,screen:'find',openWhy:false,fromRegion:true,regPick:null}),
        back:()=>this.setState({regPick:null})
      };
    })() : {name:'',lead:'',facts:[],confirm:()=>{},back:()=>{}};

    return {
      step:!!S.regPick,
      detail:detail,
      trackStyle:'display:flex;width:200%;transition:transform .42s cubic-bezier(.22,.72,.24,1);'
        +'transform:translateX('+(S.regPick?'-50%':'0')+')',
      paneStyle:'width:50%;flex:none;padding-right:'+(S.regPick?'0':'0'),
      name:z.nm,
      sub:'이 동네에서 확인된 장사가 '+rows.length+'가지예요. 하나를 고르면 본전까지 계산해 드려요.',
      stats:[
        {label:'가게', value:totalStores.toLocaleString()+'곳', tag:'실제 집계'},
        {label:'손님이 쓴 돈 (3개월)', value:this.fmt(totalSales)+'원', tag:'카드 결제 실제 집계'},
        {label:'확인된 장사', value:rows.length+'가지', tag:'스냅샷에 포함된 상위 업종'}
      ],
      inds:rows.sort((a,b)=>b[2]-a[2]).map(r=>{
        const name=zi.inds[r[0]], per=r[2]/r[1];
        return {
          name:this.indName(name), stores:r[1].toLocaleString()+'곳', per:this.fmt(per/3)+'원',
          bar:'display:block;width:'+Math.max(per/maxPer*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*(per/maxPer)).toFixed(2),
          pick:()=>this.setState({regPick:name}),
          row:'display:flex;align-items:center;gap:14px;padding:15px 0;border-top:1px solid var(--line);cursor:pointer'
        };
      })
    };
  }

  // 괄호가 중복 설명이면 떼고 보여준다. 검색은 원래 이름으로 계속 걸린다.
  zoneLabelOf(nm){
    const m=String(nm||'').match(/^(.+?)\(([^()]+)\)$/);
    if(!m) return nm;
    const base=m[1].trim(), inner=m[2].trim();
    if(base.indexOf(inner)>=0 || inner.indexOf(base)>=0) return base;
    return base+' · '+inner;
  }

  // 통계 코드명을 사람이 쓰는 말로. 조회는 원래 이름(raw)으로 한다.
  indName(raw){
    const M={
      '커피-음료':'카페','호프-간이주점':'술집','한식음식점':'한식당','양식음식점':'양식당',
      '중식음식점':'중식당','일식음식점':'일식당','분식전문점':'분식집','제과점':'빵집',
      '치킨전문점':'치킨집','패스트푸드점':'패스트푸드','반찬가게':'반찬가게',
      '일반의원':'동네 의원','치과의원':'치과','한의원':'한의원','의약품':'약국',
      '일반교습학원':'학원','외국어학원':'어학원','예술학원':'예술 학원','스포츠 강습':'운동 강습',
      '미용실':'미용실','네일숍':'네일샵','피부관리실':'피부 관리실','세탁소':'세탁소',
      '편의점':'편의점','슈퍼마켓':'슈퍼','육류판매':'정육점','수산물판매':'생선 가게',
      '청과상':'과일 가게','안경':'안경점','화장품':'화장품 가게','의료기기':'의료기기 가게',
      '자동차수리':'자동차 정비소','부동산중개업':'부동산','pc방':'PC방','노래방':'노래방',
      '당구장':'당구장','골프연습장':'골프 연습장','스포츠클럽':'헬스장','애완동물':'애견숍',
      '문구':'문구점','서적':'책방','가전제품':'가전 매장','컴퓨터및주변장치판매':'컴퓨터 가게',
      '핸드폰':'휴대폰 매장','가방':'가방 가게','신발':'신발 가게','시계및귀금속':'금은방',
      '운동/경기용품':'스포츠용품점','완구':'장난감 가게','섬유제품':'섬유제품 가게','일반의류':'옷 가게',
      '자전거 및 기타운송장비':'자전거 가게','가구':'가구점','철물점':'철물점','조명용품':'조명 가게',
      '인테리어':'인테리어 가게','시계':'시계 가게','예술품':'화방','고인용품':'장례용품점',
      '전자상거래업':'온라인 판매','여관':'모텔','섬유제품 수선':'수선집','가정용세탁소':'세탁소'
    };
    if(M[raw]) return M[raw];
    // 남은 코드명은 군더더기만 덜어낸다
    return String(raw||'')
      .replace(/전문점$/,'집').replace(/음식점$/,'당').replace(/판매$/,' 가게')
      .replace(/-/g,' ').trim();
  }

  // 받침에 따라 조사를 고른다. 이/가 · 은/는 · 라면/이라면
  josa(word, kind){
    const s=String(word||''), c=s.charCodeAt(s.length-1)-0xAC00;
    const bat=(c>=0&&c<11172)? c%28!==0 : /[013678lmnr]$/i.test(s.slice(-1));
    if(kind==='eun') return bat?'은':'는';
    if(kind==='eul') return bat?'을':'를';
    if(kind==='ramyeon') return bat?'이라면':'라면';
    return bat?'이':'가';
  }

  // AI 도우미 — 이 서비스가 계산한 값만 근거로 답한다. 모델 호출 없음, 없는 값은 없다고 답한다.
  answer(q, r, sel){
    const t=(q||'').trim();
    const S=this.state;
    if(!t) return null;
    if(!r) return {text:'아직 데이터를 불러오지 못했습니다. 잠시 후 다시 물어봐 주세요.'};
    const L=r.list, top=L[0];
    const monthly=v=>this.fmt(v/3)+'원';
    if(/어디|추천|자리|후보/.test(t)) return {
      text:this.indName(S.ind)+this.josa(this.indName(S.ind),'ramyeon')+' '+top.name+this.josa(top.name,'eul')+' 먼저 보시면 좋아요.',
      facts:[{label:'기회점수',value:Math.round(top.score)+'점'},
             {label:'경쟁 가게',value:top.stores.toLocaleString()+'곳'},
             {label:'한 집당 월매출',value:monthly(top.per)}],
      source:'서울시 상권분석서비스 '+this.qtr(r.quarter)+' 공공 집계에서 계산했어요. 기회점수는 저희가 만든 값이에요.',
      cta:'후보지에서 전체 순위 보기', go:'find'
    };
    if(/임대료|월세|보증금|권리금/.test(t)) return {
      text:'임대료는 알려드릴 수 없어요.',
      source:'한국부동산원이 이 상권 체계로 임대료를 공표하지 않아 원자료에 없습니다. 지어내지 않습니다. 중개인에게 확인한 금액을 본전 계산에 직접 넣으시면 그 값으로 계산해 드립니다.',
      cta:'본전 계산으로 가기', go:'diag'
    };
    if(/본전|손익|얼마.*팔|매출.*필요/.test(t)){
      const c=this.calc(sel);
      return {
        text:sel.name+'에서 월 '+this.man(c.bep)+'을 팔면 본전이에요.',
        facts:[{label:'본전선',value:this.man(c.bep)},
               {label:'이 자리 평균',value:this.man(c.avg)},
               {label:'고정비',value:this.man(c.fixed)}],
        source:'임대료 '+this.man(c.rent)+' · 원가율 '+Math.round(c.cogs*100)+'% · '+c.area+'평 기준이에요. 조건을 바꾸면 값도 바뀌어요.',
        cta:'조건 바꿔 계산하기', go:'diag'
      };
    }
    if(/손님|누가|연령|나이|성별/.test(t)){
      const I=S.sbi&&S.sbi.ind?S.sbi.ind[S.ind]:null;
      if(!I) return {text:'이 장사의 손님 데이터가 없어요.'};
      const AL=['10대','20대','30대','40대','50대','60대+'];
      let hi=0; I.age.forEach((v,i)=>{ if(v>I.age[hi]) hi=i; });
      return {
        text:this.indName(S.ind)+'에 돈을 쓰는 사람은 '+AL[hi]+'가 가장 많아요.',
        facts:[{label:AL[hi],value:I.age[hi].toFixed(1)+'%'},
               {label:'여성',value:I.gender[1]+'%'},
               {label:'손님 1명이 쓰는 돈',value:I.unit.toLocaleString()+'원'}],
        source:'서울 전체 '+this.indName(S.ind)+' 카드 결제 기준이에요. 동네별 성별·연령은 공개되지 않아요.'
      };
    }
    if(/폐업|위험|망|개업/.test(t)){
      const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
      if(!R) return {text:'이 장사의 개·폐업 데이터가 없어요.'};
      return {
        text: this.indName(S.ind)+this.josa(this.indName(S.ind),'eun')+(R.closed>R.opened? ' 지금 가게가 줄고 있어요.' : ' 지금 가게가 늘고 있어요.'),
        facts:[{label:'문 닫은 곳',value:R.closed.toLocaleString()+'곳'},
               {label:'새로 연 곳',value:R.opened.toLocaleString()+'곳'},
               {label:'프랜차이즈',value:R.fr_share+'%'}],
        source:'3개월 기준이에요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 데이터가 구분하지 않아요.'
      };
    }
    return {
      text:'그 질문에는 답할 근거가 없어요.',
      source:'답할 수 있는 것은 업종별 기회 상권, 본전 계산, 손님 구성, 개·폐업 추이입니다. 임대료·권리금·건물 공실은 공개 통계에 없어 답하지 않습니다.'
    };
  }

  chat(){
    const S=this.state;
    const r=this.rank();
    const sel = r ? (S.sel? (r.list.find(o=>o.id===S.sel)||r.list[0]) : r.list[0]) : null;
    const log = S.chat || [{who:'ai', text:'안녕하세요. '+this.indName(S.ind)+' 기준으로 답해 드립니다. 궁금한 걸 물어보시거나 아래 버튼을 눌러 주세요.'}];
    const ask=q=>{
      const a=this.answer(q,r,sel);
      const next=[...log,{who:'me',text:q}];
      if(a) next.push({who:'ai',...a});
      this.setState({chat:next,draft:''},()=>this.scrollBot());
    };
    const CH=['어디가 좋아요?','본전은 얼마예요?','손님은 누가 와요?','임대료 알려줘요','폐업 많아요?'];
    return {
      msgs:log.map(m=>{
        const me=m.who==='me';
        return {
          row:'display:flex;'+(me?'justify-content:flex-end':'justify-content:flex-start'),
          bubble:'max-width:min(78%,520px);padding:'+(me?'13px 18px':'17px 20px')+';border-radius:'+(me?'18px 18px 5px 18px':'18px 18px 18px 5px')+';'
            +(me?'background:var(--accent);color:#FFFFFF':'background:var(--surface);color:var(--ink)'),
          textStyle:'font-size:15.5px;line-height:1.55;letter-spacing:-0.012em;text-wrap:pretty',
          text:m.text,
          hasFacts:!!(m.facts&&m.facts.length), facts:m.facts||[],
          hasSource:!!m.source, source:m.source||'',
          hasCta:!!m.cta, cta:m.cta||'',
          ctaGo:()=>this.setState({screen:m.go||'find'})
        };
      }),
      chips:CH.map(c=>({label:c, ask:()=>ask(c),
        style:'flex:none;font-size:13.5px;padding:9px 15px;border-radius:999px;background:var(--surface);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;transition:color .16s'})),
      draft:S.draft||'',
      onDraft:e=>this.setState({draft:e.target.value}),
      onKey:e=>{ if(e.key==='Enter'&&(S.draft||'').trim()) ask(S.draft.trim()); },
      send:()=>{ if((S.draft||'').trim()) ask(S.draft.trim()); },
      sendStyle:'flex:none;font-size:14.5px;font-weight:500;border:none;border-radius:12px;padding:0 18px;height:42px;cursor:pointer;transition:opacity .16s;'
        +((S.draft||'').trim()?'background:var(--accent);color:#FFFFFF':'background:transparent;color:var(--ink3)')
    };
  }

  renderVals(){
    const S=this.state, r=this.rank();
    // 화면을 옮길 때 이전 화면을 기록한다(뒤로가기용)
    const go=s=>()=>this.setState({screen:s,menu:null,
      hist:(S.screen&&S.screen!==s)?[...(S.hist||[]),S.screen].slice(-8):(S.hist||[])});
    // 헤더를 누르면 드롭다운이 열리고, 항목을 누르면 바로 그 화면으로 들어간다
    const MENU=[
      {label:'상권분석', keys:['hubZone','zone','find','cmp'], hub:'hubZone',
       items:[['zone','지역비교'],['find','후보지'],['cmp','비교분석']]},
      {label:'정밀분석', keys:['hubFine','fineIntro','map','fineCmp','region'], hub:'hubFine',
       items:[['fineIntro','정밀분석 소개'],['map','지도분석'],['fineCmp','정밀비교']]},
      {label:'시세분석', keys:['price'], hub:'price', items:[['price','시세분석']]},
      {label:'리포트', keys:['report'], hub:'report', items:[['report','리포트']]},

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
          : this.setState({screen:g.hub,menu:null,hist:[...(S.hist||[]),S.screen].slice(-8)}),
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
      goHome:()=>this.setState({screen:'home',menu:null,skip:false,
        hist:(S.screen&&S.screen!=='home')?[...(S.hist||[]),S.screen].slice(-8):(S.hist||[])}),
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
      aboutTabs:[
        {tab:'첫 화면', body:'장사를 고르면 서울 동네를 좋은 순서로 줄 세워요. 볼 동네가 있으면 위치도 함께 고르세요.'},
        {tab:'지역비교', body:'자치구 25개를 가게 한 곳당 매출로 비교해요. 어느 구부터 볼지 정할 때 써요.'},
        {tab:'후보지', body:'동네 순위와 점수 근거를 봅니다. 손님 수·경쟁 가게 수·한 곳당 매출로 쪼개 보여줍니다.'},
        {tab:'비교분석', body:'담은 동네를 최대 3곳까지 나란히 놓고 항목별로 비교합니다.'},
        {tab:'본전 계산', body:'평수와 임대료를 넣으면 월 얼마를 팔아야 본전인지, 하루 몇 건인지 계산합니다.'},
        {tab:'지도분석', body:'상위 후보를 지도에 놓고 서로의 위치를 봅니다.'},
        {tab:'정밀비교', body:'한 자치구 안의 동네를 전부 표로 펼쳐 훑습니다.'},
        {tab:'시세분석', body:'상가 임대료·빈 상가 비율·장사별 매출 추이를 분기별로 봅니다.'},
        {tab:'AI 도우미', body:'오른쪽 아래 버튼. 계산된 값만 근거로 답하고, 없는 값은 없다고 말합니다.'}
      ],
      aboutRows:[
        {title:'장사를 먼저 골라요',
         body:'보통은 동네를 고르고 그 동네가 어떤지 봐요. 여기는 거꾸로예요. 무슨 장사를 할지 말해 주시면 서울 동네를 좋은 순서대로 줄 세워 드려요.'},
        {title:'점수가 어떻게 나왔는지 보여드려요',
         body:'손님이 얼마나 쓰는지, 같은 가게가 몇 곳인지, 한 곳당 얼마 버는지. 이 세 가지를 합쳐 점수를 내요. 어느 항목 때문에 점수가 높은지 그 자리에서 보실 수 있어요.'},
        {title:'모르는 건 모른다고 써요',
         body:'임대료는 동네별로 공개되지 않아요. 그래서 비워 두고 직접 넣으시게 해요. 실제로 센 숫자와 나눠서 낸 숫자도 따로 표시해요.'}
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
        const chosen=P.filter(([k])=>partOn(k)).length;
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
                {label:'월 본전선 (이만큼 팔면 본전)', value:this.man(c.bep), tag:'계산값'},
                {label:'월매출 가정 ('+S.scen+')', value:this.man(c.rev), tag:'평균 추정치 × '+c.mult},
                {label:'월 임대료', value:(S.rent||0).toLocaleString()+'만원', tag:'입력값 또는 기본 가정'},
                {label:'평수', value:(S.area||0)+'평', tag:'입력값 또는 기본 가정'},
                {label:'인건비', value:this.man(c.labor), tag:'평수로 추정'},
                {label:'원가율', value:(S.cogs||0)+'%', tag:'기본 가정 · 수정 가능'}
              ]:null,
              survey:[
                ['가진 돈',S.rp_cash],['대출 비중',S.rp_loan],['버틸 기간',S.rp_runway],
                ['경험',S.rp_exp],['개업 시기',S.rp_when]
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
          exportDisabled:!reportSelection||chosen===0,
          title:'분석한 내용을 정리해 드립니다',
          sub:'지금 보고 있는 동네와 장사, 본전 계산까지 한 장으로 묶습니다. 화면에 없는 것만 물어봅니다.',
          target:(S.ind?this.indName(S.ind):'장사 미선택')+' · '+reportZone+' · 담을 항목 '+chosen+'개',
          // 리포트 화면에서도 장사와 위치를 바로 고를 수 있다
          // 선택 블록은 접어 두고 고른 값만 보여준다 — 펼치면 홈과 같은 방식
          openInd:S.rpEdit==='ind', openZone:S.rpEdit==='zone',
          editInd:()=>this.setState({rpEdit:S.rpEdit==='ind'?null:'ind'}),
          editZone:()=>this.setState({rpEdit:S.rpEdit==='zone'?null:'zone'}),
          indLabel:S.ind?this.indName(S.ind):'고르기',
          zoneLabel:reportZone,
          caretInd:'flex:none;font-size:15px;color:var(--ink3);display:inline-block;transition:transform .16s;transform:rotate('+(S.rpEdit==='ind'?'180deg':'0deg')+')',
          caretZone:'flex:none;font-size:15px;color:var(--ink3);display:inline-block;transition:transform .16s;transform:rotate('+(S.rpEdit==='zone'?'180deg':'0deg')+')',
          zoneSel:S.zoneId||'',
          zoneOptions:(()=>{
            const out=[{id:'',label:'동네 안 고름 (서울 전체)'}];
            if(!S.zi) return out;
            const idx=S.zi.inds.indexOf(S.ind);
            const list=[];
            for(const k in S.zi.zones){
              const row=idx>=0?(S.zi.zones[k].rows||[]).find(r=>r[0]===idx):null;
              if(!row||!row[1]||!row[2]) continue;
              list.push({id:k,label:this.zoneLabelOf(S.zi.zones[k].nm),n:row[2]/row[1]});
            }
            list.sort((a,b)=>b.n-a.n);
            return out.concat(list.slice(0,120).map(o=>({id:o.id,label:o.label})));
          })(),
          onZone:e=>{
            const id=e.target.value;
            if(!id){ this.setState({zoneId:null,homeZoneName:null,sel:null}); return; }
            const nm=S.zi&&S.zi.zones[id]?S.zi.zones[id].nm:'';
            this.setState({zoneId:id,homeZoneName:nm,sel:id});
          },
          parts:P.map(([k,label,desc])=>({
            label:label, desc:desc, on:partOn(k),
            toggle:()=>this.setState({['rp_p_'+k]:!partOn(k)}),
            style:'display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:14px;cursor:pointer;transition:background .14s;'
              +(partOn(k)?'background:var(--accent-3)':'background:var(--surface)'),
            check:'flex:none;width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;margin-top:2px;'
              +(partOn(k)?'background:var(--accent)':'background:var(--bg);box-shadow:inset 0 0 0 1.5px var(--line-strong)')
          })),
          // ── 창업 조건 — 한 번에 하나씩 묻는다 ────────────────────────────
          // 다섯 개를 한 화면에 늘어놓으면 '설문지'로 읽혀서 그냥 지나친다.
          // 하나씩 물으면 대답 하나가 화면 전체의 할 일이 되고, 답한 것은 위로 접힌다.
          // 계산에 실제로 쓰이거나 리포트에서 판단이 갈리는 것만 묻는다.
          ...(()=>{
            const QS=[
              {k:'cash',  q:'창업에 쓸 수 있는 돈은 얼마인가요?', hint:'권리금·보증금·인테리어를 다 합친 금액이에요',
               opts:['5천만원 미만','5천만~1억 미만','1억~2억 미만','2억 이상']},
              {k:'loan',  q:'그중 대출은 얼마나 되나요?', hint:'매달 나가는 이자가 본전선을 올려요',
               opts:['없음','절반 미만','절반 이상']},
              {k:'runway',q:'장사가 안 될 때 몇 달을 버틸 수 있나요?', hint:'매출 없이 월세·인건비를 낼 수 있는 기간이에요',
               opts:['3개월 미만','3~6개월 미만','6~12개월 미만','1년 이상']},
              {k:'exp',   q:'이 장사를 해본 적 있나요?', hint:'처음이면 지원사업 중 예비창업 쪽이 맞아요',
               opts:['처음','비슷한 일 해봤음','같은 장사 해봤음']},
              {k:'when',  q:'언제 문을 열 계획이세요?', hint:'공고 마감이 그 안에 있는지 봐 드려요',
               opts:['3개월 안','6개월 안','1년 안','아직 미정']}
            ];
            const val=k=>S['rp_'+k];
            // 다시 들어왔을 때 1번부터 또 묻지 않는다 — 아직 답 안 한 첫 질문에서 이어 한다.
            const firstOpen=QS.findIndex(q=>!val(q.k));
            const step=Math.max(0,Math.min(
              S.rp_step!=null ? S.rp_step : (firstOpen<0?QS.length:firstOpen), QS.length));
            const go=i=>()=>this.setState({rp_step:i});
            // 고를 것들 — 오른쪽에 붙는 '내가 할 말' 후보. 누르면 그대로 답 말풍선이 된다.
            const optStyle=on=>'display:inline-flex;align-items:center;justify-content:space-between;gap:10px;'
              +'max-width:82%;padding:12px 16px;border-radius:16px 16px 4px 16px;cursor:pointer;'
              +'font-size:14.5px;line-height:1.4;white-space:nowrap;'
              +'transition:background .14s,color .14s;'
              +(on?'background:var(--accent);color:#FFFFFF;font-weight:600'
                 :'background:var(--bg);color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line-strong)');
            const cur=step<QS.length?QS[step]:null;
            return {
              qsTitle: cur?'몇 가지만 여쭤볼게요':'조건을 다 알려주셨어요',
              qsSub: cur
                ? '리포트의 본전 계산과 아래 지원사업 추천에 씁니다. 건너뛰어도 돼요.'
                : '아래 지원사업이 이 조건으로 맞춰집니다. 누르면 고칠 수 있어요.',
              qsStep: cur? (step+1)+' / '+QS.length : '',
              hasStep: !!cur,
              qsBar: 'display:block;height:100%;border-radius:2px;background:var(--accent);'
                +'transition:width .3s cubic-bezier(.22,.7,.25,1);width:'
                +Math.round(step/QS.length*100)+'%',
              // 이미 답한 것 — 대화처럼 쌓인다. 질문은 왼쪽, 내 답은 오른쪽.
              // 답 버블을 누르면 그 질문으로 돌아가 고칠 수 있다.
              qsDone: QS.slice(0,step).map((q,i)=>({
                label:q.q, value:val(q.k)||'건너뜀',
                edit:go(i),
                askStyle:'align-self:flex-start;max-width:82%;font-size:14px;color:var(--ink2);'
                  +'background:var(--surface);border-radius:16px 16px 16px 4px;padding:11px 15px;'
                  +'line-height:1.5;text-wrap:pretty',
                ansStyle:'align-self:flex-end;max-width:82%;font-size:14.5px;font-weight:600;'
                  +'border-radius:16px 16px 4px 16px;padding:11px 15px;cursor:pointer;'
                  +'line-height:1.5;white-space:nowrap;transition:filter .14s;'
                  +(val(q.k)?'background:var(--accent);color:#FFFFFF'
                            :'background:var(--surface);color:var(--ink3)')
              })),
              hasDone: step>0,
              // 지금 묻는 것 하나
              hasCur: !!cur,
              curQ: cur?cur.q:'', curHint: cur?cur.hint:'',
              curOpts: cur?cur.opts.map(v=>({
                label:v, on:val(cur.k)===v,
                style:optStyle(val(cur.k)===v),
                pick:()=>this.setState({['rp_'+cur.k]:v, rp_step:step+1, rp_sent:false, rp_error:''})
              })):[],
              curSkip: cur?()=>this.setState({rp_step:step+1}):()=>{},
              curBack: step>0?go(step-1):null,
              hasBack: step>0,
              qsAllDone: !cur,
              qsRedo: go(0)
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
            const kw=[];
            if(S.rp_exp==='처음') kw.push('예비','창업','신규','초기');
            if(S.rp_loan&&S.rp_loan!=='없음') kw.push('융자','자금','대출','정책자금');
            const hit=it=>{
              if(!kw.length) return false;
              const t=((it.title||'')+' '+(it.target||'')+' '+(it.kind||'')).toLowerCase();
              return kw.some(k=>t.indexOf(k.toLowerCase())>=0);
            };
            const all=(d&&Array.isArray(d.items))?d.items:[];
            const matched=all.filter(hit), rest=all.filter(it=>!hit(it));
            const today=new Date(); today.setHours(0,0,0,0);
            const row=it=>{
              const dd=it.deadline?Math.round((new Date(it.deadline+'T00:00:00')-today)/86400000):null;
              return {
                title:it.title,
                sub:[it.org,it.kind,it.region].filter(Boolean).join(' · '),
                hasSub:!![it.org,it.kind,it.region].filter(Boolean).length,
                dday:dd==null?'상시 · 마감일 확인 필요':(dd===0?'오늘 마감':'D-'+dd),
                ddayStyle:'flex:none;font-size:12px;font-weight:600;white-space:nowrap;color:'
                  +(dd==null?'var(--ink3)':(dd<=7?'var(--warn)':'var(--ink2)')),
                url:it.url||'',
                hasUrl:!!it.url,
                style:'display:flex;align-items:flex-start;justify-content:space-between;gap:12px;'
                  +'padding:14px 16px;border-radius:14px;background:var(--surface)'
              };
            };
            return {
              loading:!d,
              notConfigured:!!d&&d.configured===false,
              failed:!!d&&d.configured!==false&&!d.ok,
              ready:!!d&&!!d.ok,
              message:d?(d.error||''):'',
              retry:()=>{this._spLoading=false;this.setState({sp:null});},
              // 조건을 아직 안 골랐으면 '추린 목록'이라고 하지 않는다
              hasFilter:kw.length>0,
              headline:kw.length
                ? '고른 조건에 해당할 수 있는 제도 '+matched.length+'건'
                : '지금 접수 중인 공고 '+all.length+'건',
              subline:kw.length
                ? '마감이 지난 공고는 빼고 마감이 가까운 순으로 놓았어요.'
                : '위에서 조건을 고르면 해당할 수 있는 것부터 보여드려요.',
              matched:matched.slice(0,20).map(row),
              hasMatched:kw.length>0&&matched.length>0,
              noMatch:kw.length>0&&matched.length===0,
              rest:(kw.length?rest:all).slice(0,50).map(row),
              hasRest:(kw.length?rest.length:all.length)>0,
              restLabel:kw.length
                ? '조건에 안 걸린 나머지 '+rest.length+'건도 보기'
                : '전체 목록 보기',
              empty:!!d&&!!d.ok&&all.length===0,
              // 자격 판정이 아니라는 것을 매번 붙인다. 이 화면은 돈을 다룬다.
              warn:'자격을 판정한 목록이 아니에요. 실제 신청 자격은 업력·매출·지역·업종·소상공인 여부에 따라 다르고 '
                +'공고마다 조건이 달라요. 여기 있는 건 조건에 해당할 수 있는 공고이고, '
                +'신청 가능 여부는 반드시 원문에서 확인해 주세요.'
                +((d&&d.undated)?' 마감일을 읽지 못한 공고 '+d.undated+'건이 섞여 있어요(상시 모집일 수 있어요).':'')
                +((d&&d.expired)?' 마감이 지난 '+d.expired+'건은 뺐어요.':'')
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
            return {
              has:true, empty:false,
              eyebrow:this.indName(S.ind)+' · '+this.zoneLabelOf(sel.name)
                +(S.zi?' · '+this.qtr(S.zi.quarter):''),
              // 결론 한 줄 — 큰 숫자는 '한 달에 얼마를 팔아야 하는가'다
              bep:this.man(c.bep),
              bepNote:'한 달에 이만큼 팔면 본전이에요',
              // 판정 — 넘는지 모자라는지. 색으로 바로 읽히게.
              verdict:over
                ? '예상 매출이 본전선을 '+this.man(gap)+' 넘어요'
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
              // 이 리포트가 모르는 것 — 정직하게 남긴다
              unknowns:[
                '이 동네의 실제 임대료. 상가 임대차는 신고 의무가 없어 공개되지 않아요.',
                '내가 낼 가게의 매출. 화면의 매출은 동네 전체를 가게 수로 나눈 평균이에요.',
                '권리금·인테리어·초기 재고. 자리마다 달라 계산에 넣지 않았어요.'
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
        .map(v=>({v:v, label:v+(v==='서울특별시'?'':' · 준비 중')})),
      onSido:e=>this.setState({sido:e.target.value}),
      sidoReady:(S.sido||'서울특별시')==='서울특별시',
      sidoWait:(S.sido||'서울특별시')!=='서울특별시',
      backToSeoul:()=>this.setState({sido:'서울특별시'}),
      sidoNote:'‘'+(S.sido||'서울특별시')+'’ 자료는 아직 없습니다. 지금 계산에 쓰는 자료는 서울시 상권분석서비스라 서울 1,564곳만 담고 있습니다. 전국은 소상공인시장진흥공단 상권정보로 갈아타야 하고, 상권 구획과 업종 코드가 달라 매칭이 필요합니다.',
      onFind:S.screen==='find', onDiag:S.screen==='diag', onCmp:S.screen==='cmp',
      // 어느 장사를 보고 있는지 화면에서 바로 보이고 바꿀 수 있게 한다
      indSel:S.ind,
      selectStyle:'font-size:15px;font-weight:500;color:var(--ink);background:var(--surface);border:none;border-radius:12px;padding:0 14px;height:44px;cursor:pointer;outline:none;max-width:200px',
      indOptions:(S.zi?S.zi.inds:[]).map(n=>({raw:n,label:this.indName(n)}))
        .sort((a,b)=>a.label.localeCompare(b.label,'ko')),
      onIndSel:e=>this.setState({ind:e.target.value,sel:null,picks:null,fromRegion:false}),
      onReport:S.screen==='report',
      onPrice:S.screen==='price',
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
      onHub:S.screen==='hubZone'||S.screen==='hubFine',
      hub:(()=>{
        const zone = S.screen==='hubZone';
        const g = MENU.find(m=>m.hub===S.screen);
        const DESC={
          zone:'어디가 좋은지 찾는 단계예요. 동네를 넓게 훑고 후보를 골라요.',
          fine:'고른 후보에 실제로 들어가도 되는지 확인하는 단계예요.'
        };
        const CARD={
          zone:{'지역비교':'자치구로 묶어 넓게 봐요','후보지':'장사를 고르면 좋은 순서로 줄 세워요','비교분석':'최대 5곳을 항목별로 나란히 놓아요'},
          fine:{'정밀분석 소개':'후보지 분석과 무엇이 다른지 알려드려요','지도분석':'고른 후보를 수요·경쟁·매출로 검증해요','정밀비교':'한 자치구 안의 동네를 전부 훑어요'}
        };
        const k = zone?'zone':'fine';

        // ── 지금 무엇을 보고 있는지 ──────────────────────────────
        // 허브가 어느 상황에서나 똑같은 안내문만 띄우면 '거쳐 가는 화면'이 된다.
        // 고른 업종·자리를 적어 주면 이 단계가 내 얘기가 된다.
        const selId = S.sel || S.zoneId;
        const selNm = (selId && S.zi && S.zi.zones[selId]) ? this.zoneLabelOf(S.zi.zones[selId].nm) : null;
        const lp = (selId && S.zlp) ? S.zlp[selId] : null;
        const nPicks = (S.picks||[]).length;

        // 정밀비교가 훑을 자치구와 그 안에서 이 장사 데이터가 있는 동네 수
        const fcGu = S.fcGu || (selId && S.zgu && S.zgu[selId]) || '강남구';
        let fcN = 0;
        if (S.zi && S.zgu) {
          const ii = S.zi.inds.indexOf(S.ind);
          if (ii >= 0) for (const kk in S.zi.zones) {
            if (S.zgu[kk] !== fcGu) continue;
            if ((S.zi.zones[kk].rows||[]).some(r => r[0]===ii && r[1] && r[2])) fcN++;
          }
        }
        const r = this.rank();

        // 카드마다 '지금 값'을 하나씩. 값이 없으면 지어내지 않고 무엇을 하면 되는지 적는다.
        const STAT = {
          '지역비교':  r ? {v:'25개', t:'서울 자치구를 '+this.indName(S.ind)+' 기준으로 견줘요'}
                         : {v:'—', t:'데이터를 불러오는 중이에요'},
          '후보지':    r ? {v:r.covered.toLocaleString()+'곳', t:'이 장사 데이터가 있는 동네 (전체 '+r.total.toLocaleString()+'곳 중)'}
                         : {v:'—', t:'데이터를 불러오는 중이에요'},
          '비교분석':  nPicks ? {v:nPicks+'곳', t:'담아 둔 자리 · 최대 5곳까지 나란히 놓아요'}
                             : {v:'0곳', t:'아직 담은 자리가 없어요. 후보지에서 담아 보세요'},
          '정밀분석 소개': {v:'', t:'후보지 분석과 무엇이 다른지 알려드려요'},
          '지도분석':  lp ? {v:Math.round(lp.tot).toLocaleString()+'명', t:(selNm||'고른 자리')+' 하루 유동인구 · 여기서 수요·경쟁·매출을 검증해요'}
                          : {v:selNm?'데이터 없음':'자리 미선택', t:selNm?(selNm+'의 유동인구 자료가 없어요'):'후보지에서 자리를 고르면 그 자리를 검증해요'},
          '정밀비교':  fcN ? {v:fcN+'곳', t:fcGu+' 안에서 '+this.indName(S.ind)+' 데이터가 있는 동네를 전부 줄 세워요'}
                          : {v:'0곳', t:fcGu+'에는 '+this.indName(S.ind)+' 데이터가 있는 동네가 없어요'}
        };

        // 다음에 눌러야 할 카드 하나만 강조한다. 셋 다 강조하면 아무것도 강조되지 않는다.
        const next = zone ? (nPicks ? '비교분석' : '후보지')
                          : (selNm ? '지도분석' : '정밀비교');

        return {
          eyebrow: zone ? '1단계 · 넓게 훑기' : '2단계 · 좁혀서 검증',
          title: zone?'상권분석':'정밀분석',
          desc: DESC[k],
          // 지금 조건 — 없으면 칩을 아예 안 그린다(빈 칩을 남기지 않는다)
          hasCtx: true,
          ctx: [
            {label:'무슨 장사', value:this.indName(S.ind)},
            ...(selNm ? [{label:'고른 자리', value:selNm}] : []),
            ...(r ? [{label:'기준', value:this.qtr(S.zi&&S.zi.quarter)}] : [])
          ].map(c=>({...c,
            style:'display:inline-flex;align-items:baseline;gap:7px;padding:7px 13px;border-radius:999px;'
              +'background:var(--bg);white-space:nowrap;min-width:0'})),
          cards:(g?g.items:[]).map(([key,label])=>{
            const st=STAT[label]||{v:'',t:''};
            const on=label===next;
            // '자리 미선택'·'데이터 없음'은 숫자가 아니다. 숫자 크기로 쓰면 값처럼 읽힌다.
            const isNum=/\d/.test(st.v);
            return {
              label:label, sub:CARD[k][label]||'',
              stat:st.v, statNote:st.t, hasStat:!!st.v,
              statStyle:isNum
                ? 'font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1.1;'
                  +'font-variant-numeric:tabular-nums;'+(on?'color:var(--accent)':'color:var(--ink)')
                : 'font-size:15px;font-weight:500;line-height:1.3;color:var(--ink3)',
              labelStyle:'font-size:15px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;'
                +'overflow:hidden;text-overflow:ellipsis;'+(on?'color:var(--accent)':'color:var(--ink)'),
              badge: on ? '다음 단계' : '',
              hasBadge: on,
              go:()=>this.setState({screen:key,menu:null,hist:[...(S.hist||[]),S.screen].slice(-8)}),
              style:'display:flex;flex-direction:column;gap:10px;min-height:158px;padding:22px;'
                +'border-radius:18px;cursor:pointer;min-width:0;'
                +'transition:transform .18s cubic-bezier(.2,.7,.3,1),background .18s;'
                +(on?'background:var(--accent-3);border:1px solid var(--accent-2)'
                    :'background:var(--surface);border:1px solid var(--line)')
            };
          })
        };
      })(),
      goFind:go('find'), goDiag:go('diag'), goCmp:go('cmp'),
      goAbout:()=>this.setState({screen:'home',menu:null,notice:true}),
      // 정밀분석으로 갈 때 지도 필터를 고른 자리의 자치구로 맞춘다
      goMap:()=>this.setState({screen:'map',menu:null,
        mapGu:(S.sel&&S.zgu&&S.zgu[S.sel])||'서울 전체',
        hist:(S.screen&&S.screen!=='map')?[...(S.hist||[]),S.screen].slice(-8):(S.hist||[])}),
      goFineCmp:go('fineCmp'),
      // 다시 열면 보낸 상태가 남아 있지 않게 초기화한다
      openReport:()=>this.setState({screen:'report',rp_sent:false,hist:[...(S.hist||[]),S.screen].slice(-8)}),
      themeLabel: (typeof document!=='undefined' && document.documentElement.getAttribute('data-theme')==='dark')?'밝게':'어둡게',
      toggleTheme:()=>{ const h=document.documentElement, d=h.getAttribute('data-theme')==='dark';
        h.setAttribute('data-theme',d?'light':'dark'); this.forceUpdate(); },
      q:S.q, onQ:e=>this.setState({q:e.target.value,openMore:false}),
      chips:names.slice(0,5).map(n=>({name:this.indName(n), pick:()=>this.setState({ind:n,sel:null,picks:null,openWhy:false,openMore:false,fromRegion:false}),
        style:chipBase+'flex:none;'+(n===S.ind?'background:var(--ink);color:var(--bg);font-weight:500':'background:var(--surface);color:var(--ink)')})),
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

      // 지역 화면에서 업종을 이미 골라 왔으면 질문이 아니라 확인으로 말한다
      findTitle: S.fromRegion
        ? this.indName(S.ind)+' 기준으로 보고 있습니다'
        : '어떤 장사를 하실 건가요?',

      findSub: S.fromRegion
        ? '바꾸려면 아래에서 다른 업종을 고르세요.'
        : '손님 많고 경쟁 적은 자리를 찾아드려요.',
      bp:this.bp(),
      icoX:this.ui('x'), icoChevron:this.ui('chevronRight'), icoBack:this.ui('arrowLeft'),
      icoPin:this.ui('mapPin'),
      headerStyle:'position:sticky;top:0;z-index:50;height:'+this.L('56px','60px','64px')+';display:flex;align-items:center;'
        +'background:var(--bg-blur);backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);'
        +'border-bottom:1px solid rgba(0,0,0,.05);transition:all .2s ease-in-out',
      headerInner:'width:100%;max-width:'+this.L('100%','720px','760px')+';margin:0 auto;padding:0 '+this.L('16px','24px','32px')+';display:flex;align-items:center;gap:'+this.L('12px','20px','28px'),
      // 칸을 1080 으로 잡아 놨는데 안의 내용은 전부 600~660 으로 묶여 있어
      // 오른쪽 400px 이 늘 비어 있었다("왜 다 왼쪽에 있어"). 칸을 내용에 맞춘다.
      // 넓히는 쪽이 아니라 좁히는 쪽으로 맞춘 이유: 620px 짜리 본문을 1080 으로 늘리면
      // 한 줄이 너무 길어져 읽기 어려워진다.
      mainStyle:'max-width:'+this.L('100%','720px','760px')+';margin:0 auto;padding:0 '+this.L('16px','24px','32px')+' '+this.L('80px','110px','130px'),
      dataError:S.err, retryData:()=>location.reload(),
      ...this.home(),
      ai:this.chat(),
      // 오른쪽 아래에서 접었다 폈다 — 어느 화면에서나 쓸 수 있다
      botOpen:!!S.bot, botClosed:!S.bot,
      botToggle:()=>this.setState({bot:!S.bot},()=>{ if(!S.bot) this.scrollBot(); }),
      botPanel:'position:fixed;z-index:70;display:flex;flex-direction:column;background:var(--bg);'
        +'border-radius:'+this.L('20px 20px 0 0','20px','20px')+';box-shadow:0 24px 60px rgba(0,0,0,.22);'
        +'animation:botIn .26s cubic-bezier(.22,.72,.24,1) both;'
        +this.L('left:0;right:0;bottom:0;height:78vh;','right:20px;bottom:20px;width:372px;height:min(560px,78vh);','right:28px;bottom:28px;width:392px;height:min(580px,76vh);'),
      botCloseStyle:'flex:none;width:28px;height:28px;border-radius:50%;background:var(--surface);color:var(--ink2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s',
      botFab:'position:fixed;z-index:70;display:inline-flex;align-items:center;gap:8px;padding:0 16px;height:44px;border-radius:999px;'
        +'background:var(--bg);color:var(--accent);border:1px solid var(--line-strong);cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.06);'
        +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
        +this.L('right:16px;bottom:16px;','right:20px;bottom:20px;','right:28px;bottom:28px;'),
      // CTA 체계 — 주 행동 하나만 강조한다
      ctaPrimary:'font-size:16px;font-weight:600;color:#FFFFFF;background:var(--accent);border:none;border-radius:16px;padding:0 26px;height:54px;cursor:pointer;box-shadow:0 6px 16px -6px rgba(0,0,0,.18);transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1)',
      ctaText:'font-size:14.5px;color:var(--accent);cursor:pointer;white-space:nowrap',
      prosCols:this.L('1fr','1fr 1fr','1fr 1fr'),
      // 뒤로가기 — 화면 이동 기록을 쌓아 되돌린다
      // 홈에는 뒤로가기를 두지 않는다 — 홈이 시작점이라 '← 상권분석'이 무엇으로 돌아가는지 읽히지 않는다
      canBack:(S.hist||[]).length>0 && S.screen!=='home',
      backLabel:(()=>{
        const NM={find:'후보지',diag:'본전 계산',cmp:'비교분석',map:'지도분석',fineCmp:'정밀비교',
          fineIntro:'정밀분석 소개',zone:'지역비교',price:'시세분석',report:'리포트',region:'동네',home:'처음',hubZone:'상권분석',hubFine:'정밀분석'};
        const h=S.hist||[];
        return h.length? '← '+(NM[h[h.length-1]]||'이전') : '';
      })(),
      goBack:()=>{
        const h=[...(S.hist||[])];
        const prev=h.pop();
        if(prev) this.setState({screen:prev,hist:h,menu:null});
      },
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
        sub: S.err? '잠시 후 다시 열어 주세요.':'', cols:[], diffs:[], honesty:'', empty:true, on:false};
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
        metrics:{has:false,rows:[],seoul:[],missing:[],note:''},
        pros:{good:[],care:[]}, vs:{rows:[],note:''}, sections:[],
        compMap:{has:false,dots:[],fr:0,own:0,total:0,inner:0,lead:'',note:''},
        gu:'서울 전체', guOptions:['서울 전체'], onGu:()=>{},
        list:[], cta:'후보지 찾기', honesty:''};
      return out;
    }

    const L=r.list;
    // 홈에서 고른 지역이 이 업종에 기록이 있으면 그 자리를 먼저 보여준다
    const fromHome = (!S.sel && S.homeZone) ? L.find(o=>o.name===S.homeZone) : null;
    const sel = S.sel ? (L.find(o=>o.id===S.sel)||L[0]) : (fromHome||L[0]);
    const PICKS = S.picks || L.slice(0,3).map(o=>o.id);
    // 비교 담기 — 빼기만 가능하면 되돌릴 수 없으므로 목록·결론 양쪽에 토글을 둔다
    const pickToggle=o=>()=>{
      const p=[...PICKS], i=p.indexOf(o.id);
      if(i>=0) p.splice(i,1); else if(p.length<5) p.push(o.id);
      this.setState({picks:p});
    };
    const pickLabelOf=o=>{
      const inP=PICKS.indexOf(o.id)>=0;
      return inP? '비교에서 빼기' : (PICKS.length>=5? '비교 5곳 꽉 찼음' : '비교에 담기 ('+PICKS.length+'/5)');
    };
    const monthly=v=>this.fmt(v/3)+'원';
    const grade=sc=>sc>=75?['매우 유망','var(--good)']:(sc>=60?['괜찮음','var(--good)']:(sc>=45?['보통','var(--ink2)']:['조심','var(--warn)']));

    // ── 결론
    const g=grade(sel.score);
    const fewer=Math.max(Math.round(100-sel._stores),1), more=Math.max(Math.round(100-sel._sales),1);
    // 백분위가 낮으면 그 항목은 강점이 아니다 — 부호와 문장을 값에서 끌어낸다
    // 최상급은 진짜 1위 한 곳에만 쓴다. 백분위 99.9도 2위일 수 있다.
    const demandTop = sel.sales===Math.max(...L.map(o=>o.sales));
    const demandLine = sel._sales>=60
      ? {sign:'↑', arrow:arrowUp, text:demandTop? '상권 전체 매출이 서울에서 가장 높습니다' : '상권 전체 매출이 높습니다 · 서울 상위 '+more+'%'}
      : (sel._sales>=40
        ? {sign:'↑', arrow:arrowUp, text:'상권 전체 매출은 중간 수준입니다 · 서울 상위 '+more+'%'}
        : {sign:'↓', arrow:arrowDn, text:'손님이 적습니다 · 서울 상위 '+more+'%'});
    const compLine = sel._stores>=60
      ? {sign:'↑', arrow:arrowUp, text:'경쟁이 적습니다 · 같은 가게 '+sel.stores.toLocaleString()+'곳'}
      : (sel._stores>=40
        ? {sign:'↑', arrow:arrowUp, text:'경쟁은 보통입니다 · 같은 가게 '+sel.stores.toLocaleString()+'곳'}
        : {sign:'↓', arrow:arrowDn, text:'경쟁이 치열합니다 · 같은 가게 '+sel.stores.toLocaleString()+'곳'});
    out.t={
      eyebrow:this.indName(S.ind)+' · '+r.covered.toLocaleString()+'곳 중 '+(L.indexOf(sel)+1)+'위'
        +((S.homeZone&&!S.sel)? (fromHome? ' · 홈에서 고른 지역' : ' · '+S.homeZone+this.josa(S.homeZone,'eun')+' 이 장사 기록이 없어 1위를 보여드립니다') : ''),
      name:sel.name, score:Math.round(sel.score),
      grade:g[0], gradeStyle:'font-size:17px;font-weight:600;color:'+g[1]+';white-space:nowrap',
      togglePick:pickToggle(sel), pickLabel:pickLabelOf(sel),
      factors:[
        demandLine,
        compLine,
        sel.stores<=5
          ? {sign:'↓', arrow:arrowDn, text:'가게가 너무 적어 평균이 흔들립니다'}
          : {sign:'↓', arrow:arrowDn, text:'임대료는 데이터 없음 · 직접 확인해야 합니다'}
      ],
      // 표본이 적으면 단정하지 않는다. 10곳 미만은 참고용으로 돌린다.
      thin:sel.stores<10,
      thinWarn: sel.stores<10
        ? '표본 '+sel.stores.toLocaleString()+'곳이라 참고용으로 봐주세요. 가게가 적으면 한 곳의 실적이 평균을 크게 흔들어요.'
        : '',
      thinBadge: sel.stores<10? '표본 '+sel.stores.toLocaleString()+'곳' : '',
      // 결론 먼저 — 점수는 기준선과 함께
      verdict:(()=>{
        if(sel.stores<10) return '판단하기엔 데이터가 적어요.';
        const scores=L.map(o=>o.score).sort((a,b)=>a-b);
        const med=scores[Math.floor(scores.length/2)];
        const rank=L.indexOf(sel)+1, pct=Math.round(rank/L.length*100);
        return sel.score>=med*1.15? this.zoneLabelOf(sel.name)+'은 '+this.indName(S.ind)+' 후보로 괜찮아요.'
          : (sel.score>=med*0.9? '한 번 더 살펴볼 만해요.' : '서울 중앙값보다 아쉬운 자리예요.');
      })(),
      pctText:(()=>{ const rank=L.indexOf(sel)+1; return '서울 상위 '+Math.max(Math.round(rank/L.length*100),1)+'%'; })(),
      medText:(()=>{ const s=L.map(o=>o.score).sort((a,b)=>a-b); return Math.round(s[Math.floor(s.length/2)])+'점'; })(),
      pctFine:(()=>{ const r=(L.indexOf(sel)+1)/L.length*100; return '서울 상위 '+(r<1?r.toFixed(1):Math.round(r))+'%'; })(),
      scoreBar:(()=>{
        const mx=Math.max(...L.map(o=>o.score),1);
        return 'display:block;width:'+(sel.score/mx*100).toFixed(1)+'%;height:100%;border-radius:5px;background:var(--accent)';
      })(),
      scoreMed:(()=>{
        const s=L.map(o=>o.score).sort((a,b)=>a-b);
        const med=s[Math.floor(s.length/2)], mx=Math.max(...L.map(o=>o.score),1);
        return 'position:absolute;top:-5px;bottom:-5px;left:'+(med/mx*100).toFixed(1)+'%;width:2px;background:var(--ink);border-radius:1px';
      })(),
      // 해석 먼저, 숫자 나중, 표본 수 함께
      reasons:(()=>{
        const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
        const hs=n=>'font-size:19px;font-weight:700;letter-spacing:-0.02em;margin-top:6px;color:'+n;
        const lp=S.zlp&&S.zlp[sel.id];
        const salesWord=sel._sales>=60?['높은 편이에요','var(--good)']:(sel._sales>=40?['보통이에요','var(--ink)']:['적은 편이에요','var(--warn)']);
        const compWord=sel._stores>=60?['여유가 있어요','var(--good)']:(sel._stores>=40?['보통이에요','var(--ink)']:['치열해요','var(--warn)']);
        const stab=R? (R.closed>R.opened?['가게가 줄고 있어요','var(--warn)']:['가게가 늘고 있어요','var(--ink)']) : ['데이터 없음','var(--ink3)'];
        return [
          {q:'이 동네 가게들은 얼마나 벌고 있나요?',
           head:salesWord[0], headStyle:hs(salesWord[1]),
           body:'비슷한 가게 한 곳이 한 달에 '+this.fmt(sel.per/3)+'원쯤 팔아요.',
           sample:'표본 '+sel.stores.toLocaleString()+'곳'+(sel.stores<10?' · 적어서 참고용으로 봐주세요':'')},
          {q:'경쟁이 얼마나 치열한가요?',
           head:compWord[0], headStyle:hs(compWord[1]),
           body:'같은 장사가 '+sel.stores.toLocaleString()+'곳 있어요.'+(lp?' 사람 1만 명당 '+(sel.stores/(lp.tot/10000)).toFixed(1)+'개예요.':''),
           sample:lp?'유동인구 '+Math.round(lp.tot).toLocaleString()+'명 · '+lp.dong:'유동인구 데이터 없음'},
          {q:'가게가 오래 버티고 있나요?',
           head:stab[0], headStyle:hs(stab[1]),
           body:R? '서울 전체에서 3개월 동안 '+R.opened.toLocaleString()+'곳이 열고 '+R.closed.toLocaleString()+'곳이 닫았어요.' : '이 장사의 개·폐업 데이터가 없어요.',
           sample:R? '서울 전체 '+R.stores.toLocaleString()+'곳 기준' : '표본을 알 수 없어 점수에 넣지 않았어요'}
        ].map((r,i,a)=>({...r,
          step:(i+1)+' / '+a.length,
          cardStyle:'flex:0 0 '+this.L('84%','300px','320px')+';scroll-snap-align:start;min-width:0;padding:20px;border-radius:20px;background:var(--surface);display:flex;flex-direction:column'}));
      })(),
      parts:[
        {label:'손님이 많다', meaning:demandTop?'서울 최다':'상위 '+more+'%', bar:'width:'+sel._sales.toFixed(1)+'%;height:100%;background:var(--accent);border-radius:3px'},
        {label:'경쟁이 적다', meaning:'적은 쪽 '+fewer+'%', bar:'width:'+sel._stores.toFixed(1)+'%;height:100%;background:var(--accent-2);border-radius:3px'},
        {label:'한 집당 잘 번다', meaning:monthly(sel.per)+'/월', bar:'width:'+sel._per.toFixed(1)+'%;height:100%;background:var(--accent-3);border-radius:3px'}
      ]
    };
    out.rows=L.slice(1,6).map((o,i)=>({
      rank:i+2, name:o.name, score:Math.round(o.score),
      // 두 백분위 중 더 두드러진 쪽을 그 자리의 성격으로 쓴다 — 같은 말이 반복되지 않게
      meaning: o.stores<=5 ? '가게 '+o.stores+'곳뿐'
        : (Math.abs(o._sales-o._stores)<8 ? '손님·경쟁 균형'
          : (o._sales>o._stores ? '상권 매출 상위 '+Math.round(100-o._sales)+'%' : '경쟁 적은 쪽 '+Math.round(100-o._stores)+'%')),
      pick:()=>this.setState({sel:o.id}),
      togglePick:pickToggle(o),
      // 가로 카드 — 스냅으로 한 장씩 멈춘다
      no:String(L.indexOf(o)+1).padStart(2,'0'),
      // 975곳 중 2위와 6위가 모두 '상위 1%'로 눌려 구분이 사라졌다 — 순위로 쓴다
      pct:L.length.toLocaleString()+'곳 중 '+(L.indexOf(o)+1)+'위',
      gu:this.guLabel(o.id)||'',
      cardStyle:'flex:0 0 '+this.L('82%','260px','268px')+';scroll-snap-align:start;min-width:0;padding:18px;border-radius:18px;'
        +'transition:box-shadow .16s,background .16s;'
        +(o.id===sel.id
          ? 'background:var(--accent-3);box-shadow:inset 0 0 0 1.5px var(--accent)'
          : 'background:var(--surface)'),
      pickLabel: PICKS.indexOf(o.id)>=0 ? '비교에서 빼기' : (PICKS.length>=5? '비교 5곳 꽉 찼어요' : '비교에 담기'),
      pickStyle: PICKS.indexOf(o.id)>=0
        ? 'font-size:12.5px;color:var(--accent);cursor:pointer;white-space:nowrap;font-weight:600'
        : (PICKS.length>=5
          ? 'font-size:12.5px;color:var(--ink3);white-space:nowrap'
          : 'font-size:12.5px;color:var(--ink3);cursor:pointer;white-space:nowrap'),
      row:'display:flex;align-items:baseline;gap:12px;padding:13px 0;border-top:1px solid var(--line)'
    }));
    out.honesty='기준 '+this.qtr(r.quarter)+' · 서울시 상권분석서비스. 기회점수는 손님이 쓴 돈·경쟁 가게 수·한 곳당 매출을 저희가 정한 비율로 합친 계산값이에요. 서울 '+r.total.toLocaleString()+'개 동네 중 이 장사 데이터가 있는 '+r.covered.toLocaleString()+'곳만 견줬어요. 임대료는 동네별로 공개되지 않아 점수에 넣지 못했어요.';

    // ── 진단
    const c=this.calc(sel), over=c.profit>=0;
    const revName = S.scen==='적게 팔릴 때'?'적게 팔릴 때':(S.scen==='잘될 때'?'잘될 때':'이 자리 평균');
    void 0;
    const mx=Math.max(c.rev,c.bep)*1.18||1;
    const I=S.sbi&&S.sbi.ind?S.sbi.ind[S.ind]:null;
    const unit=sel.unit||(I&&I.unit);
    const unitSrc=sel.unit?'이 자리에서 손님 1명이 쓰는 돈':'서울 전체에서 손님 1명이 쓰는 돈';
    const dailyAmt=c.bep/30, dailyCnt=unit?Math.ceil(dailyAmt*1e4/unit):null;
    const TL=['00–06','06–11','11–14','14–17','17–21','21–24'], TH=[6,5,3,3,4,3];
    const tm=I&&I.tmzon; let pk=0;
    if(tm) tm.forEach((v,i)=>{ if(v>tm[pk]) pk=i; });

    out.d={
      eyebrow:this.indName(S.ind)+' · '+sel.name,
      headline: over?'현재 가정에서는 본전을 넘어요.':'본전에 못 미칩니다.',
      bep:this.man(c.bep), rev:this.man(c.rev), revName:revName,
      // 값이 작은 쪽이 왼쪽 — 라벨 순서를 막대 위치에서 끌어낸다
      gaugeLabels:[{v:c.rev,label:revName,value:this.man(c.rev)},{v:c.bep,label:'본전',value:this.man(c.bep)}]
        .sort((a,b)=>a.v-b.v)
        .map((g,i)=>({label:g.label, value:g.value,
          style:'white-space:nowrap;'+(i===0?'text-align:left':'text-align:right;margin-left:auto')})),
      fill:'position:absolute;left:0;top:0;bottom:0;width:'+Math.max(Math.min(c.rev/mx*100,100),1).toFixed(1)+'%;border-radius:6px;background:'+(over?'var(--good)':'var(--warn)')+';transition:width .2s cubic-bezier(.2,.7,.3,1)',
      mark:'position:absolute;top:-7px;bottom:-7px;left:'+Math.min(c.bep/mx*100,100).toFixed(1)+'%;width:2px;background:var(--ink);border-radius:1px;transition:left .2s cubic-bezier(.2,.7,.3,1)',
      gapStyle:'font-size:13px;margin-top:11px;font-weight:500;white-space:nowrap;color:'+(over?'var(--good)':'var(--warn)'),
      gap: over?'월 '+this.man(c.profit)+' 남습니다':'월 '+this.man(Math.abs(c.profit))+' 모자랍니다',
      factors:[
        over? {sign:'↑', arrow:arrowUp, text:'이 매출이면 인건비·임대료를 덮습니다'}
            : {sign:'↓', arrow:arrowDn, text:'고정비 '+this.man(c.fixed)+'을 못 덮습니다'},
        over
          ? {sign:'↑', arrow:arrowUp, text:'하루 '+(dailyCnt?dailyCnt.toLocaleString()+'건':'—')+'이 본전선이고 이 매출 가정에서는 넘습니다'}
          : {sign:'↓', arrow:arrowDn, text:'하루 '+(dailyCnt?dailyCnt.toLocaleString()+'건':'—')+'까지 올려야 본전입니다'},
        {sign:'↓', arrow:arrowDn, text:'권리금·인테리어는 이 계산에 없습니다'}
      ],
      thinStyle: sel.stores<=5?'font-size:12.5px;color:var(--warn);margin-top:26px;max-width:600px;text-wrap:pretty':'display:none',
      thin: sel.stores>5 ? ''
        : '계산의 출발점인 이 자리 '+this.indName(S.ind)+' 평균은 '+sel.stores+'곳만의 평균입니다. 잘되는 한 집이 평균을 끌어올리니, 아래 ‘내 조건 바꾸기’에서 ‘보수적’으로 낮춰 보세요.',
      honesty:'본전 = 고정비 ÷ (1 − 원가율). 임대료와 평수는 입력값이며 처음에는 기본 가정이 들어 있습니다. 직원 수와 기타 운영비는 평수에서 자동으로 잡은 값이고(10평당 1명 · 평당 6만원, 우리 기준), 칸에 직접 넣으면 그 값을 씁니다. 원가율은 기본 가정 · 수정 가능입니다. '
        +'매출은 이 자리에서 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아닙니다. 보수적 70%·낙관적 130%는 우리가 정한 배수입니다. '
        +'세금·대출 이자는 넣지 않았습니다.'
    };

    const num=k=>e=>{const v=e.target.value;this.setState({[k]:v===''?'':this.bound(v,0,k==='cogs'?95:100000,0)});};
    const ovr=k=>e=>{const v=e.target.value;this.setState({[k]:v===''?null:this.bound(v,0,k==='staffOv'?100:100000,0)});};

    // 평수 하나로 규모가 움직인다
    out.area=S.area;
    out.onArea=e=>this.setState({area:+e.target.value});
    out.areaLabel=c.area+'평';
    out.areaWord=c.area<=10?'작은 가게':(c.area<=25?'보통 가게':'큰 가게');
    out.linked=[
      {label:'직원', value:c.staff+'명', tag:c.staffAuto?'평수 따라 자동':'직접 넣은 값'},
      {label:'인건비', value:this.man(c.labor), tag:'1인 250만원'},
      {label:'기타 운영비', value:this.man(c.etc), tag:c.etcAuto?'평수 따라 자동':'직접 넣은 값'},
      {label:'평당 임대료', value:this.man(Math.round(c.rent/c.area)), tag:'임대료 ÷ 평수'}
    ];
    out.linkNote='평수를 움직이면 직원 수와 기타 운영비가 같이 바뀝니다. 10평당 1명, 평당 6만원으로 잡은 우리 기준이라 실제와 다를 수 있고, 아래 칸에 직접 넣으면 그 값을 씁니다. 임대료는 상권별 평당 시세가 공개되지 않아 자동으로 채울 수 없습니다.';

    out.inputs=[
      {label:'월 임대료 (만원)', value:S.rent, onChange:num('rent'), tag:'기본 400만원 · 실제 금액으로 수정'},
      {label:'원가율 (%)', value:S.cogs, onChange:num('cogs'), tag:'기본 가정 · 수정 가능'},
      {label:'직원 수 (명)', value:(S.staffOv==null?'':S.staffOv), onChange:ovr('staffOv'), tag:c.staffAuto?'비우면 '+c.staff+'명':'직접 넣은 값'},
      {label:'기타 운영비 (만원)', value:(S.etcOv==null?'':S.etcOv), onChange:ovr('etcOv'), tag:c.etcAuto?'비우면 '+c.etc+'만원':'직접 넣은 값'}
    ];


    // 한눈에 보는 차트 — 매출 100칸 중 임대료·인건비가 몇 칸인가
    const dotOf=(v,col)=>{
      const n=c.rev>0? Math.max(Math.round(v/c.rev*20),0) : 0;
      return {n:Math.min(n,20), col:col};
    };
    const dotSets=[['원가',c.rev*c.cogs,'var(--accent)'],['임대료',c.rent,'var(--accent-2)'],['인건비',c.labor,'var(--accent-3)'],['기타',c.etc,'var(--ink2)']];
    out.moneyDots=dotSets.map(([label,v,col])=>{
      const d=dotOf(v,col);
      const cells=[];
      for(let i=0;i<20;i++) cells.push({style:'width:100%;aspect-ratio:1;border-radius:2px;background:'+(i<d.n?col:'var(--surface)')});
      return {label:label, pct:c.rev>0?Math.round(v/c.rev*100)+'%':'—', cells:cells,
        word: c.rev>0? (v/c.rev>=0.4?'가장 무겁습니다':(v/c.rev>=0.2?'부담됩니다':'가볍습니다')) : ''};
    });
    // 항목별 독립 막대다 — 한 예산을 나눠 쓰는 그림이 아니라고 분명히 쓴다
    const totPct=c.rev>0? Math.round((c.rev*c.cogs+c.rent+c.labor+c.etc)/c.rev*100) : 0;
    out.dotNote = c.rev>0
      ? (totPct>100
        ? '한 줄이 매출 전체(20칸)이고, 칠한 칸이 그 항목이 먹는 몫입니다. 네 항목을 더하면 '+totPct+'%로 매출을 넘어서 남는 게 없습니다.'
        : '한 줄이 매출 전체(20칸)이고, 칠한 칸이 그 항목이 먹는 몫입니다. 네 항목을 더하면 '+totPct+'%, 나머지 '+(100-totPct)+'%가 내 몫입니다.')
      : '';
    out.scens=['적게 팔릴 때','보통일 때','잘될 때'].map(p=>({
      label:p, pick:()=>this.setState({scen:p}),
      style:'font-size:14px;padding:9px 18px;border-radius:9px;cursor:pointer;white-space:nowrap;min-height:40px;display:inline-flex;align-items:center;transition:background .16s;'+(S.scen===p?'background:var(--bg);color:var(--ink);font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.06)':'color:var(--ink2)')
    }));
    out.scenNote = S.scen==='적게 팔릴 때'? '이 동네 평균의 70%만 팔린다고 보고 계산합니다. 70%는 우리가 정한 값입니다.'
      : (S.scen==='잘될 때'? '이 동네 평균보다 30% 더 팔린다고 보고 계산합니다. 30%는 우리가 정한 값입니다.'
      : '이 동네 '+this.indName(S.ind)+' 가게들의 평균만큼 팔린다고 보고 계산합니다.');
    out.condHint=c.area+'평 · 임대료 '+this.man(c.rent)+' · 직원 '+c.staff+'명';

    const parts=[['원가',c.rev*c.cogs,'var(--accent)'],['임대료',c.rent,'var(--accent-2)'],['인건비',c.labor,'var(--accent-3)'],['기타',c.etc,'var(--ink2)']];
    if(c.profit>0) parts.push(['남는 돈',c.profit,'var(--good)']);
    // 1만원 기준으로 바꿔 말한다 — 금액보다 비중이 바로 읽힌다
    const tot=parts.reduce((a,[,v])=>a+Math.max(v,0),0)||1;
    out.stack=parts.map(([label,v,col])=>({label, amount:this.man(v),
      won:Math.round(Math.max(v,0)/tot*10000).toLocaleString()+'원',
      style:'flex:'+Math.max(v,0.01)+' 0 auto;background:'+col+';display:block',
      chip:'width:9px;height:9px;border-radius:2px;background:'+col+';display:inline-block'}));
    out.stackLead=(()=>{
      const left=c.profit>0?Math.round(c.profit/tot*10000):0;
      return c.profit>0
        ? '1만원어치 팔면 '+left.toLocaleString()+'원이 남습니다.'
        : '1만원어치 팔면 '+Math.round(Math.abs(c.profit)/tot*10000).toLocaleString()+'원이 모자랍니다.';
    })();
    const rowS='display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid var(--line);font-size:15px';
    const vS='font-variant-numeric:tabular-nums;white-space:nowrap';
    out.moneyRows=[
      {label:revName, value:this.man(c.rev), style:rowS, valStyle:vS},
      {label:'− 원가 '+Math.round(c.cogs*100)+'%', value:this.man(c.rev*c.cogs), style:rowS, valStyle:vS},
      {label:'− 임대료', value:this.man(c.rent), style:rowS, valStyle:vS},
      {label:'− 인건비 '+c.staff+'명', value:this.man(c.labor), style:rowS, valStyle:vS},
      {label:'− 기타', value:this.man(c.etc), style:rowS, valStyle:vS},
      {label:'남는 돈', value:this.man(c.profit), style:rowS+';border-top:1px solid var(--line-strong);padding-top:15px;font-weight:600', valStyle:vS+';font-weight:600;color:'+(over?'var(--good)':'var(--warn)')}
    ];
    out.moneyHint = over? '남는 돈 '+this.man(c.profit) : '모자란 돈 '+this.man(Math.abs(c.profit));

    out.dayStats=[
      {value: dailyCnt? dailyCnt.toLocaleString()+'건':'—', label:'하루 결제 건수'},
      {value: this.man(dailyAmt), label:'하루 매출'},
      {value: (dailyCnt&&tm)? Math.ceil(dailyCnt*tm[pk]/100/TH[pk]).toLocaleString()+'건':'—', label:TL[pk]+'시 시간당'}
    ];
    out.dayHint = dailyCnt? '하루 '+dailyCnt.toLocaleString()+'건':'—';
    out.dayWhy = dailyCnt
      ? '본전 '+this.man(c.bep)+' ÷ 30일 ÷ '+unitSrc+' '+unit.toLocaleString()+'원. 이 금액은 카드 1건당 결제액이라, 여러 명이 함께 결제하면 실제 손님 수와 결제 건수는 다릅니다. 시간대 비중은 서울 전체 '+this.indName(S.ind)+' 평균입니다.'
      : '이 장사는 결제 1건당 추정 금액이 자료에 없어 건수를 낼 수 없습니다.';

    const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
    const bigv='font-size:24px;font-weight:500;letter-spacing:-0.02em;margin-top:5px;font-variant-numeric:tabular-nums';
    out.riskStats = R? [
      {label:'서울 가게 수', value:R.stores.toLocaleString()+'곳', tag:'공공 집계', valStyle:bigv},
      {label:'문 닫은 곳', value:R.closed.toLocaleString()+'곳', tag:'3개월', valStyle:bigv+';color:var(--warn)'},
      {label:'새로 연 곳', value:R.opened.toLocaleString()+'곳', tag:'3개월', valStyle:bigv},
      {label:'프랜차이즈', value:R.fr_share+'%', tag:'공공 집계', valStyle:bigv}
    ] : [];
    // 포화도 — 가게 수를 사람 수로 나눈다. 서울 중위값이 기준선이라 우리 판단이 끼지 않는다.
    out.sat=(()=>{
      const vals=[];
      L.forEach(o=>{ const l=S.zlp&&S.zlp[o.id];
        if(l&&l.tot>0) vals.push({id:o.id, v:o.stores/(l.tot/10000)}); });
      if(!vals.length) return {has:false};
      const me=vals.find(o=>o.id===sel.id);
      if(!me) return {has:false};
      const sorted=vals.map(o=>o.v).sort((a,b)=>a-b);
      const med=sorted[Math.floor(sorted.length/2)];
      const ratio=me.v/med;
      const mx=Math.max(me.v,med)*1.35;
      const state=ratio<=0.7?{t:'여유',c:'var(--good)'}:(ratio<=1.3?{t:'보통',c:'var(--ink2)'}:{t:'과밀',c:'var(--warn)'});
      return {
        has:true,
        lead:'사람 1만 명당 '+this.indName(S.ind)+'이 '+me.v.toFixed(1)+'개예요. 서울 중앙값은 '+med.toFixed(1)+'개라 '+state.t+'이에요.',
        mine:me.v.toFixed(1)+'개', medText:med.toFixed(1)+'개',
        badge:state.t,
        badgeStyle:'display:inline-block;font-size:12px;font-weight:600;padding:5px 11px;border-radius:999px;white-space:nowrap;color:#FFFFFF;background:'+state.c,
        bar:'display:block;width:'+(me.v/mx*100).toFixed(1)+'%;height:100%;border-radius:5px;background:'+state.c,
        medMark:'position:absolute;top:-5px;bottom:-5px;left:'+(med/mx*100).toFixed(1)+'%;width:2px;background:var(--ink);border-radius:1px',
        medLabel:'position:absolute;top:14px;left:'+(med/mx*100).toFixed(1)+'%;transform:translateX(-50%);font-size:11px;color:var(--ink3);white-space:nowrap',
        note:'가게 수를 그 동네 유동인구로 나눈 값이에요. 가게 수만 보면 큰 동네가 늘 불리해 보이니 사람 수로 나눠 견줘요. 검은 선은 이 장사의 서울 중앙값이에요. 유동인구는 행정동 단위라 상권보다 넓어요.',
        medWord:'서울 중앙값'
      };
    })();

    // 사람 수 대비 매출 — 유동인구가 적은데 잘 파는 자리가 진짜 공백이다
    out.foot=(()=>{
      const lp=S.zlp&&S.zlp[sel.id];
      if(!lp) return {has:false, lead:'', stats:[], note:''};
      const perHead=sel.unit;
      const AL=['10대','20대','30대','40대','50대','60대+'];
      let hi=0; lp.age.forEach((v,i)=>{ if(v>lp.age[hi]) hi=i; });
      return {
        has:true,
        lead: '이 동네에 하루 '+Math.round(lp.tot).toLocaleString()+'명이 오갑니다.',
        stats:[
          {label:'하루 오가는 사람', value:Math.round(lp.tot).toLocaleString()+'명', tag:'공공 집계 · '+lp.dong},
          {label:'추정 객단가', value:Math.round(perHead).toLocaleString()+'원', tag:'원자료 · 결제 1건당'},
          {label:'가장 많은 나이', value:AL[hi], tag:'공공 집계'},
          {label:'여성 비율', value:Math.round(lp.f/lp.tot*100)+'%', tag:'공공 집계'}
        ],
        note:'유동인구는 '+lp.dong+' 행정동 값입니다. 동네(상권)보다 넓은 단위라 이 자리만의 값은 아닙니다. 상권 좌표를 행정동 경계와 대조해 붙였습니다.'
      };
    })();
    out.riskLead = R? (R.closed>R.opened
      ? '가게가 줄고 있습니다. 경쟁이 풀리는 신호일 수도, 업종이 어려워지는 신호일 수도 있습니다.'
      : '가게가 늘고 있습니다. 지금 계산한 한 집당 매출은 앞으로 더 나뉠 수 있습니다.') : '';
    out.riskHint = R? (R.closed>R.opened? '줄고 있음':'늘고 있음') : '—';

    // ── 지도분석 — 자치구로 좁혀 볼 수 있다. 지도는 카카오로 붙인다.
    const seoulOnly=(S.sido||'서울특별시')==='서울특별시';
    const GU_ALL=['서울 전체','종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const mapGu=S.mapGu||'서울 전체';
    const near=(mapGu==='서울 전체'
      ? L
      : L.filter(o=>{ const g=(S.zgu&&S.zgu[o.id])||''; return g===mapGu || (S.zbd&&S.zbd[o.id]&&S.zbd[o.id][1]===mapGu); })
    ).slice(0,6);
    const SM=S.smap;
    const mp=(()=>{
      if(!SM) return {ready:false, gus:[], pins:[], vb:'0 0 100 100', labels:[]};
      // 보여줄 핀들이 화면에 꽉 차게 뷰박스를 잡는다
      const cds=near.map(o=>SM.pts[o.id]).filter(Boolean);
      let x0=100,x1=0,y0=100,y1=0;
      cds.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});
      if(!cds.length){ x0=20;x1=80;y0=20;y1=80; }
      const pad=Math.max((x1-x0),(y1-y0))*0.42+6;
      let vx=x0-pad, vy=y0-pad, vw=(x1-x0)+pad*2, vh=(y1-y0)+pad*2;
      const side=Math.max(vw,vh);
      vx-=(side-vw)/2; vy-=(side-vh)/2; vw=vh=side;
      // 자치구를 이 장사의 한 곳당 매출로 색칠한다(choropleth)
      const guAgg={};
      if(S.zi&&S.zgu){
        const ix=S.zi.inds.indexOf(S.ind);
        if(ix>=0) for(const k in S.zi.zones){
          const g=S.zgu[k]; if(!g) continue;
          const row=(S.zi.zones[k].rows||[]).find(r=>r[0]===ix);
          if(!row||!row[1]||!row[2]) continue;
          const a=guAgg[g]||(guAgg[g]={s:0,n:0}); a.s+=row[2]; a.n+=row[1];
        }
      }
      const perGu={}; let mxPer=0;
      for(const g in guAgg){ const v=guAgg[g].s/guAgg[g].n; perGu[g]=v; if(v>mxPer) mxPer=v; }
      const involved={};
      near.forEach(o=>{ const g=(S.zgu&&S.zgu[o.id])||''; if(g) involved[g]=1; });
      return {
        ready:true,
        legend:mxPer>0?[
          {label:'한 곳당 매출 낮음', op:'0.12'},
          {label:'보통', op:'0.4'},
          {label:'높음', op:'0.75'}
        ]:[],
        legendNote:mxPer>0?'색이 진한 구일수록 이 장사의 가게 한 곳당 매출이 높습니다. 자료가 없는 구는 회색입니다.':'',
        vb:vx.toFixed(2)+' '+vy.toFixed(2)+' '+vw.toFixed(2)+' '+vh.toFixed(2),
        stroke:(side/100*0.5).toFixed(2),
        gus:Object.keys(SM.gus).map(g=>{
          const v=perGu[g];
          return {
            d:SM.gus[g].d,
            fill:v!=null?'var(--accent)':'var(--surface)',
            op:v!=null?(0.1+0.68*(v/mxPer)).toFixed(2):'1',
            sw:involved[g]?(side/100*0.9).toFixed(2):(side/100*0.4).toFixed(2),
            sc:involved[g]?'var(--ink)':'var(--line-strong)',
            on:!!involved[g], name:g, cx:SM.gus[g].c[0], cy:SM.gus[g].c[1]
          };
        }),
        pins:near.map((o,i)=>{
          const p=SM.pts[o.id]||[50,50], on=o.id===sel.id;
          const rr=side/100*(on?3.2:2.5);
          return {n:i+1, name:this.zoneLabelOf(o.name), x:p[0], y:p[1], on:on,
            r:rr.toFixed(2),
            ty:(p[1]+rr*0.36).toFixed(2), fs:(rr*1.05).toFixed(2),
            fill:on?'var(--accent)':'var(--ink3)',
            chip:'flex:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:36px;transition:background .14s,color .14s;'
              +(on?'background:var(--accent);color:#FFFFFF;font-weight:600':'background:var(--surface);color:var(--ink2)'),
            pick:()=>this.setState({sel:o.id})};
        })
      };
    })();
    // 절 목록은 렌더마다 한 번만 계산한다 — 탭과 카드가 같은 배열을 봐야 한다
    this._mvA=this.mvSections(sel,L);
    out.mv={
      eyebrow:this.indName(S.ind)+' · '+sel.name+(this.guLabel(sel.id)?' · '+this.guLabel(sel.id):''),
      // 시·도를 바꾸면 구 목록도 따라 바뀐다. 서울 밖은 자료가 없으므로
      // 서울 자치구를 그대로 두지 않는다 — 부산을 골랐는데 '강남구'가 남아 있으면 거짓말이다.
      gu:seoulOnly?mapGu:'자료 없음',
      guOptions:seoulOnly?GU_ALL:['자료 없음'],
      onGu:e=>{ if(seoulOnly) this.setState({mapGu:e.target.value}); },
      // 선택한 대상을 고정해 보여준다 — 여기서 후보를 다시 찾게 하지 않는다
      // 모바일에서는 표가 아니라 두 줄 행으로 접힌다 (가로 스크롤 금지)
      rowStyle:this.L(
        'display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:12px 0;border-bottom:1px solid var(--line)',
        'display:flex;align-items:baseline;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)',
        'display:flex;align-items:baseline;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)'),
      tagStyle:this.L(
        'flex:1 0 100%;font-size:11px;color:var(--ink3);text-wrap:pretty',
        'flex:none;width:180px;text-align:right;font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        'flex:none;width:200px;text-align:right;font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
      target:this.zoneLabelOf(sel.name)+' × '+this.indName(S.ind),
      stamp:(S.zi?this.qtr(S.zi.quarter):'')+' 기준',
      question:this.zoneLabelOf(sel.name)+'에서 '+this.indName(S.ind)+'를 시작해도 괜찮을까요?',
      headline:(()=>{
        const scores=L.map(o=>o.score).sort((a,b)=>a-b);
        const med=scores[Math.floor(scores.length/2)];
        if(sel.stores<10) return '데이터가 적어서 참고용으로 봐주세요.';
        return sel.score>=med*1.15? '진입을 검토해볼 만해요.'
          : (sel.score>=med*0.9? '가능하지만 확인할 게 있어요.' : '지금 조건으로는 조심하셔야 해요.');
      })(),
      sub:'수요·경쟁·매출을 서울과 견주고, 무엇을 더 확인해야 하는지 알려드려요.',
      // 지도분석 화면이 아니면 접는다 — 중첩 sc-if가 접히지 않아 style로 막는다
      prosSectionStyle:(S.screen==='map'? 'padding:44px 0 0' : 'display:none'),
      prosOnly:'display:none',
      // 좋은 점 / 주의할 점 — 정밀분석의 핵심 경험
      pros:(()=>{
        const lp=S.zlp&&S.zlp[sel.id];
        const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
        const good=[], care=[];
        const medOf=key=>{ const v=L.map(o=>o[key]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
        if(sel.sales>=medOf('sales')) good.push('손님이 쓰는 돈이 서울 중앙값보다 많아요.');
        else care.push('손님이 쓰는 돈이 서울 중앙값보다 적어요.');
        if(sel.per>=medOf('per')) good.push('가게 한 곳당 매출이 높은 편이에요.');
        else care.push('가게 한 곳당 매출이 낮은 편이에요.');
        if(sel.stores<=medOf('stores')) good.push('같은 장사가 서울 중앙값보다 적어요.');
        else care.push('같은 장사가 많은 편이에요.');
        if(lp){
          const sat=sel.stores/(lp.tot/10000);
          const sats=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l&&l.tot?o.stores/(l.tot/10000):null; })
            .filter(v=>v!=null).sort((a,b)=>a-b);
          const satMed=sats[Math.floor(sats.length/2)];
          if(sat<=satMed) good.push('사람 수에 비해 가게가 적어요.');
          else care.push('사람 수에 비해 가게가 조금 많아요.');
        } else care.push('유동인구 데이터가 없어서 사람 수 대비 경쟁은 확인하지 못했어요.');
        if(R){
          if(R.opened>=R.closed) good.push('이 장사는 서울에서 가게가 늘고 있어요.');
          else care.push('이 장사는 서울에서 가게가 줄고 있어요.');
        }
        care.push('임대료는 동네별로 공개되지 않아서 직접 확인해야 해요.');
        return {good:good.slice(0,4), care:care.slice(0,4)};
      })(),
      // 이 상권은 서울과 얼마나 다를까 — 상대값까지 계산해 준다
      vs:(()=>{
        const lp=S.zlp&&S.zlp[sel.id];
        const med=key=>{ const v=L.map(o=>o[key]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
        const row=(label,mine,seoul,fmt)=>{
          const d=seoul? (mine-seoul)/seoul*100 : null;
          return {label:label, mine:fmt(mine), seoul:fmt(seoul),
            delta:d==null?'—':((d>0?'+':'')+Math.round(d)+'%'),
            deltaStyle:'font-size:13px;font-weight:600;white-space:nowrap;color:'+(d==null?'var(--ink3)':(d>0?'var(--good)':'var(--warn)'))};
        };
        const rows=[
          row('가게 한 곳당 월매출', sel.per/3, med('per')/3, v=>this.fmt(v)+'원'),
          row('같은 장사 수', sel.stores, med('stores'), v=>Math.round(v).toLocaleString()+'곳'),
          row('손님이 쓴 돈 (3개월)', sel.sales, med('sales'), v=>this.fmt(v)+'원')
        ];
        if(lp){
          const tots=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l?l.tot:null; }).filter(v=>v!=null).sort((a,b)=>a-b);
          rows.unshift(row('하루 오가는 사람', lp.tot, tots[Math.floor(tots.length/2)], v=>Math.round(v).toLocaleString()+'명'));
        }
        return {rows:rows, note:'서울 값은 이 장사 데이터가 있는 동네들의 중앙값이에요. 평균이 아니라 중앙값이라 몇 곳의 큰 값에 끌려가지 않아요.'};
      })(),
      // 탭 — 스타일만 만든다. 내용은 card 하나가 그린다.
      sections:(()=>{
        const A=this._mvA||this.mvSections(sel,L);
        const cur=S.mvTab||A[0].key;
        return A.map(s=>({
          tabLabel:s.title.split(' · ')[0],
          toggle:()=>this.setState({mvTab:s.key}),
          tabStyle:'flex:none;font-size:13.5px;font-weight:500;padding:10px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
            +(s.key===cur?'background:var(--ink);color:var(--bg);font-weight:600':'background:var(--surface);color:var(--ink2)')
        }));
      })(),
      // 한눈 요약 — 7장의 핵심 숫자를 먼저 다 보여준다.
      // 예전에는 카드가 가로 캐러셀에만 있어서 화면에 들어오면 1장만 보였고,
      // 나머지 6장에 있는 값이 없는 것처럼 읽혔다. 요약을 먼저, 자세히는 아래에서.
      summary:(()=>{
        const A=this._mvA||this.mvSections(sel,L);
        return A.map((s,i)=>{
          const has=s.big&&s.big!=='데이터 없음';
          return {
            label:s.title.split(' · ')[0],
            big:s.big||'데이터 없음',
            bigStyle:'font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.15;'
              +'font-variant-numeric:tabular-nums;margin-top:6px;'
              +(has?'color:var(--ink)':'color:var(--ink3);font-size:15px;font-weight:500'),
            note:s.bigLabel||'',
            go:()=>this.goCard(i,A[i].key),
            style:'display:flex;flex-direction:column;padding:16px 18px;border-radius:14px;'
              +'background:var(--surface);cursor:pointer;min-width:0;transition:background .14s'
          };
        });
      })(),
      summaryGrid:'display:grid;gap:10px;margin-top:18px;grid-template-columns:'
        +this.L('repeat(2,minmax(0,1fr))','repeat(3,minmax(0,1fr))','repeat(4,minmax(0,1fr))'),
      // 가로 카드뉴스 — 5장을 트랙에 놓고 스냅으로 넘긴다.
      // 반복 안에서는 sc-if가 접히지 않으므로 조건부를 display로 처리한다.
      cards:(()=>{
        const A=this._mvA;
        const cur=S.mvTab||A[0].key;
        const ci=Math.max(A.findIndex(s=>s.key===cur),0);
        this._cardKeys=A.map(s=>s.key);
        this._cardIndex=ci;
        return A.map((s,i)=>({
          ...s,
          tabLabel:s.title.split(' · ')[0],
          // 활성 표시는 goCard·스크롤 핸들러가 직접 칠한다. 렌더 값은 한 박자 늦다.
          tabStyle:'flex:none;font-size:13.5px;padding:10px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;transition:background .14s,color .14s;background:var(--surface);color:var(--ink2);font-weight:500',
          toggle:()=>this.goCard(i,A[i].key),
          step:(i+1)+' / '+A.length,
          trend:s.trend||{label:'',delta:'',deltaStyle:'display:none',bars:[],full:''},
          trendStyle:s.trend? 'margin-top:22px;padding:16px 18px;border-radius:14px;background:var(--surface)' : 'display:none',
          barsStyle:(s.bars||[]).length? 'display:flex;flex-direction:column;gap:9px;margin-top:22px;max-width:480px' : 'display:none',
          cardStyle:'flex:0 0 100%;scroll-snap-align:start;min-width:0;padding:24px 0 8px',
          // 경쟁 카드에서만 배치도를 보여준다
          mapStyle:s.key==='comp'? 'display:block;margin-top:22px' : 'display:none',
          prevStyle:i>0? 'font-size:14.5px;color:var(--accent);cursor:pointer;white-space:nowrap' : 'display:none',
          nextStyle:i<A.length-1? 'font-size:14.5px;color:var(--accent);cursor:pointer;white-space:nowrap' : 'display:none',
          nextLabel:i<A.length-1? (A[i+1].title.split(' · ')[0]+' →') : '',
          prev:()=>this.goCard(Math.max(i-1,0),A[Math.max(i-1,0)].key),
          next:()=>this.goCard(Math.min(i+1,A.length-1),A[Math.min(i+1,A.length-1)].key),
          dots:A.map((_,j)=>({style:'width:'+(j===i?'18px':'6px')+';height:6px;border-radius:3px;transition:width .2s,background .2s;background:'+(j===i?'var(--accent)':'var(--line-strong)')}))
        }));
      })(),
      cardIndex:this._cardIndex||0,
      // 세부 지표 — 서울시가 쓰는 공식을 그대로 계산한다
      metrics:(()=>{
        const ST=S.sti&&S.sti.ind;
        if(S.screen!=='map'||!ST||!ST[S.ind]) return {has:false, rows:[], seoul:[], missing:[], note:''};
        const me=ST[S.ind];
        // 폐업률 = 폐업 점포수 ÷ 점포수 × 100
        const rate=o=>o.stores? o.closed/o.stores*100 : null;
        const all=Object.values(ST).map(rate).filter(v=>v!=null);
        const mean=all.reduce((a,b)=>a+b,0)/all.length;
        const sd=Math.sqrt(all.reduce((a,b)=>a+(b-mean)*(b-mean),0)/all.length)||1;
        const myRate=rate(me);
        // z점수는 ±3에서 자른다. T점수 = z×10+50
        const z=Math.max(-3,Math.min(3,(myRate-mean)/sd));
        const T=Math.round(z*10+50);
        const risk=T>=60?{t:'높음',c:'var(--warn)'}:(T>=45?{t:'보통',c:'var(--ink2)'}:{t:'낮음',c:'var(--good)'});
        const lp=S.zlp&&S.zlp[sel.id];
        // 이 자리에서만 달라지는 값
        const here=[];
        if(lp){
          here.push({label:'사람 1만 명당 가게', value:(sel.stores/(lp.tot/10000)).toFixed(1)+'개', tag:'가게 ÷ 유동인구'});
          here.push({label:'추정 객단가', value:Math.round(sel.unit).toLocaleString()+'원', tag:'원자료 · 결제 1건당'});
        }
        here.push({label:'같은 가게 수', value:sel.stores.toLocaleString()+'곳', tag:'공공 집계'});
        here.push({label:'가게 한 곳당 월매출', value:this.fmt(sel.per/3)+'원', tag:'추정 · 매출 ÷ 가게 수'});
        // 장사 전체(서울) 상수 — 자리를 바꿔도 변하지 않는다
        const seoul=[
          {label:'폐업률', value:myRate.toFixed(1)+'%', tag:'서울 전체 · 폐업 ÷ 전체 × 100'},
          {label:'폐업률 T점수', value:T+'점 · '+risk.t, tag:'서울 전체 · z×10+50', color:risk.c},
          {label:'62가지 평균 폐업률', value:mean.toFixed(1)+'%', tag:'서울 전체'},
          {label:'프랜차이즈 비중', value:me.fr_share+'%', tag:'서울 전체 · 공공 집계'},
          {label:'가게 순증감', value:(me.opened-me.closed>0?'+':'')+(me.opened-me.closed).toLocaleString()+'곳', tag:'서울 전체 · 3개월'},
          {label:'가게 회전율', value:((me.opened+me.closed)/me.stores*100).toFixed(1)+'%', tag:'서울 전체 · (개업+폐업) ÷ 전체'}
        ];
        return {
          has:true, rows:here, seoul:seoul,
          missing:[
            '지하철 승하차 인원 — 서울 열린데이터광장에 있지만 아직 붙이지 않았어요.',
            '상주인구와 배후세대 — 골목상권분석정보의 상권배후지 자료가 필요해요.',
            '아파트 단지 수 — 같은 자료에 있어요.',
            '시간대별 유동인구 — 지금은 하루 합계만 써요.'
          ],
          note:'폐업률 T점수는 62가지 장사의 폐업률을 표준화해 저희가 만든 값이에요. 서울시가 공표하는 창업위험도는 폐업률에 1~3년 생존율까지 함께 쓰는데, 생존율 데이터가 없어 폐업률만으로 계산했어요. 그래서 서울시 값과 달라요. 위 여섯 줄은 서울 전체 장사 기준이라 자리를 바꿔도 변하지 않아요.'
        };
      })(),
      // 후보를 여기서 다시 찾게 하지 않는다 — 상권분석에서 고른 자리를 검증만 한다
      detail:(()=>{
        const mv0=near.find(o=>o.id===sel.id)||sel;
        if(!mv0) return {has:false,title:'',dong:'',rows:[],facts:[],note:''};
        const lp=S.zlp&&S.zlp[mv0.id];
        const AL=['10대','20대','30대','40대','50대','60대+'];
        const rows=[];
        if(lp){
          const mxA=Math.max(...lp.age,1);
          lp.age.forEach((v,i)=>rows.push({
            label:AL[i], value:Math.round(v).toLocaleString()+'명',
            bar:'display:block;width:'+(v/mxA*100).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*v/mxA).toFixed(2)
          }));
        }
        const perHead=mv0.unit;
        return {
          has:!!lp,
          title:this.zoneLabelOf(mv0.name)+' 사람 구성',
          dong:lp?lp.dong+' 행정동 · 하루 '+Math.round(lp.tot).toLocaleString()+'명':'',
          rows:rows,
          facts:lp?[
            {label:'추정 객단가', value:Math.round(perHead).toLocaleString()+'원', tag:'추정'},
            {label:'여성', value:Math.round(lp.f/lp.tot*100)+'%', tag:'공공 집계'},
            {label:'남성', value:Math.round(lp.m/lp.tot*100)+'%', tag:'공공 집계'},
            {label:'자치구', value:this.guLabel(mv0.id)||'—', tag:'좌표로 계산'}
          ]:[],
          note:lp?'유동인구는 '+lp.dong+' 행정동 값이에요. 상권보다 넓은 단위라 이 자리만의 값은 아니에요.':'이 자리의 유동인구 데이터가 없어요.'
        };
      })(),
      map:this.buildMap(near, sel.id),
      list:near.map((o,i)=>({
        n:i+1, name:o.name, score:Math.round(o.score),
        meta:'경쟁 '+o.stores.toLocaleString()+'곳'+(o.stores<=5?' · 참고만':''),
        pick:()=>this.setState({sel:o.id}),
        row:'display:flex;align-items:baseline;gap:12px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer;'
          +(o.id===sel.id?'background:var(--surface);margin:0 -14px;padding-left:14px;padding-right:14px;border-radius:12px;border-top-color:transparent':'')
      })),
      cta:sel.name+' 본전 계산',
      honesty:'지도는 상권 중심 위치를 보여 줍니다. 도로·건물 지도는 아니며, 핀은 서울시가 공개한 동네 중심 좌표를 써요. 동네는 점이 아니라 면이라 핀 하나가 그 동네 전체를 뜻해요. 건물 단위 임대료와 공실은 공개 데이터에 없어서 보여드리지 못해요.'
    };

    // ── 비교
    const picks=PICKS.map(id=>L.find(o=>o.id===id)).filter(Boolean);
    if(picks.length<2){
      out.c={headline:'두 곳 이상 담아 주세요.', sub:'자리 찾기에서 ‘비교에 담기’를 누르세요.', cols:[], diffs:[], honesty:'', empty:true, on:false};
      out.openMap=false; out.mapPins=[]; out.mapNote='';
      out.cmpMap={ready:false,gus:[],pins:[],vb:'0 0 100 100',stroke:'0.5',legend:[],legendNote:''};
      out.addZoneOptions=[{id:'',label:'동네 더하기'}]; out.addZoneFull=false; out.onAddZone=()=>{};
      out.mapLabel='지도 보기'; out.mapBtn='display:none';
      out.toggleMap=()=>{};
      return out;
    }
    // 동률 판정은 화면에 찍히는 값(반올림 후)으로 해야 한다.
    // 79.4 vs 78.6은 다르지만 둘 다 "79"로 보이므로 승자를 세우면 거짓말이 된다.
    const asShown={ score:o=>Math.round(o.score), per:o=>this.fmt(o.per/3), sales:o=>this.fmt(o.sales), stores:o=>o.stores };
    const best=(k,hi)=>{
      const f=asShown[k], vals=picks.map(f);
      const nums=picks.map(o=>o[k]);
      const m=hi?Math.max(...nums):Math.min(...nums);
      const shown=f(picks.find(o=>o[k]===m));
      return vals.filter(v=>v===shown).length===1 ? picks.find(o=>f(o)===shown) : null;
    };
    // 받침 유무에 따라 이/가, 은/는을 고른다
    const ga=n=>this.josa(n,'ga');
    const KOW=['','한','두','세','네','다섯'];
    const countWord=picks.length<=5?KOW[picks.length]+' 곳':picks.length+'곳';
    const bS=best('score',true), bP=best('per',true), bF=best('stores',false), bD=best('sales',true);
    const tieWord=picks.length===2?'두 곳 같음':picks.length+'곳 같음';
    // 셀 라벨('3곳 같음')과 문장('세 곳이 모두 같습니다')은 형태가 달라야 한다
    const tieSent=KOW[picks.length]+' 곳이 모두 같습니다';
    const MX={score:Math.max(...picks.map(o=>o.score)),per:Math.max(...picks.map(o=>o.per)),sales:Math.max(...picks.map(o=>o.sales)),stores:Math.max(...picks.map(o=>o.stores))};
    const bigc='font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums';
    const rel=(v,k,col)=>'width:'+Math.max(Math.min(v/MX[k],1)*100,2).toFixed(1)+'%;height:100%;background:'+col+';border-radius:2px';
    out.c={
      headline:'담아 둔 '+picks.length+'곳, 어디로 할까요?',
      sub:'서로 다른 동네를 내가 고른 것만 견줘요.',
      empty:false, on:true,
      cols:picks.map(o=>({
        name:o.name, rank:S.ind+' '+(L.indexOf(o)+1)+'위',
        diag:()=>this.setState({sel:o.id,screen:'diag'}),
        drop:()=>this.setState({picks:PICKS.filter(x=>x!==o.id)}),
        cells:[
          {label:'기회점수', value:Math.round(o.score), note:o===bS?'가장 높음':(bS?'계산값':tieWord), valStyle:bigc+(o===bS?';color:var(--accent)':''), bar:rel(o.score,'score',o===bS?'var(--accent)':'var(--line-strong)')},
          {label:'한 집당 월매출', value:monthly(o.per), note:o===bP?'가장 높음 · 추정':(bP?'추정':tieWord+' · 추정'), valStyle:bigc+(o===bP?';color:var(--accent)':''), bar:rel(o.per,'per',o===bP?'var(--accent)':'var(--line-strong)')},
          {label:'경쟁 가게', value:o.stores.toLocaleString()+'곳', note:(o===bF?'가장 적음':(bF?'공공 집계':tieWord))+' · 적을수록 길다', valStyle:bigc+(o===bF?';color:var(--accent)':''), bar:'width:'+Math.max((1-(o.stores/(MX.stores*1.15)))*100,2).toFixed(1)+'%;height:100%;background:'+(o===bF?'var(--accent)':'var(--line-strong)')+';border-radius:2px'},
          {label:'임대료', value:'데이터 없음', note:'동네별로 공표되지 않습니다', valStyle:'font-size:17px;font-weight:600;margin-top:3px;color:var(--ink3)', bar:null}
        ]
      })),
      diffs:[
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--accent);flex:none;margin-top:9px',
         text: (bD&&bF&&bD!==bF)? '상권 전체 매출이 가장 큰 곳은 '+bD.name+', 경쟁이 가장 적은 곳은 '+bF.name+'입니다.'
             : (bD&&bD===bF)? bD.name+this.josa(bD.name,'eun')+' 손님이 가장 많으면서 경쟁도 가장 적습니다.'
             : (bD? '상권 전체 매출이 가장 큰 곳은 '+bD.name+'입니다. 경쟁 가게 수는 '+tieSent+'.'
                  : (bF? '경쟁이 가장 적은 곳은 '+bF.name+'입니다. 손님 수는 '+tieSent+'.'
                       : '손님 수도 경쟁 가게 수도 '+tieSent+'. 이것만으로는 우열을 가릴 수 없습니다.'))},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--accent-2);flex:none;margin-top:9px',
         text: bP? '한 집당 월매출은 '+bP.name+ga(bP.name)+' '+monthly(bP.per)+'으로 가장 높습니다.'
                 : '한 집당 월매출은 '+tieSent+'. 이 항목으로는 구분되지 않습니다.'},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--warn);flex:none;margin-top:9px',
         text:'임대료는 '+countWord+' 모두 미확인입니다. 중개인에게 확인한 금액을 본전 계산에 직접 넣어 비교하세요.'}
      ],
      honesty:''
    };
    // 지도 — 비교 중인 자리만 도식으로 놓는다
    const MP=[[28,26],[64,40],[40,72],[76,66]];
    out.openMap=!!S.openMap;
    out.toggleMap=()=>this.setState({openMap:!S.openMap});
    out.mapLabel=S.openMap?'지도 닫기':'지도 보기';
    out.mapBtn='flex:none;font-size:14.5px;padding:11px 20px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;transition:background .16s;'+(S.openMap?'background:var(--ink);color:var(--bg)':'background:var(--surface);color:var(--ink)');
    // 비교분석도 실좌표 지도를 쓴다
    out.cmpMap=this.buildMap(picks, sel.id);
    // 비교에 동네를 바로 더 담는 드롭다운
    out.addZoneOptions=[{id:'',label:'동네 더하기'}].concat(
      L.filter(o=>PICKS.indexOf(o.id)<0).slice(0,120)
        .map(o=>({id:o.id,label:this.zoneLabelOf(o.name)+' · '+Math.round(o.score)+'점'})));
    out.addZoneFull=PICKS.length>=5;
    out.onAddZone=e=>{ const id=e.target.value; if(!id) return;
      if(PICKS.length>=5) return;
      this.setState({picks:[...PICKS,id]}); };
    out.mapPins=picks.map((o,i)=>{
      const [x,y]=MP[i]||[50,50], on=o.id===sel.id, flip=x>50;
      return {
        name:o.name, pick:()=>this.setState({sel:o.id}),
        wrap:'position:absolute;left:'+x+'%;top:'+y+'%;transform:translate(-50%,-50%);display:flex;flex-direction:'+(flip?'row-reverse':'row')+';align-items:center;gap:8px;cursor:pointer;z-index:'+(on?3:2)+';max-width:'+(flip?x:100-x)+'%',
        dot:'flex:none;width:'+(on?15:11)+'px;height:'+(on?15:11)+'px;border-radius:50%;background:'+(on?'var(--accent)':'var(--ink3)')+';border:2.5px solid var(--bg);box-shadow:0 1px 4px rgba(0,0,0,.18);transition:all .16s',
        label:'min-width:0;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 10px;border-radius:999px;background:var(--bg);color:'+(on?'var(--ink)':'var(--ink2)')+';font-weight:'+(on?'600':'400')+';box-shadow:0 1px 4px rgba(0,0,0,.12)'
      };
    });
    out.mapNote='비교 중인 '+picks.length+'곳을 도식으로 놓았습니다. 핀을 누르면 그 자리가 선택되고 본전 계산이 다시 계산됩니다. 핀 위치는 실제 좌표가 아니며, 실지도는 카카오 좌표로 그립니다.';
    out.c.honesty='같은 기간('+this.qtr(r.quarter)+') 같은 업종('+S.ind+')으로만 비교합니다. 강조색은 그 줄에서 가장 유리한 값이라는 표시일 뿐, 추천이 아닙니다.';
    return out;
  }
}


return Component;
};
