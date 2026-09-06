'use strict';
// 값 다듬기·이름 바꾸기 같은, 화면과 무관한 도구들
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.util = {
  loadData(url){return fetch(url,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error('Data unavailable');return r;});},

  fmt(v){ if(v==null||!isFinite(v)) return '—';
    if(v>=1e8) return (v/1e8).toFixed(v>=1e9?0:1)+'억';
    return Math.round(v/1e4).toLocaleString()+'만'; },

  man(v){ if(v==null||!isFinite(v)) return '—';
    const s=v<0?'−':'', a=Math.abs(v);
    if(a>=10000) return s+(a/10000).toFixed(a>=100000?0:1)+'억원';
    return s+Math.round(a).toLocaleString()+'만원'; },

  qtr(q){ const s=String(q||''); return s.length===5? s.slice(0,4)+'년 '+s.slice(4)+'분기':s; },

  bound(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;},

  size(){
    const S=this.state, a=this.bound(S.area,1,1000,15);
    return {
      area:a,
      staff: S.staffOv!=null? Math.round(this.bound(S.staffOv,0,100,0)) : Math.max(Math.round(a/10),1),
      etc: S.etcOv!=null? this.bound(S.etcOv,0,100000,0) : Math.round(a*6),
      staffAuto: S.staffOv==null, etcAuto: S.etcOv==null
    };
  },

  // 만원 단위. 본전 = 고정비 ÷ (1 − 원가율)
  bp(){
    const w=this.state.vw||(typeof window!=='undefined'?window.innerWidth:1200);
    return w<600?'mobile':(w<1024?'tablet':'desktop');
  },

  L(mobile,tablet,desktop){
    const b=this.bp();
    return b==='mobile'?mobile:(b==='tablet'?tablet:desktop);
  },

  // ── 디자인 시스템 ────────────────────────────────────────────────
  // 카드·제목·숫자 스타일을 한 곳에서만 정한다. 화면마다 조금씩 다른 값을
  // 쓰다 보니 같은 정보가 화면마다 다르게 보였다.
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
  },

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
  },

  // 시세분석 — 임대료·공실률·업종 매출·소비 구성. 전부 공개 통계.
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
  },

  // Lucide 아이콘 (lucide-icons/lucide@main, ISC). 텍스트 글리프(✕, ›) 대신 쓴다.
  zoneLabelOf(nm){
    const m=String(nm||'').match(/^(.+?)\(([^()]+)\)$/);
    if(!m) return nm;
    const base=m[1].trim(), inner=m[2].trim();
    if(base.indexOf(inner)>=0 || inner.indexOf(base)>=0) return base;
    return base+' · '+inner;
  },

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
  },

  // 받침에 따라 조사를 고른다. 이/가 · 은/는 · 라면/이라면
  josa(word, kind){
    const s=String(word||''), c=s.charCodeAt(s.length-1)-0xAC00;
    const bat=(c>=0&&c<11172)? c%28!==0 : /[013678lmnr]$/i.test(s.slice(-1));
    if(kind==='eun') return bat?'은':'는';
    if(kind==='eul') return bat?'을':'를';
    if(kind==='ramyeon') return bat?'이라면':'라면';
    if(kind==='ieyo') return bat?'이에요':'예요';   // 관광특구'예요' · 역삼역'이에요'
    return bat?'이':'가';
  },

  // AI 도우미 — 이 서비스가 계산한 값만 근거로 답한다. 모델 호출 없음, 없는 값은 없다고 답한다.
  guLabel(id){
    const S=this.state;
    const own=(S.zgu&&S.zgu[id])||'';
    const b=S.zbd&&S.zbd[id];
    return (own&&b&&b[1])? own+'·'+b[1]+' 경계' : own;
  }
};
