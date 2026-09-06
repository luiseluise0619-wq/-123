'use strict';
// 디자인 시스템 — 카드·제목·숫자 스타일과 "숫자 → 해석" 변환
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.design = {
  ds(kind){
    const CARD='background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card);';
    const M={
      card:      CARD+'border-radius:var(--r-md);padding:20px',
      cardLg:    CARD+'border-radius:var(--r-lg);padding:'+this.L('22px','26px','28px'),
      // 중요한 카드는 회색 배경이 아니라 민트 테두리로 구분한다
      cardHi:    'background:var(--accent-3);border:1px solid var(--accent-2);'
                 +'border-radius:var(--r-lg);padding:'+this.L('22px','26px','28px'),
      h1:        'font-size:'+this.L('27px','32px','36px')+';font-weight:700;letter-spacing:-.03em;line-height:1.18;margin:0;text-wrap:pretty',
      h2:        'font-size:'+this.L('20px','22px','24px')+';font-weight:700;letter-spacing:-.02em;line-height:1.3;margin:0',
      h3:        'font-size:17px;font-weight:700;letter-spacing:-.01em;margin:0',
      num:       'font-size:'+this.L('30px','34px','38px')+';font-weight:700;letter-spacing:-.03em;'
                 +'line-height:1.08;font-variant-numeric:tabular-nums',
      numSm:     'font-size:24px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15',
      body:      'font-size:'+this.L('15px','15.5px','16px')+';line-height:1.6;color:var(--ink2);margin:0;text-wrap:pretty',
      sub:       'font-size:13.5px;line-height:1.55;color:var(--ink3);margin:0;text-wrap:pretty',
      // 화면마다 강한 버튼은 하나뿐이다
      cta:       'font-size:16px;font-weight:600;color:#FFFFFF;background:var(--accent);border:none;'
                 +'border-radius:var(--r-sm);padding:0 26px;height:52px;cursor:pointer;'
                 +'box-shadow:0 6px 16px -8px rgba(8,127,107,.6);transition:filter .16s,transform .18s',
      ctaGhost:  'font-size:15px;font-weight:600;color:var(--accent);background:var(--accent-3);border:none;'
                 +'border-radius:var(--r-sm);padding:0 20px;height:48px;cursor:pointer;transition:filter .16s',
      input:     'width:100%;font-size:16px;font-weight:500;color:var(--ink);background:var(--surface);'
                 +'border:1px solid transparent;border-radius:var(--r-sm);padding:0 16px;height:52px;outline:none'
    };
    return M[kind]||'';
  },

  // ── 임대료 ────────────────────────────────────────────────────
  // 상권 1,564곳 단위 임대료는 아직 없다. 있는 건 한국부동산원 임대동향조사
  // (서울 63개 상권 · 권역 · 서울 전체)뿐이라, 이름이 정확히 맞는 상권만
  // 그 값을 쓰고 나머지는 서울 평균을 '이 상권 값이 아니다'라고 밝혀 보여준다.
  // 지어내지 않되 '데이터 없음'으로 비워 두지도 않는다.
  // ※ 상권 단위 정확도는 서울시 상권분석서비스의 환산임대료가 들어와야 얻어진다
  //   (backend/collect_zone_rent.py — 승인 대기).
  mx(label, value, meaning, tone){
    const C={good:'var(--good)', warn:'var(--warn)', bad:'var(--err)', flat:'var(--ink3)'};
    return {
      label:label, value:value, meaning:meaning||'', hasMeaning:!!meaning,
      labelStyle:'font-size:13px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      valueStyle:'font-size:'+this.L('22px','24px','26px')+';font-weight:700;letter-spacing:-.02em;'
        +'font-variant-numeric:tabular-nums;line-height:1.15;margin-top:6px;'
        +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
      meaningStyle:'font-size:12.5px;font-weight:600;line-height:1.45;margin-top:6px;text-wrap:pretty;'
        +'color:'+(C[tone]||C.flat)
    };
  },

  // 매출처럼 한쪽으로 크게 쏠린 값은 '중앙값 대비 1107% 많아요'가 나온다.
  // 숫자는 맞지만 사람이 못 읽는다. 이런 지표는 백분위로 말한다.
  pctRank(v, all, moreIsBetter){
    const a=all.filter(x=>isFinite(x)).sort((x,y)=>x-y);
    if(!a.length||!isFinite(v)) return {text:'', tone:'flat'};
    const below=a.filter(x=>x<v).length;
    const p=Math.round(below/a.length*100);          // 0=최하위, 100=최상위
    const top=moreIsBetter? (100-p) : p;             // '상위 N%'
    const shown=Math.max(top,1);
    const good=moreIsBetter? p>=60 : p<=40;
    const mid=p>=35&&p<=65;
    return {text:'서울 상권 중 상위 '+shown+'%', tone:mid?'flat':(good?'good':'warn')};
  },

  // 서울 중앙값과 견준 한 줄. good 이 true 면 '많을수록 좋은' 지표다.
  vs(v, med, unit, opt){
    const o=opt||{};
    if(v==null||med==null||!isFinite(v)||!isFinite(med)||med===0) return {text:'', tone:'flat'};
    const d=Math.round((v-med)/med*100);
    if(Math.abs(d)<5) return {text:'서울 평균과 비슷해요', tone:'flat'};
    const more=d>0;
    const goodDir=o.moreIsBetter!==false;      // 기본은 '많을수록 좋다'
    const tone=(more===goodDir)?'good':(o.badIsRed?'bad':'warn');
    const word=o.moreWord||'많아요', less=o.lessWord||'적어요';
    return {text:'서울 평균보다 '+Math.abs(d)+'% '+(more?word:less), tone:tone, diff:d};
  },

  rentRef(zoneName){
    const R=this.state.rentStats;
    if(!R||!R.zones) return null;
    const zr=this.state.zoneRent;                    // 상권 단위 실측(있으면 최우선)
    const id=this.state.sel||this.state.zoneId;
    if(zr&&id&&zr[id]&&Number.isFinite(zr[id].rent)){
      return {value:zr[id].rent.toFixed(1)+'만원', per:'㎡당 월',
              note:'서울시 상권분석서비스 환산임대료', exact:true};
    }
    const norm=t=>String(t||'').replace(/\s|·|\(.*?\)/g,'');
    const target=norm(zoneName);
    const list=Object.values(R.zones);
    const hit=target && list.find(z=>{
      const n=norm(z.nm);
      return n && (n===target || target.indexOf(n)>=0);
    });
    if(hit&&Number.isFinite(hit.rent)){
      return {value:hit.rent.toFixed(1)+'만원', per:'㎡당 월',
              note:hit.nm+' 기준 (한국부동산원)', exact:true};
    }
    if(R.seoul&&Number.isFinite(R.seoul.rent)){
      return {value:R.seoul.rent.toFixed(1)+'만원', per:'㎡당 월',
              note:'서울 평균 · 이 상권만의 값은 아니에요', exact:false};
    }
    return null;
  }
};
