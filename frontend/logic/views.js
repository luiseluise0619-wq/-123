'use strict';
// 자료가 있을 때만 만들 수 있는 화면들 — 후보지·본전 계산·지도·정밀분석·비교분석.
// renderVals() 가 공통 값을 만든 뒤 이 함수 하나를 불러 나머지를 채운다.
// 옮기기 전과 같은 코드다. 달라진 건 '어디에 있는가'뿐이다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.views = {
  // out 에 자료 의존 화면 값을 채운다. r 은 rank() 결과.
  fillDataViews(out, r){
    const S=this.state;
    const {arrowUp,arrowDn,arrowInfo}=MysbizonConst.TREND_STYLES;
    // renderVals 에서 쓰던 지역 변수 중 여기서도 필요한 것들
    // 좋고 나쁨이 아니라 '아직 안 넣었다'를 말하는 줄. ↑↓ 를 쓰면 없는 판단을 전한다.
    // 후보지는 '지역 → 구 → 업종' 순으로 좁힌다. 구를 고르면 그 안에서만 줄 세운다.
    const findGu = S.findGu || '';
    const Lall = r.list;
    const Lgu = findGu ? Lall.filter(o=>(S.zgu||{})[o.id]===findGu) : Lall;
    const L = Lgu.length ? Lgu : Lall;
    // 홈에서 고른 지역이 이 업종에 기록이 있으면 그 자리를 먼저 보여준다
    const fromHome = (!S.sel && S.homeZone) ? L.find(o=>o.name===S.homeZone) : null;
    const sel = S.sel ? (L.find(o=>o.id===S.sel)||L[0]) : (fromHome||L[0]);
    // 비교분석은 빈 화면에서 시작한다. 임의로 3곳을 담아 두면
    // '내가 고른 것'과 '앱이 고른 것'이 구분되지 않는다.
    const PICKS = S.picks || [];
    // 비교 담기 — 빼기만 가능하면 되돌릴 수 없으므로 목록·결론 양쪽에 토글을 둔다
    const pickToggle=o=>()=>{
      const p=[...PICKS], i=p.indexOf(o.id);
      if(i>=0) p.splice(i,1); else if(p.length<3) p.push(o.id);
      this.setState({picks:p});
    };
    const pickLabelOf=o=>{
      const inP=PICKS.indexOf(o.id)>=0;
      return inP? '비교에서 빼기' : (PICKS.length>=3? '비교 3곳 꽉 찼어요' : '비교에 담기 ('+PICKS.length+'/3)');
    };
    const monthly=v=>this.won(v/3);
    const grade=sc=>sc>=75?['매우 유망','var(--good)']:(sc>=60?['괜찮음','var(--good)']:(sc>=45?['보통','var(--ink2)']:['조심','var(--warn)']));

    // ── 결론
    const g=grade(sel.score);
    const fewer=Math.max(Math.round(100-sel._stores),1), more=Math.max(Math.round(100-sel._sales),1);
    // 백분위가 낮으면 그 항목은 강점이 아니다 — 부호와 문장을 값에서 끌어낸다
    // 최상급은 진짜 1위 한 곳에만 쓴다. 백분위 99.9도 2위일 수 있다.
    const demandTop = sel.sales===Math.max(...L.map(o=>o.sales));
    const demandLine = sel._sales>=60
      ? {sign:'↑', arrow:arrowUp, text:demandTop? '상권 전체 매출이 서울에서 가장 높아요' : '상권 전체 매출이 높아요 · 서울 상위 '+more+'%'}
      : (sel._sales>=40
        ? {sign:'↑', arrow:arrowUp, text:'상권 전체 매출은 중간 수준이에요 · 서울 상위 '+more+'%'}
        : {sign:'↓', arrow:arrowDn, text:'손님이 적어요 · 서울 상위 '+more+'%'});
    const compLine = sel._stores>=60
      ? {sign:'↑', arrow:arrowUp, text:'경쟁이 적어요 · 같은 가게 '+sel.stores.toLocaleString()+'곳'}
      : (sel._stores>=40
        ? {sign:'↑', arrow:arrowUp, text:'경쟁은 보통이에요 · 같은 가게 '+sel.stores.toLocaleString()+'곳'}
        : {sign:'↓', arrow:arrowDn, text:'경쟁이 치열해요 · 같은 가게 '+sel.stores.toLocaleString()+'곳'});
    out.t={
      eyebrow:this.t('find.rank',{ind:this.indName(S.ind), n:r.covered.toLocaleString(), r:(L.indexOf(sel)+1)})
        +((S.homeZone&&!S.sel)? (fromHome? ' · '+this.tr('홈에서 고른 지역')
            : ' · '+this.tn('find.noRecordIn',{zone:this.placeName(S.homeZone)})) : ''),
      name:this.zoneLabelOf(sel.name), score:Math.round(sel.score),
      grade:g[0], gradeStyle:'font-size:17px;font-weight:600;color:'+g[1]+';white-space:nowrap',
      togglePick:pickToggle(sel), pickLabel:pickLabelOf(sel),
      factors:[
        demandLine,
        compLine,
        sel.stores<=5
          ? {sign:'↓', arrow:arrowDn, text:'가게가 너무 적어 평균이 흔들려요'}
          : {sign:'↓', arrow:arrowDn, text:'임대료는 데이터 없음 · 직접 확인해야 해요'}
      ],
      // 표본이 적으면 단정하지 않는다. 다만 '판단 보류'로 모든 값을 죽이지도 않는다(§12).
      thin:sel.stores<10,
      // 한 줄로 줄인다(§5) — 자세한 건 아래 '데이터 기준 보기'에 있다
      thinWarn: sel.stores<10
        ? '분석 가능한 점포가 '+sel.stores.toLocaleString()+'곳이라 종합 평가는 참고 수준이에요.'
        : '',
      thinBadge: sel.stores<10? '점포 '+sel.stores.toLocaleString()+'곳' : '',
      // 결론 먼저 — 점수는 기준선과 함께
      // 결론 자리에는 결론을 둔다. 표본이 적을 때 '개별 지표는 그대로 보셔도 돼요' 라는
      // 단서를 제목 자리에 올려 두고 있었는데, 그건 아무도 안 물어본 답이었다.
      // 얼마나 못 믿을지는 바로 아래 thinWarn 한 줄이 이미 말한다(§12).
      verdict:(()=>{
        const scores=L.map(o=>o.score).sort((a,b)=>a-b);
        const med=scores[Math.floor(scores.length/2)];
        const rank=L.indexOf(sel)+1, pct=Math.round(rank/L.length*100);
        return sel.score>=med*1.15? this.tn('find.ok',{ind:this.indName(S.ind)})   // 이름은 바로 위 제목에 이미 있다
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
      // 지표 → 숫자 → 의미. 숫자만 던지지 않는다.
      metrics:(()=>{
        const medOf=k=>{ const v=L.map(o=>o[k]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
        const lp=S.zlp&&S.zlp[sel.id];
        const pops=L.map(o=>(S.zlp&&S.zlp[o.id])?S.zlp[o.id].tot:null).filter(v=>v!=null).sort((a,b)=>a-b);
        const popMed=pops.length?pops[Math.floor(pops.length/2)]:null;
        const M=[];
        // 매출·소비 규모는 쏠림이 커서 '중앙값 대비 %'가 1000% 를 넘는다 → 백분위로 말한다
        const vSales=this.pctRank(sel.per, L.map(o=>o.per), true);
        M.push(this.mx('예상 매출 (추정)', this.won(sel.per/3), vSales.text, vSales.tone));
        // 경쟁은 '적을수록 좋다' — 부호가 아니라 의미로 색을 정한다
        const vComp=this.vs(sel.stores, medOf('stores'), '', {moreIsBetter:false, moreWord:'많아요', lessWord:'적어요'});
        M.push(this.mx('경쟁 점포', sel.stores.toLocaleString()+'곳', vComp.text, vComp.tone));
        if(lp){
          const vPop=this.vs(lp.tot, popMed, '', {moreIsBetter:true});
          M.push(this.mx('유동인구', Math.round(lp.tot).toLocaleString()+'명', vPop.text, vPop.tone));
        } else {
          M.push(this.mx('유동인구', '자료 없음', '이 상권은 아직 집계되지 않았어요', 'flat'));
        }
        const vSpend=this.pctRank(sel.sales, L.map(o=>o.sales), true);
        M.push(this.mx('상권 소비 규모', this.won(sel.sales), vSpend.text, vSpend.tone));
        return M;
      })(),
      // 점수만 던지면 '왜 87점인지'를 알 수 없다. 근거 세 줄을 함께 둔다.
      why:(()=>{
        const out=[];
        if(sel._sales>=55) out.push('상권 전체 매출이 서울 중앙값보다 높아요');
        else if(sel._sales<=35) out.push('상권 전체 매출은 서울 중앙값보다 낮아요');
        if(sel._stores>=55) out.push('같은 업종 경쟁이 서울 중앙값보다 적어요');
        else if(sel._stores<=35) out.push('같은 업종 경쟁이 서울 중앙값보다 많아요');
        if(sel._per>=55) out.push('가게 한 곳당 매출이 높은 편이에요');
        const lp=S.zlp&&S.zlp[sel.id];
        if(lp) out.push(this.t('fact.dongPop',{dong:this.placeName(lp.dong), n:Math.round(lp.tot).toLocaleString()}));
        if(sel.stores<10) out.push('다만 표본이 '+sel.stores+'곳뿐이라 참고용이에요');
        return out.slice(0,3).map(t=>({
          text:t,
          style:'display:flex;align-items:flex-start;gap:9px;font-size:14.5px;line-height:1.55;color:var(--ink2)'}));
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
           body:this.t('reason.salesBody',{amt:this.won(sel.per/3)}),
           sample:'표본 '+sel.stores.toLocaleString()+'곳'+(sel.stores<10?' · 적어서 참고용으로 봐주세요':'')},
          {q:'경쟁이 얼마나 치열한가요?',
           head:compWord[0], headStyle:hs(compWord[1]),
           body:this.t('reason.compBody',{n:sel.stores.toLocaleString()})
             +(lp? ' '+this.t('reason.compPer',{v:(sel.stores/(lp.tot/10000)).toFixed(1)}) : ''),
           sample:lp? this.t('reason.popSample',{n:Math.round(lp.tot).toLocaleString(), dong:this.placeName(lp.dong)}) : '유동인구 데이터 없음'},
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
        {label:'한 집당 잘 번다', meaning:this.t('rentPer',{amt:monthly(sel.per)}), bar:'width:'+sel._per.toFixed(1)+'%;height:100%;background:var(--accent-3);border-radius:3px'}
      ]
    };
    out.rowsRail=this.rail('cand',{per:3});
    out.rows=L.slice(1,9).map((o,i)=>({
      rank:i+2, name:this.zoneLabelOf(o.name), score:Math.round(o.score),
      // 두 백분위 중 더 두드러진 쪽을 그 자리의 성격으로 쓴다 — 같은 말이 반복되지 않게
      meaning: o.stores<=5 ? '가게 '+o.stores+'곳뿐'
        : (Math.abs(o._sales-o._stores)<8 ? '손님·경쟁 균형'
          : (o._sales>o._stores ? '상권 매출 상위 '+Math.round(100-o._sales)+'%' : '경쟁 적은 쪽 '+Math.round(100-o._stores)+'%')),
      pick:()=>this.setState({sel:o.id}),
      togglePick:pickToggle(o),
      // 가로 카드 — 스냅으로 한 장씩 멈춘다
      no:String(L.indexOf(o)+1).padStart(2,'0'),
      // 975곳 중 2위와 6위가 모두 '상위 1%'로 눌려 구분이 사라졌다 — 순위로 쓴다
      pct:this.t('rank.ofPlaces',{n:L.length.toLocaleString(), r:L.indexOf(o)+1}),
      gu:this.guLabel(o.id)||'',
      cardStyle:'flex:0 0 '+this.L('82%','260px','268px')+';scroll-snap-align:start;min-width:0;padding:18px;border-radius:18px;'
        +'transition:box-shadow .16s,background .16s;'
        +(o.id===sel.id
          ? 'background:var(--accent-3);box-shadow:inset 0 0 0 1.5px var(--accent)'
          : 'background:var(--surface)'),
      pickLabel: PICKS.indexOf(o.id)>=0 ? '비교에서 빼기' : (PICKS.length>=3? '비교 3곳 꽉 찼어요' : '비교에 담기'),
      // 글자만 있는 링크지만 손가락 영역은 44px — 위아래 음수 여백으로 카드 높이는 안 바뀐다
      pickStyle: 'display:inline-flex;align-items:center;min-height:44px;margin:-14px 0;padding-right:12px;'
        +(PICKS.indexOf(o.id)>=0
        ? 'font-size:12.5px;color:var(--accent-text);cursor:pointer;white-space:nowrap;font-weight:600'
        : (PICKS.length>=5
          ? 'font-size:12.5px;color:var(--ink3);white-space:nowrap'
          : 'font-size:12.5px;color:var(--ink3);cursor:pointer;white-space:nowrap')),
      row:'display:flex;align-items:baseline;gap:12px;padding:13px 0;border-top:1px solid var(--line)'
    }));
    // 긴 회색 문단을 그대로 두지 않는다 — 한 줄만 보이고 나머지는 접는다(§14)
    out.note=this.dataNote('find',
      '예상 매출은 상권 소비액을 점포 수로 나눈 추정값이에요.',
      [['계산 방법','기회점수 = 상권 소비액(45%) + 경쟁 점포 수(35%) + 가게 한 곳당 매출(20%). 저희가 정한 비율로 합친 값이에요.'],
       ['데이터 출처','서울시 상권분석서비스 · 서울 열린데이터광장 생활인구'],
       ['기준 기간', this.qtr(r.quarter)],
       ['다룬 범위','서울 상권 '+r.total.toLocaleString()+'곳 중 이 업종 자료가 있는 '+r.covered.toLocaleString()+'곳'],
       ['주의','임대료는 상권 단위로 공개되지 않아 점수에 넣지 못했어요. 예상 매출은 실측이 아니라 추정값이에요.']]);
    out.honesty='';

    this.fillDiagnosisView(out, sel, L);

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
        legendNote:mxPer>0?'색이 진한 구일수록 이 장사의 가게 한 곳당 매출이 높아요. 자료가 없는 구는 회색이에요.':'',
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
            // 로마자 이름은 아주 길다 — 칩이 못 줄면 320px 화면이 통째로 밀린다
            chip:'flex:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 13px;border-radius:999px;'
              +'cursor:pointer;white-space:nowrap;min-height:36px;max-width:100%;overflow:hidden;text-overflow:ellipsis;'
              +'transition:background .14s,color .14s;'
              +(on?'background:var(--accent);color:var(--on-accent);font-weight:600':'background:var(--surface);color:var(--ink2)'),
            pick:()=>this.setState({sel:o.id})};
        })
      };
    })();
    // 절 목록은 렌더마다 한 번만 계산한다 — 탭과 카드가 같은 배열을 봐야 한다
    this._mvA=this.mvSections(sel,L);
    out.mv={
      eyebrow:this.t('mv.eyebrow',{ind:this.indName(S.ind), zone:this.zoneLabelOf(sel.name)})
        +(this.guLabel(sel.id)?' · '+this.guLabel(sel.id):''),
      // 화면 맨 아래 한 줄 + 펼치면 계산 방법·출처·한계 (design.js dataNote)
      note:this.dataNote('mv',
        '여기 숫자는 상권 전체를 집계한 추정값이에요. 한 가게의 실적이 아니에요.',
        [['매출·점포',
          '서울열린데이터광장 상권분석서비스의 상권별 추정매출·점포 수예요. 가게 한 곳당 매출은 상권 매출을 점포 수로 나눈 값이고, 원자료가 3개월 합계라 3으로 나눠 월 기준으로 적었어요.'],
         ['유동인구',
          '상권이 속한 행정동의 하루 평균 생활인구예요. 상권 한 곳만의 숫자가 아니라 그 동네 전체 값이에요. 시간대별·요일별은 공개 자료에 없어 보여드리지 못해요.'],
         ['임대료·공실',
          '한국부동산원 상업용부동산 임대동향조사(서울 63개 주요 상권·권역) 자료예요. 이름이 정확히 맞는 상권만 그 값을 쓰고, 나머지는 서울 평균이라고 밝혀 적어요. 건물·점포 단위 임대료는 공개 자료에 없어요.'],
         ['비교 대상',
          '‘서울 중앙값’은 같은 업종 데이터가 있는 서울 상권들의 가운데 값이에요. 평균이 아니라 중앙값이라 아주 크거나 작은 몇 곳에 끌려가지 않아요.'],
         ['주의할 점',
          '규모·업력·자리에 따라 실제 값은 크게 다를 수 있어요. 여기 숫자는 상권끼리 견주는 용도이고, 개업 여부는 현장 확인과 함께 판단해 주세요.']]),
      // 시·도를 바꾸면 구 목록도 따라 바뀐다. 서울 밖은 자료가 없으므로
      // 서울 자치구를 그대로 두지 않는다 — 부산을 골랐는데 '강남구'가 남아 있으면 거짓말이다.
      guValue:seoulOnly?mapGu:'자료 없음',
      // value 는 원래 이름, 보이는 글자만 옮긴다(screens.js fineCompare 와 같은 꼴)
      guOptions:seoulOnly? GU_ALL.map(g=>({v:g, label:this.placeName(g)}))
                         : [{v:'자료 없음', label:this.t('mv.noGuData')}],
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
      target:this.t('mv.title',{zone:this.zoneLabelOf(sel.name), ind:this.indName(S.ind)}),
      stamp:(S.zi?this.qtr(S.zi.quarter):''),
      question:this.tn('mv.question',{zone:this.zoneLabelOf(sel.name), ind:this.indName(S.ind)}),
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
        care.push('상권 단위 임대료 자료가 없어 중개인에게 직접 확인해야 해요.');
        return {good:good.slice(0,4), care:care.slice(0,4)};
      })(),
      // 이 상권은 서울과 얼마나 다를까 — 상대값까지 계산해 준다
      vs:(()=>{
        const lp=S.zlp&&S.zlp[sel.id];
        const med=key=>{ const v=L.map(o=>o[key]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
        // '+'가 곧 좋은 게 아니다. 경쟁 점포가 30% 많은 건 나쁜 값이다.
        // 그리고 매출처럼 쏠린 값은 '+1107%'가 나와 읽히지 않으므로 백분위로 바꾼다.
        const row=(label,mine,seoul,fmt,opt)=>{
          const o=opt||{};
          const d=seoul? (mine-seoul)/seoul*100 : null;
          const moreIsBetter=o.moreIsBetter!==false;
          let text, tone;
          if(d==null){ text='—'; tone='var(--ink3)'; }
          else if(o.skewed && Math.abs(d)>=200){
            const pr=this.pctRank(mine, o.all||[], moreIsBetter);
            text=pr.text||'—';
            tone=({good:'var(--good)',warn:'var(--warn)',flat:'var(--ink3)'})[pr.tone];
          } else {
            text=(d>0?'+':'')+Math.round(d)+'%';
            const helpful=(d>0)===moreIsBetter;
            tone=Math.abs(d)<5? 'var(--ink3)' : (helpful?'var(--good)':'var(--warn)');
          }
          return {label:label, mine:fmt(mine), med:fmt(seoul), seoul:fmt(seoul),
            delta:text,
            deltaStyle:'font-size:13px;font-weight:600;white-space:nowrap;color:'+tone};
        };
        const rows=[
          row('가게 한 곳당 월매출', sel.per/3, med('per')/3, v=>this.won(v),
              {skewed:true, all:L.map(o=>o.per/3), moreIsBetter:true}),
          row('같은 업종 점포 수', sel.stores, med('stores'), v=>Math.round(v).toLocaleString()+'곳',
              {moreIsBetter:false}),
          row('상권 소비 규모 (3개월)', sel.sales, med('sales'), v=>this.won(v),
              {skewed:true, all:L.map(o=>o.sales), moreIsBetter:true})
        ];
        if(lp){
          const tots=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l?l.tot:null; }).filter(v=>v!=null).sort((a,b)=>a-b);
          rows.unshift(row('하루 오가는 사람', lp.tot, tots[Math.floor(tots.length/2)], v=>Math.round(v).toLocaleString()+'명', {moreIsBetter:true}));
        }
        return {rows:rows,
          // 4열 표라 좁은 화면에서는 가로로 스크롤한다(AGENTS.md §7).
          // 영어는 항목 이름이 두 배쯤 길어 같은 폭에서 이름이 잘렸다 — 상자만 넓힌다.
          boxStyle:'min-width:'+(this.locale()==='en'?'640px':'520px'),
          note:'서울 값은 이 장사 데이터가 있는 동네들의 중앙값이에요. 평균이 아니라 중앙값이라 몇 곳의 큰 값에 끌려가지 않아요.'};
      })(),
      // ── 정밀분석 대시보드 ────────────────────────────────────────
      // 들어가자마자 차트를 던지지 않는다. '좋은가/나쁜가'와 그 이유 먼저.
      dash:(()=>{
        const A=this._mvA||this.mvSections(sel,L);
        const med=k=>{ const v=L.map(o=>o[k]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
        const lp=S.zlp&&S.zlp[sel.id];
        const fit=(()=>{
          if(sel.stores<10) return {word:'판단 보류', tone:'flat',
            why:'표본이 '+sel.stores+'곳뿐이라 단정할 수 없어요'};
          if(sel.score>=70) return {word:'좋음', tone:'good', why:''};
          if(sel.score>=50) return {word:'보통', tone:'flat', why:''};
          return {word:'주의', tone:'warn', why:''};
        })();
        const good=[], care=[];
        const push=(arr,label,text)=>arr.push({label:label, text:text});
        const vSales=this.pctRank(sel.per, L.map(o=>o.per), true);
        if(sel._per>=55) push(good,'예상 매출', vSales.text);
        else if(sel._per<=35) push(care,'예상 매출', vSales.text);
        const vComp=this.vs(sel.stores, med('stores'), '', {moreIsBetter:false});
        if(sel._stores>=55) push(good,'경쟁 강도', vComp.text);
        else if(sel._stores<=35) push(care,'경쟁 강도', vComp.text);
        if(lp){
          const tots=L.map(o=>{const l=S.zlp&&S.zlp[o.id];return l?l.tot:null;}).filter(v=>v!=null).sort((a,b)=>a-b);
          const vPop=this.vs(lp.tot, tots[Math.floor(tots.length/2)], '', {moreIsBetter:true});
          (vPop.tone==='good'?good:care).push({label:'유동인구', text:vPop.text});
        }
        const rf=this.rentRef(sel.name);
        if(rf&&rf.exact) push(care,'임대료', this.t('rent.perSqm',{value:rf.value, note:this.tr(rf.note)}));
        if(sel.stores<10) push(care,'표본', '가게가 '+sel.stores+'곳뿐이라 평균이 흔들려요');
        const style=t=>'min-width:0';
        // 종합평가는 한 줄. 강점·주의는 눌렀을 때만 편다(§21·§35).
        const dashOpen=!!S.mvDashOpen;
        return {
          zone:this.zoneLabelOf(sel.name), ind:this.indName(S.ind),
          open:dashOpen,
          toggle:()=>this.setState({mvDashOpen:!dashOpen}),
          toggleLabel:dashOpen?'접기':'강점·주의 보기',
          fit:fit.word, fitWhy:fit.why, hasFitWhy:!!fit.why,
          fitStyle:'flex:none;font-size:'+this.L('22px','24px','26px')+';font-weight:700;letter-spacing:-.02em;line-height:1.15;'
            +'color:'+({good:'var(--good)',warn:'var(--warn)',flat:'var(--ink)'}[fit.tone]),
          tips:(()=>{ const g=A.find(x=>x.key==='grow');
            return g? (g.rows||[]).slice(0,3).map(r=>({text:this.tr(r.label)+(r.value?' · '+this.tr(r.value):'')})) : []; })(),
          hasTips:!!A.find(x=>x.key==='grow'),
          good:good.slice(0,3).map(o=>({...o, style:style(), tone:'color:var(--good);font-weight:600;font-size:13px'})),
          care:care.slice(0,3).map(o=>({...o, style:style(), tone:'color:var(--warn);font-weight:600;font-size:13px'})),
          hasGood:good.length>0, hasCare:care.length>0
        };
      })(),
      // 항목 고르기 — 데스크톱·태블릿은 왼쪽 세로 목록, 모바일은 가로로 넘기는 칩 줄.
      // 모바일에서 6~7개를 세로로 쌓으면 그것만으로 한 화면이 차서 정작 고른 내용이 안 보였다.
      navStyle:this.L(
        'display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;'
          +'scrollbar-width:none;padding:2px 0 8px;min-width:0',
        this.ds('card')+';align-self:start;padding:10px;min-width:0',
        this.ds('card')+';align-self:start;padding:10px;min-width:0'),
      nav:(()=>{
        const A=(this._mvA||this.mvSections(sel,L)).filter(x=>x.key!=='grow');
        const cur=S.mvTab||A[0].key;
        const mob=this.bp()==='mobile';
        return A.map(x=>({
          label:x.title.split(' · ')[0],
          pick:()=>this.setState({mvTab:x.key}),
          style:(mob
              ? 'flex:none;scroll-snap-align:start;display:block;padding:9px 15px;border-radius:999px;'
                +'font-size:14px;'
              : 'display:block;padding:12px 14px;border-radius:var(--r-sm);font-size:14.5px;')
            +'cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
            +'transition:background .14s,color .14s;'
            +(x.key===cur?'background:var(--accent-3);color:var(--accent-hover);font-weight:700'
                         :(mob?'background:var(--card);color:var(--ink2)':'color:var(--ink2)'))}));
      })(),
      // 지금 고른 섹션 하나만 오른쪽에 크게 — 관련 차트 2~4개와 함께
      now:(()=>{
        const A=(this._mvA||this.mvSections(sel,L)).filter(x=>x.key!=='grow');
        const cur=A.find(x=>x.key===(S.mvTab||A[0].key))||A[0];
        const ch=this.mvCharts(cur.key, sel, L);
        return {
          charts:ch.charts, hasCharts:ch.charts.length>0,
          // 한 화면에 차트 하나(§8). 두 개를 나란히 두면 관리자 대시보드가 된다.
          rail:this.rail('mv',{per:1, peek:false, arrows:true}),
          // 아래에 차트 이름을 늘어놓고, 누르면 그 차트로 건너뛴다
          chartNav:ch.charts.map((c,i)=>({
            label:c.title,
            go:()=>this.railTo('mv',i),
            style:'flex:none;padding:8px 14px;border-radius:999px;font-size:13px;cursor:pointer;'
              +'white-space:nowrap;background:var(--color-surface);color:var(--color-text-secondary);'
              +'transition:background .14s,color .14s'
          })),
          chartCount:this.t('mk.chartCount',{n:ch.charts.length}),
          hasChartNav:ch.charts.length>1,
          missing:ch.missing.map(t=>({text:t})), hasMissing:ch.missing.length>0,
          title:cur.title, q:cur.q||'', big:cur.big||'', bigLabel:cur.bigLabel||'',
          verdict:cur.verdict||'', hasVerdict:!!cur.verdict,
          rows:(cur.rows||[]).map(r=>({...r, hasTag:!!r.tag})),
          bars:cur.bars||[], hasBars:!!(cur.bars&&cur.bars.length),
          note:cur.note||'', hasNote:!!cur.note,
          hasAction:!!cur.action, actionLabel:cur.actionLabel||'', action:cur.action||(()=>{}),
          bigStyle:'font-size:'+this.L('30px','34px','40px')+';font-weight:700;letter-spacing:-.03em;'
            +'line-height:1.08;font-variant-numeric:tabular-nums;margin-top:10px;'
            +((cur.big&&cur.big!=='데이터 없음'&&cur.big!=='자료 없음')?'':'font-size:19px;color:var(--ink3)')
        };
      })(),
      // 지도 옆 요약은 세 개만. 지도는 '어디인지'를 답하는 화면이다.
      summary3:(()=>{
        const A=this._mvA||this.mvSections(sel,L);
        const want=['sales','demand','comp'];
        const pick=want.map(k=>A.find(x=>x.key===k)).filter(Boolean);
        return (pick.length?pick:A.slice(0,3)).map(x=>{
          const has=x.big&&x.big!=='데이터 없음'&&x.big!=='자료 없음';
          return {label:x.title.split(' · ')[0], big:x.big||'자료 없음', note:x.bigLabel||'',
            bigStyle:'font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1.15;'
              +'font-variant-numeric:tabular-nums;margin-top:4px;'
              +(has?'':'font-size:17px;color:var(--ink3);font-weight:600')};
        });
      })(),
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
          here.push({label:'추정 객단가', value:this.wonRaw(Math.round(sel.unit)), tag:'(추정)'});
        }
        here.push({label:'같은 가게 수', value:sel.stores.toLocaleString()+'곳', tag:''});
        here.push({label:'가게 한 곳당 월매출', value:this.won(sel.per/3), tag:'(추정)'});
        // 장사 전체(서울) 상수 — 자리를 바꿔도 변하지 않는다
        const seoul=[
          {label:'폐업률', value:myRate.toFixed(1)+'%', tag:'서울 전체 · 폐업 ÷ 전체 × 100'},
          {label:'폐업률 T점수', value:T+'점 · '+risk.t, tag:'서울 전체 · z×10+50', color:risk.c},
          {label:'62가지 평균 폐업률', value:mean.toFixed(1)+'%', tag:'서울 전체'},
          {label:'프랜차이즈 비중', value:me.fr_share+'%', tag:'서울 전체'},
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
          title:this.t('mv.peopleOf',{name:this.zoneLabelOf(mv0.name)}),
          dong:lp? this.t('pop.dongDaily',{dong:this.placeName(lp.dong), n:Math.round(lp.tot).toLocaleString()}) : '',
          rows:rows,
          facts:lp?[
            {label:'추정 객단가', value:this.wonRaw(Math.round(perHead)), tag:'(추정)'},
            {label:'여성', value:Math.round(lp.f/lp.tot*100)+'%', tag:''},
            {label:'남성', value:Math.round(lp.m/lp.tot*100)+'%', tag:''},
            {label:'자치구', value:this.guLabel(mv0.id)||'—', tag:'좌표로 계산'}
          ]:[],
          note:lp? this.t('pop.noteShort',{dong:this.placeName(lp.dong)}) : '이 자리의 유동인구 데이터가 없어요.'
        };
      })(),
      map:this.buildMap(near, sel.id),
      list:near.map((o,i)=>({
        n:i+1, name:this.zoneLabelOf(o.name), score:Math.round(o.score),
        meta:'경쟁 '+o.stores.toLocaleString()+'곳'+(o.stores<=5?' · 참고만':''),
        pick:()=>this.setState({sel:o.id}),
        row:'display:flex;align-items:baseline;gap:12px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer;'
          +(o.id===sel.id?'background:var(--surface);margin:0 -14px;padding-left:14px;padding-right:14px;border-radius:12px;border-top-color:transparent':'')
      })),
      cta:this.t('mv.bepOf',{name:this.zoneLabelOf(sel.name)}),
      honesty:'지도는 상권 중심 위치를 표시합니다. 핀은 서울시가 공개한 동네 중심 좌표입니다. 동네는 점이 아니라 면이어서 핀 하나가 동네 전체를 뜻합니다. 건물 단위 임대료와 공실은 공개 데이터가 없습니다.'
    };

    return this.fillComparisonView(out, r, Lall, PICKS, pickToggle, pickLabelOf);
  }
};
