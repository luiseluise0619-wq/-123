'use strict';
// 값 다듬기·이름 바꾸기 같은, 화면과 무관한 도구들
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.util = {
  loadData(url){return fetch(url,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error('Data unavailable');return r;});},

  // 금액 표기는 언어마다 단위가 다르다(§35). 화면마다 따로 만들지 않고 여기만 쓴다.
  //   한국어  1,000만 / 3.3억          영어  KRW 10.0M / KRW 330M
  //   중국어  1,000万 / 3.3亿
  // fmt 는 '원 단위' 값을, man 은 '만원 단위' 값을 받는다.
  fmt(v){ if(v==null||!isFinite(v)) return '—';
    const L=(this.locale?this.locale():'ko');
    if(L==='en'){
      const a=Math.abs(v), s=v<0?'-':'';
      if(a>=1e9) return s+'KRW '+(a/1e9).toFixed(a>=1e10?0:1)+'B';
      if(a>=1e6) return s+'KRW '+(a/1e6).toFixed(a>=1e7?0:1)+'M';
      if(a>=1e3) return s+'KRW '+Math.round(a/1e3).toLocaleString('en')+'K';
      return s+'KRW '+Math.round(a).toLocaleString('en');
    }
    if(L==='zh-CN'){
      if(v>=1e8) return (v/1e8).toFixed(v>=1e9?0:1)+'亿';
      return Math.round(v/1e4).toLocaleString('zh-CN')+'万';
    }
    if(v>=1e8) return (v/1e8).toFixed(v>=1e9?0:1)+'억';
    return Math.round(v/1e4).toLocaleString()+'만'; },

  man(v){ if(v==null||!isFinite(v)) return '—';
    const L=(this.locale?this.locale():'ko');
    const a=Math.abs(v);
    if(L==='en'){
      const s=v<0?'-':'';
      if(a>=100) return s+'KRW '+(a/100).toFixed(a>=1000?0:1)+'M';
      return s+'KRW '+Math.round(a*10000).toLocaleString('en');
    }
    if(L==='zh-CN'){
      const s=v<0?'−':'';
      if(a>=10000) return s+(a/10000).toFixed(a>=100000?0:1)+'亿韩元';
      return s+Math.round(a).toLocaleString('zh-CN')+'万韩元';
    }
    const s=v<0?'−':'';
    if(a>=10000) return s+(a/10000).toFixed(a>=100000?0:1)+'억원';
    return s+Math.round(a).toLocaleString()+'만원'; },

  // fmt/man 은 단위 글자를 안 붙인다. 화면에서 '원'을 덧붙이던 곳들을 위해 아래를 쓴다.
  // 예전에는 화면 코드가 숫자 뒤에 '원'을 직접 붙였는데, 영어에서는 그러면
  // 'KRW 10.0M원' 이 되어 버린다. 단위는 이 함수들이 언어에 맞게 붙인다.
  won(v){ const s=this.fmt(v); if(s==='—') return s;
    const L=(this.locale?this.locale():'ko');
    return L==='en'? s : (L==='zh-CN'? s+'韩元' : s+'원'); },
  wonRaw(v){ if(v==null||!isFinite(v)) return '—';
    const L=(this.locale?this.locale():'ko');
    const n=Math.round(v).toLocaleString(L==='ko'?undefined:L);
    return L==='en'? 'KRW '+n : (L==='zh-CN'? n+'韩元' : n+'원'); },
  // 만원 단위 값을 소수점까지 남겨 적는다(㎡당 임대료 15.2만원 처럼)
  manF(v,d){ if(v==null||!isFinite(v)) return '—';
    const L=(this.locale?this.locale():'ko');
    const n=Number(v).toFixed(d==null?1:d);
    if(L==='en') return 'KRW '+Number(n*10000).toLocaleString('en');
    if(L==='zh-CN') return n+'万韩元';
    return n+'만원'; },

  qtr(q){ const s=String(q||''); if(s.length!==5) return s;
    const y=s.slice(0,4), q4=s.slice(4);
    const L=(this.locale?this.locale():'ko');
    if(L==='en') return 'Q'+q4+' '+y;
    if(L==='zh-CN') return y+'年'+q4+'季度';
    return y+'년 '+q4+'분기'; },

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
    const profit = rev*(1-cogs)-fixed;
    // 처음 한 번 나가는 돈 — 사장님이 넣은 값만 쓴다(기본 가정을 두지 않는다).
    // 회수기간 = 초기투자 ÷ 월 영업이익. 이익이 0 이하면 회수되지 않으므로 null.
    const invest = this.bound(S.deposit,0,1000000,0)
                 + this.bound(S.premium,0,1000000,0)
                 + this.bound(S.interior,0,1000000,0);
    const payback = (invest>0 && profit>0) ? invest/profit : null;
    return {rent,etc,staff,labor,cogs,fixed,bep,avg,rev,mult,area:sz.area,
      staffAuto:sz.staffAuto, etcAuto:sz.etcAuto,
      invest, payback,
      profit};
  },

  // Lucide 아이콘 (lucide-icons/lucide@main, ISC). 텍스트 글리프(✕, ›) 대신 쓴다.
  zoneLabelOf(nm){
    const m=String(nm||'').match(/^(.+?)\(([^()]+)\)$/);
    let label;
    if(!m) label=nm;
    else{
      const base=m[1].trim(), inner=m[2].trim();
      label=(base.indexOf(inner)>=0 || inner.indexOf(base)>=0)? base : base+' · '+inner;
    }
    // 상권 이름은 고유명사다. 뜻을 옮기지 않는다.
    //   영어  국어의 로마자 표기법으로 소리를 옮긴다(logic/roman.js).
    //   중국어 자치구·주요 상권처럼 한자 표기가 표준으로 굳은 것만 사전(@phrases)에 두고,
    //         나머지 1,564곳은 한글 그대로 둔다 — 한자를 추측해 붙이면 지어낸 값이 된다.
    return this.placeName(label);
  },

  // 자치구·행정동·상권 이름 공통
  //   ① 사전에 굳은 표기가 있으면 그걸 쓴다 — 서울특별시는 'Seoulteukbyeolsi' 가 아니라 'Seoul',
  //      강남구는 'Gangnamgu' 가 아니라 'Gangnam-gu' 다. 소리로 옮기면 표지판과 달라진다.
  //   ② 없으면 영어에서만 로마자로 옮긴다(logic/roman.js).
  //   ③ 중국어는 그대로 둔다 — 한자 표기를 추측해 붙이면 지어낸 값이 된다.
  placeName(nm){
    if(!nm) return nm;
    const s=String(nm);
    const known=this.tr? this.tr(s) : s;
    if(known!==s) return known;
    if(this.locale&&this.locale()==='en') return this.romanizeName(s);
    return s;
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
    // 업종 이름은 보통명사라 번역 대상이다. 사전(@phrases)을 거쳐 내보낸다.
    if(M[raw]) return this.tr(M[raw]);
    // 남은 코드명은 군더더기만 덜어낸다
    const ko=String(raw||'')
      .replace(/전문점$/,'집').replace(/음식점$/,'당').replace(/판매$/,' 가게')
      .replace(/-/g,' ').trim();
    return this.tr(ko);
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
    return (own&&b&&b[1])
      ? this.t('gu.border',{a:this.placeName(own), b:this.placeName(b[1])})
      : this.placeName(own);
  }
};
