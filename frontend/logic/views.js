'use strict';
// 자료가 있을 때만 만들 수 있는 화면들 — 후보지·본전 계산·지도·정밀분석·비교분석.
// renderVals() 가 공통 값을 만든 뒤 이 함수 하나를 불러 나머지를 채운다.
// 옮기기 전과 같은 코드다. 달라진 건 '어디에 있는가'뿐이다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.views = {
  // out 에 자료 의존 화면 값을 채운다. r 은 rank() 결과.
  fillDataViews(out, r){
    const S=this.state;
    // renderVals 에서 쓰던 지역 변수 중 여기서도 필요한 것들
    const go=s=>()=>this.setState({screen:s,menu:null});
    const arrowUp='flex:none;font-size:15px;font-weight:600;color:var(--good);width:14px';
    const arrowDn='flex:none;font-size:15px;font-weight:600;color:var(--warn);width:14px';
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
      eyebrow:this.t('find.rank',{ind:this.indName(S.ind), n:r.covered.toLocaleString(), r:(L.indexOf(sel)+1)})
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
      // 표본이 적으면 단정하지 않는다. 다만 '판단 보류'로 모든 값을 죽이지도 않는다(§12).
      thin:sel.stores<10,
      // 한 줄로 줄인다(§5) — 자세한 건 아래 '데이터 기준 보기'에 있다
      thinWarn: sel.stores<10
        ? '분석 가능한 점포가 '+sel.stores.toLocaleString()+'곳이라 종합 평가는 참고 수준이에요.'
        : '',
      thinBadge: sel.stores<10? '점포 '+sel.stores.toLocaleString()+'곳' : '',
      // 결론 먼저 — 점수는 기준선과 함께
      verdict:(()=>{
        if(sel.stores<10) return '개별 지표는 그대로 보셔도 돼요.';
        const scores=L.map(o=>o.score).sort((a,b)=>a-b);
        const med=scores[Math.floor(scores.length/2)];
        const rank=L.indexOf(sel)+1, pct=Math.round(rank/L.length*100);
        return sel.score>=med*1.15? this.tn('find.ok',{zone:this.zoneLabelOf(sel.name), ind:this.indName(S.ind)})
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
        if(sel._sales>=55) out.push('상권 전체 매출이 서울 평균보다 높아요');
        else if(sel._sales<=35) out.push('상권 전체 매출은 서울 평균보다 낮아요');
        if(sel._stores>=55) out.push('같은 업종 경쟁이 서울 평균보다 적어요');
        else if(sel._stores<=35) out.push('같은 업종 경쟁이 서울 평균보다 많아요');
        if(sel._per>=55) out.push('가게 한 곳당 매출이 높은 편이에요');
        const lp=S.zlp&&S.zlp[sel.id];
        if(lp) out.push(lp.dong+' 하루 유동인구가 '+Math.round(lp.tot).toLocaleString()+'명이에요');
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
        {label:'한 집당 잘 번다', meaning:this.t('rentPer',{amt:monthly(sel.per)}), bar:'width:'+sel._per.toFixed(1)+'%;height:100%;background:var(--accent-3);border-radius:3px'}
      ]
    };
    out.rowsRail=this.rail('cand',{per:3});
    out.rows=L.slice(1,9).map((o,i)=>({
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
      pickLabel: PICKS.indexOf(o.id)>=0 ? '비교에서 빼기' : (PICKS.length>=3? '비교 3곳 꽉 찼어요' : '비교에 담기'),
      pickStyle: PICKS.indexOf(o.id)>=0
        ? 'font-size:12.5px;color:var(--accent);cursor:pointer;white-space:nowrap;font-weight:600'
        : (PICKS.length>=5
          ? 'font-size:12.5px;color:var(--ink3);white-space:nowrap'
          : 'font-size:12.5px;color:var(--ink3);cursor:pointer;white-space:nowrap'),
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
      eyebrow:this.t('mv.head',{ind:this.indName(S.ind), zone:this.zoneLabelOf(sel.name)}),
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
      gap: this.t(over?'diag.left':'diag.short',{amt:this.man(Math.abs(c.profit))}),
      factors:[
        over? {sign:'↑', arrow:arrowUp, text:'이 매출이면 인건비·임대료를 덮습니다'}
            : {sign:'↓', arrow:arrowDn, text:this.t('diag.fixed',{amt:this.man(c.fixed)})},
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
    out.condHint=this.t('diag.cond',{area:c.area, rent:this.man(c.rent), n:c.staff});

    const parts=[['원가',c.rev*c.cogs,'var(--accent)'],['임대료',c.rent,'var(--accent-2)'],['인건비',c.labor,'var(--accent-3)'],['기타',c.etc,'var(--ink2)']];
    if(c.profit>0) parts.push(['남는 돈',c.profit,'var(--good)']);
    // 1만원 기준으로 바꿔 말한다 — 금액보다 비중이 바로 읽힌다
    const tot=parts.reduce((a,[,v])=>a+Math.max(v,0),0)||1;
    out.stack=parts.map(([label,v,col])=>({label, amount:this.man(v),
      won:Math.round(Math.max(v,0)/tot*this.wonRaw(10000)),
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
    out.moneyHint = over? this.t('diag.leftLabel',{amt:this.man(c.profit)})
      : this.t('diag.short',{amt:this.man(Math.abs(c.profit))});

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
      {label:'서울 가게 수', value:R.stores.toLocaleString()+'곳', tag:'', valStyle:bigv},
      {label:'문 닫은 곳', value:R.closed.toLocaleString()+'곳', tag:'3개월', valStyle:bigv+';color:var(--warn)'},
      {label:'새로 연 곳', value:R.opened.toLocaleString()+'곳', tag:'3개월', valStyle:bigv},
      {label:'프랜차이즈', value:R.fr_share+'%', tag:'', valStyle:bigv}
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
          {label:'하루 오가는 사람', value:Math.round(lp.tot).toLocaleString()+'명', tag:lp.dong},
          {label:'추정 객단가', value:this.wonRaw(Math.round(perHead)), tag:'(추정)'},
          {label:'가장 많은 나이', value:AL[hi], tag:''},
          {label:'여성 비율', value:Math.round(lp.f/lp.tot*100)+'%', tag:''}
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
      eyebrow:this.t('mv.eyebrow',{ind:this.indName(S.ind), zone:this.zoneLabelOf(sel.name)})
        +(this.guLabel(sel.id)?' · '+this.guLabel(sel.id):''),
      // 화면 맨 아래 한 줄 + 펼치면 계산 방법·출처·한계 (design.js dataNote)
      note:this.dataNote('mv',
        '여기 숫자는 상권 전체를 집계한 추정값이에요. 한 가게의 실적이 아니에요.',
        [['매출·점포',
          '서울열린데이터광장 상권분석서비스의 상권별 추정매출·점포 수입니다. 가게 한 곳당 매출은 상권 매출을 점포 수로 나눈 값이고, 원자료가 3개월 합계라 3으로 나눠 월 기준으로 적습니다.'],
         ['유동인구',
          '상권이 속한 행정동의 하루 평균 생활인구입니다. 상권 한 곳만의 숫자가 아니라 그 동네 전체 값이에요. 시간대별·요일별은 공개 자료에 없어 보여드리지 못합니다.'],
         ['임대료·공실',
          '한국부동산원 상업용부동산 임대동향조사(서울 63개 주요 상권·권역)입니다. 이름이 정확히 맞는 상권만 그 값을 쓰고, 나머지는 서울 평균이라고 밝혀 적습니다. 건물·점포 단위 임대료는 공개 자료에 없습니다.'],
         ['비교 대상',
          '‘서울 중앙값’은 같은 업종 데이터가 있는 서울 상권들의 가운데 값이에요. 평균이 아니라 중앙값이라 아주 크거나 작은 몇 곳에 끌려가지 않습니다.'],
         ['주의할 점',
          '규모·업력·자리에 따라 실제 값은 크게 다를 수 있어요. 여기 숫자는 상권끼리 견주는 용도이고, 개업 여부는 현장 확인과 함께 판단해 주세요.']]),
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
      target:this.t('mv.title',{zone:this.zoneLabelOf(sel.name), ind:this.indName(S.ind)}),
      stamp:(S.zi?this.qtr(S.zi.quarter):'')+' 기준',
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
        return {rows:rows, note:'서울 값은 이 장사 데이터가 있는 동네들의 중앙값이에요. 평균이 아니라 중앙값이라 몇 곳의 큰 값에 끌려가지 않아요.'};
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
        if(rf&&rf.exact) push(care,'임대료', rf.value+'/㎡ · '+rf.note);
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
            return g? (g.rows||[]).slice(0,3).map(r=>({text:r.label+(r.value?' · '+r.value:'')})) : []; })(),
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
            +(x.key===cur?'background:var(--accent-3);color:var(--accent);font-weight:700'
                         :(mob?'background:var(--surface);color:var(--ink2)':'color:var(--ink2)'))}));
      })(),
      // 지금 고른 섹션 하나만 오른쪽에 크게 — 관련 차트 2~4개와 함께
      now:(()=>{
        const A=(this._mvA||this.mvSections(sel,L)).filter(x=>x.key!=='grow');
        const cur=A.find(x=>x.key===(S.mvTab||A[0].key))||A[0];
        const ch=this.mvCharts(cur.key, sel, L);
        return {
          charts:ch.charts, hasCharts:ch.charts.length>0,
          // 한 화면에 차트 하나(§8). 두 개를 나란히 두면 관리자 대시보드가 된다.
          rail:this.rail('mv',{per:1}),
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
          bigStyle:'font-size:'+this.L('30px','34px','40px')+';font-weight:700;letter-spacing:-.03em;'
            +'line-height:1.08;font-variant-numeric:tabular-nums;margin-top:10px;'
            +((cur.big&&cur.big!=='데이터 없음'&&cur.big!=='자료 없음')?'':'font-size:19px;color:var(--ink3)')
        };
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
          // 세로 flex 로 둔다 — 아래 점·화살표 줄이 margin-top:auto 로 카드 바닥에 붙게 하려고.
          // 트랙은 align-items 기본값(stretch)이라 카드 높이는 가장 긴 카드에 맞춰 같아진다.
          // 그래야 옆으로 넘길 때 화살표가 위아래로 튀지 않는다.
          cardStyle:'flex:0 0 100%;scroll-snap-align:start;min-width:0;padding:24px 0 8px;'
            +'display:flex;flex-direction:column',
          // 경쟁 카드에서만 배치도를 보여준다
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
          title:this.zoneLabelOf(mv0.name)+' 사람 구성',
          dong:lp?lp.dong+' 행정동 · 하루 '+Math.round(lp.tot).toLocaleString()+'명':'',
          rows:rows,
          facts:lp?[
            {label:'추정 객단가', value:this.wonRaw(Math.round(perHead)), tag:'(추정)'},
            {label:'여성', value:Math.round(lp.f/lp.tot*100)+'%', tag:''},
            {label:'남성', value:Math.round(lp.m/lp.tot*100)+'%', tag:''},
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

    // ── 비교할 상권 찾기 ─────────────────────────────────────────
    // 검색이 중심이다(§15). 추천 목록은 검색 아래에 보조로 둔다.
    // 다른 화면으로 보내지 않는다 — 보내면 '내가 어디 있는지'를 잃는다.
    const rawQ=(S.cmpQ||'').trim();
    const cq=rawQ.replace(/\s/g,'');
    const zgu=S.zgu||{};
    const nameOfZ=o=>this.zoneLabelOf(o.name);
    const row=o=>({
      id:o.id,
      name:nameOfZ(o),
      meta:[zgu[o.id], this.won(o.per/3)].filter(Boolean).join(' · '),
      add:()=>{ if(PICKS.length>=3) return;
        // 담으면 검색어를 비우고 최근 본 목록에 남긴다
        const recent=[o.id, ...(S.cmpRecent||[]).filter(x=>x!==o.id)].slice(0,6);
        this.setState({picks:[...PICKS,o.id], cmpQ:'', cmpRecent:recent}); },
      style:'display:flex;align-items:center;justify-content:space-between;gap:12px;'
        +'padding:14px 16px;border-radius:var(--r-sm);background:var(--surface);'
        +'cursor:pointer;min-width:0;transition:background .14s'
    });
    // 검색 — 상권 이름·자치구·행정동 아무거나로 걸린다
    const zlpAll=S.zlp||{};
    const hit=o=>{
      if(!cq) return false;
      const d=(zlpAll[o.id]&&zlpAll[o.id].dong)||'';
      return (nameOfZ(o)+(zgu[o.id]||'')+d).replace(/\s/g,'').indexOf(cq)>=0;
    };
    const found=L.filter(o=>PICKS.indexOf(o.id)<0).filter(hit).slice(0,8).map(row);
    // 최근 본 상권 — 담았다 뺀 것도 여기 남는다
    const recentIds=(S.cmpRecent||[]).filter(id=>PICKS.indexOf(id)<0);
    const recent=recentIds.map(id=>L.find(o=>o.id===id)).filter(Boolean).slice(0,6).map(row);
    // 추천 — 검색을 안 했을 때만 보조로
    const suggest=L.filter(o=>PICKS.indexOf(o.id)<0).slice(0,8).map(row);
    const addBox={
      q:S.cmpQ||'',
      onQ:e=>this.setState({cmpQ:e.target.value}),
      // Enter 는 첫 결과를 담는다 — 검색창에서 손을 떼지 않아도 되게
      onKey:e=>{ if(e.key!=='Enter') return;
        if(found.length&&PICKS.length<3) found[0].add(); },
      clear:()=>this.setState({cmpQ:''}),
      hasQ:!!rawQ,
      searching:!!rawQ,
      found, hasFound:found.length>0,
      noResult: !!rawQ && found.length===0,
      noResultText:'‘'+rawQ+'’와 맞는 상권이 없어요. 상권 이름이나 구 이름으로 찾아보세요.',
      recent, hasRecent:recent.length>0,
      suggest, hasSuggest:!rawQ && suggest.length>0,
      full:PICKS.length>=3,
      fullText:'3곳까지 담을 수 있어요. 하나를 빼면 다른 곳을 담을 수 있어요.',
      foundRail:this.rail('cmpFound',{per:3}),
      recentRail:this.rail('cmpRecent',{per:3}),
      suggestRail:this.rail('cmpSug',{per:3}),
      // 담을 게 없을 때만 펼쳐 둔다. 이미 비교 중이면 결론이 먼저다(§19·§35).
      open: PICKS.length<2 ? true : !!S.cmpAddOpen,
      canFold: PICKS.length>=2,
      toggle:()=>this.setState({cmpAddOpen:!S.cmpAddOpen}),
      toggleLabel: S.cmpAddOpen? '닫기' : '+ 상권 추가'
    };

    if(picks.length<2){
      out.c={
        headline:'상권을 비교해 보세요',
        sub:'관심 있는 상권을 최대 3곳까지 나란히 놓고 볼 수 있어요.',
        emptyCount: picks.length===1? '지금 1곳 담았어요. 한 곳만 더 담으면 비교가 시작돼요.' : '',
        // 담은 게 하나면 그 카드도 보여 준다 — 담은 게 사라진 것처럼 보이면 안 된다
        cols:picks.map(o=>({
          name:this.zoneLabelOf(o.name), rank:(S.zgu&&S.zgu[o.id])||'',
          diag:()=>this.setState({sel:o.id,screen:'diag'}),
          drop:()=>this.setState({picks:PICKS.filter(x=>x!==o.id)}),
          best:false,
          cardStyle:'background:var(--bg);border:1px solid var(--line);'
            +'border-radius:var(--r-lg);padding:20px;min-width:0;position:relative',
          cells:[{label:'예상 매출 (추정)', value:this.won(o.per/3), note:'',
                  valStyle:'font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums', bar:null},
                 {label:'경쟁 점포', value:o.stores.toLocaleString()+'곳', note:'',
                  valStyle:'font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums', bar:null}]
        })),
        add:addBox, rail:this.rail('cmpCols',{per:3}),
        charts:[], chartRail:this.rail('cmpCh',{per:1}), hasCharts:false,
        diffs:[], honesty:'', empty:true, on:picks.length>0,
        verdict:'', verdictWhy:[], hasVerdict:false,
        // 순위 UI 는 두 곳 이상 담아야 뜬다 — 자리만 비워 둔다
        presets:[], presetRail:this.rail('cmpPre',{per:5}),
        whyOpen:false, whyLabel:'', toggleWhy:()=>{}, why:{label:'',rows:[],how:''},
        bestName:'', bestSlotStyle:'', bestRanks:[], order:[]};
      out.openMap=false; out.mapPins=[]; out.mapNote='';
      out.cmpMap={ready:false,gus:[],pins:[],vb:'0 0 100 100',stroke:'0.5',legend:[],legendNote:''};
      out.addZoneOptions=[{id:'',label:'동네 더하기'}]; out.addZoneFull=false; out.onAddZone=()=>{};
      out.mapLabel='지도 보기'; out.mapBtn='display:none';
      out.toggleMap=()=>{};
      return out;
    }
    // ── 종합순위 ────────────────────────────────────────────────
    // 차트 세 개를 던져 놓고 "알아서 판단하세요"로 끝내지 않는다.
    // 담은 곳들 안에서 지표를 정규화하고 가중치를 곱해 순서를 낸다(logic/rank.js).
    // 순위는 '지금 고른 기준'에서의 순위다 — 기준을 바꾸면 즉시 다시 계산된다.
    const rentOf=o=>{ const rr=this.rentRef(o.name); return (rr&&rr.exact)? parseFloat(rr.value) : null; };
    const popOf=o=>{ const l=S.zlp&&S.zlp[o.id]; return (l&&Number.isFinite(l.tot))? l.tot : null; };
    const forRank=picks.map(o=>({
      id:o.id, name:this.zoneLabelOf(o.name), src:o,
      per:o.per/3, pop:popOf(o), stores:o.stores, sales:o.sales,
      rent:rentOf(o), vac:null
    }));
    const RK=this.rankZones(forRank);
    const byId={}; RK.list.forEach(o=>{ byId[o.id]=o; });
    const M=this.RANK_METRICS();
    const win=k=>this.winnerOf(RK.list,k);
    const wPer=win('per'), wPop=win('pop'), wStore=win('stores'), wSales=win('sales');
    const top=RK.list[0];
    // 1등과 2등이 사실상 같으면 1위라고 단정하지 않는다
    const clear = RK.list.length>1 && top._score!=null && RK.list[1]._score!=null
      && (top._score-RK.list[1]._score)>=1.5;

    const ga=n=>this.josa(n,'ga');
    const KOW=['','한','두','세','네','다섯'];
    const tieSent=KOW[picks.length]+' 곳이 모두 같습니다';
    const bigc='font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums';
    const MX={per:Math.max(...picks.map(o=>o.per)),sales:Math.max(...picks.map(o=>o.sales)),stores:Math.max(...picks.map(o=>o.stores))};
    const maxPop=Math.max(...RK.list.map(o=>o.pop||0),0)||null;

    // 종합 1위의 근거 — 지표별 순위에서 뽑는다. 뜬구름 문장을 쓰지 않는다.
    const whyWin=(()=>{
      if(!top) return [];
      const w=[];
      const r=top._rank||{};
      // 1위라도 동점이면 '가장'이라고 쓰지 않는다 — 공동 1위는 이긴 게 아니다
      if(wPer===top)   w.push({ok:true,  text:'예상 매출이 담은 곳 중 가장 높아요'});
      if(wPop===top)   w.push({ok:true,  text:'유동인구가 담은 곳 중 가장 많아요'});
      if(wSales===top) w.push({ok:true,  text:'상권 소비 규모가 가장 커요'});
      if(wStore===top) w.push({ok:true,  text:'같은 업종 경쟁이 가장 적어요'});
      if(!w.length && r.per===1) w.push({ok:true, text:'예상 매출이 담은 곳 중 가장 높은 축이에요 (공동 1위)'});
      const n=picks.length;
      if(r.stores===n) w.push({ok:false, text:'경쟁 점포는 담은 곳 중 가장 많아요'});
      if(r.per===n)    w.push({ok:false, text:'예상 매출은 담은 곳 중 가장 낮아요'});
      if(top.src.stores<10) w.push({ok:false, text:'표본이 '+top.src.stores+'곳뿐이라 참고 수준으로 봐주세요'});
      if(top._missing&&top._missing.length)
        w.push({ok:false, text:top._missing.join('·')+' 자료가 없어 이 기준에서 빼고 계산했어요'});
      return w.slice(0,4);
    })();

    out.c={
      headline:'담아 둔 '+picks.length+'곳, 어디로 할까요?',
      sub:'내가 고른 상권만 나란히 놓고 봅니다. 아래에서 무엇을 더 중요하게 볼지 바꿀 수 있어요.',
      empty:false, on:true, emptyCount:'', add:addBox,

      // ── 기준 고르기 — 누르면 순위가 바로 바뀐다
      presets:this.RANK_PRESETS().map(p=>({
        label:p.label,
        pick:()=>this.setState({rankW:p.k}),
        style:'flex:none;padding:9px 15px;border-radius:999px;font-size:13.5px;cursor:pointer;'
          +'white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;'
          +'transition:background .14s,color .14s;'
          +(p.k===RK.preset.k
            ? 'background:var(--color-primary);color:#FFFFFF;font-weight:600'
            : 'background:var(--color-surface);color:var(--color-text-secondary)')
      })),
      presetRail:this.rail('cmpPre',{per:5}),
      whyOpen:!!S.rankWhy,
      whyLabel:S.rankWhy? '기준 접기' : '추천 기준 보기',
      toggleWhy:()=>this.setState({rankWhy:!S.rankWhy}),
      why:this.rankWhy(),

      // ── 종합 1위
      hasVerdict:!!top,
      bestName: top? top.name : '',
      bestSlotStyle: top? 'flex:none;width:10px;height:10px;border-radius:50%;background:'+top._color : '',
      verdict: !top ? ''
        : this.tn(clear?'cmp.verdictClear':'cmp.verdictClose',
                  {name:top.name, preset:RK.preset.label}),
      // 매출 1위 / 유동인구 3위 / 경쟁 2위 — 근거를 숫자로 보여준다
      bestRanks: top? M.filter(m=>RK.preset.w[m.k]!=null && top._rank[m.k]).map(m=>({
        label:m.short,
        value:top._rank[m.k]+'위',
        style:'display:flex;flex-direction:column;gap:3px;min-width:64px'
      })) : [],
      verdictWhy: whyWin.map(w=>({text:w.text, mark:w.ok?'✓':'!',
        style:'display:flex;align-items:flex-start;gap:9px;font-size:14.5px;line-height:1.55;'
          +'color:'+(w.ok?'var(--color-text-secondary)':'var(--color-warning)')})),

      // ── 전체 순위
      order:RK.list.map(o=>({
        place:o._place+'위',
        name:o.name,
        dot:'flex:none;width:9px;height:9px;border-radius:50%;background:'+o._color,
        best:o._place===1,
        badge:o._place===1?'종합 1위':'',
        pick:()=>this.setState({sel:o.id}),
        style:'display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(o._place===1?'background:var(--color-primary-soft)':'background:var(--color-surface)')
      })),

      rail:this.rail('cmpCols',{per:3}),

      // ── 비교 차트 — 상권 색은 고정, 승자는 배지로(§39~41)
      charts:(()=>{
        const C=[];
        const push=(id,opt)=>{ const c=this.chartCard(id,opt); if(c) C.push(c); };
        const names=RK.list.map(o=>o.name);
        const cols=RK.list.map(o=>this.slotHex(o._slot));
        const q=this.qtr(r.quarter);
        const winOf=(o,badge,text)=> o? {name:o.name, badge:badge,
          value:text, text:text, color:this.slotHex(o._slot)} : null;

        push('cmp-per',{type:'bar', title:'어디가 더 많이 파나요?', sub:'가게 한 곳당 월매출 (추정)',
          unit:'원', period:q+' 기준', height:260, labels:names,
          datasets:[{label:'가게 한 곳당 월매출', data:RK.list.map(o=>Math.round(o.per)), colors:cols}],
          winner: wPer? {name:wPer.name, badge:'매출 1위', color:this.slotHex(wPer._slot),
            value:this.won(wPer.per),
            text:'담은 '+picks.length+'곳 중 예상 매출이 가장 높아요.'} : null});

        if(RK.list.some(o=>o.pop!=null))
          push('cmp-pop',{type:'bar', title:'어디에 사람이 더 많나요?', sub:'상권이 속한 행정동 하루 유동인구',
            unit:'명', period:q+' 기준', height:260, labels:names,
            datasets:[{label:'하루 유동인구', data:RK.list.map(o=>o.pop==null?null:Math.round(o.pop)), colors:cols}],
            winner: wPop? {name:wPop.name, badge:'수요 1위', color:this.slotHex(wPop._slot),
              value:Math.round(wPop.pop).toLocaleString()+'명',
              text:'담은 '+picks.length+'곳 중 유동인구가 가장 많아요.'} : null});

        push('cmp-store',{type:'bar', title:'어디가 경쟁이 덜한가요?', sub:'같은 업종 점포 수 · 적을수록 유리',
          unit:'곳', period:q+' 기준', height:260, labels:names,
          datasets:[{label:'같은 업종 점포 수', data:RK.list.map(o=>o.stores), colors:cols}],
          winner: wStore? {name:wStore.name, badge:'경쟁 유리', color:this.slotHex(wStore._slot),
            value:wStore.stores.toLocaleString()+'곳',
            text:'담은 '+picks.length+'곳 중 같은 업종 점포가 가장 적어요.'} : null});

        push('cmp-sales',{type:'bar', title:'어디에 돈이 더 도나요?', sub:'최근 3개월 상권 소비 합계',
          unit:'원', period:q+' 기준', height:260, labels:names,
          datasets:[{label:'3개월 소비 규모', data:RK.list.map(o=>o.sales), colors:cols}],
          winner: wSales? {name:wSales.name, badge:'소비 1위', color:this.slotHex(wSales._slot),
            value:this.won(wSales.sales),
            text:'담은 '+picks.length+'곳 중 손님이 쓴 돈이 가장 많아요.'} : null});
        return C;
      })(),
      chartRail:this.rail('cmpCh',{per:1}),
      hasCharts:true,

      cols:RK.list.map(o=>{
        const src=o.src, first=o._place===1;
        return {
        name:o.name, rank:(S.zgu&&S.zgu[o.id])||'',
        diag:()=>this.setState({sel:o.id,screen:'diag'}),
        drop:()=>this.setState({picks:PICKS.filter(x=>x!==o.id)}),
        best:first,
        badge:first?'🥇 종합 1위':(o._place+'위'),
        badgeStyle:'flex:none;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap;'
          +(first?'background:var(--color-primary);color:#FFFFFF'
                 :'background:var(--color-surface);color:var(--color-text-secondary)'),
        // 카드 왼쪽 굵은 띠가 그 상권의 색이다 — 아래 차트와 같은 색
        dot:'flex:none;width:10px;height:10px;border-radius:50%;background:'+o._color,
        cardStyle:'background:var(--color-background);border:1px solid '
          +(first?'var(--color-primary)':'var(--color-border)')
          +';border-left:5px solid '+o._color
          +';border-radius:var(--r-lg);padding:20px;min-width:0;position:relative',
        cells:[
          {label:'예상 매출 (추정)', value:monthly(src.per),
           note:o===wPer?'담은 곳 중 가장 높아요':'',
           valStyle:bigc,
           bar:'width:'+Math.max(Math.min(src.per/MX.per,1)*100,2).toFixed(1)+'%;height:100%;background:'+o._color+';border-radius:2px'},
          {label:'경쟁 점포', value:src.stores.toLocaleString()+'곳',
           note:o===wStore?'담은 곳 중 경쟁이 가장 적어요':'',
           valStyle:bigc,
           bar:'width:'+Math.max((1-(src.stores/(MX.stores*1.15)))*100,2).toFixed(1)+'%;height:100%;background:'+o._color+';border-radius:2px'},
          {label:'유동인구', value:o.pop!=null? Math.round(o.pop).toLocaleString()+'명':'자료 없음',
           note:(o.pop!=null&&o===wPop)?'담은 곳 중 사람이 가장 많아요':'',
           valStyle:bigc+(o.pop==null?';color:var(--color-text-muted)':''),
           bar:(o.pop!=null&&maxPop)?('width:'+Math.max(o.pop/maxPop*100,3).toFixed(1)+'%;height:100%;background:'+o._color+';border-radius:2px'):null},
          {label:'상권 소비 규모', value:this.won(src.sales),
           note:o===wSales?'담은 곳 중 가장 커요':'',
           valStyle:bigc,
           bar:'width:'+Math.max(Math.min(src.sales/MX.sales,1)*100,2).toFixed(1)+'%;height:100%;background:'+o._color+';border-radius:2px'}
        ]};
      }),
      diffs:[
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--color-primary);flex:none;margin-top:9px',
         text: (wSales&&wStore&&wSales!==wStore)? '손님이 가장 많은 곳은 '+wSales.name+', 경쟁이 가장 적은 곳은 '+wStore.name+'이에요.'
             : (wSales&&wSales===wStore)? wSales.name+this.josa(wSales.name,'eun')+' 손님이 가장 많으면서 경쟁도 가장 적어요.'
             : (wSales? '손님이 가장 많은 곳은 '+wSales.name+'이에요. 경쟁 가게 수는 '+tieSent+'.'
                  : (wStore? '경쟁이 가장 적은 곳은 '+wStore.name+'이에요. 손님 수는 '+tieSent+'.'
                       : '손님 수도 경쟁 가게 수도 '+tieSent+'. 이것만으로는 우열을 가릴 수 없어요.'))},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--color-primary-mid);flex:none;margin-top:9px',
         text: wPer? '한 집당 월매출은 '+wPer.name+ga(wPer.name)+' '+monthly(wPer.src.per)+'으로 가장 높아요.'
                 : '한 집당 월매출은 '+tieSent+'. 이 항목으로는 구분되지 않아요.'},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--color-warning);flex:none;margin-top:9px',
         text:'임대료는 상권 단위 자료가 대부분 없어요. 중개인에게 확인한 금액을 정밀비교에 직접 넣어 견주세요.'}
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
    // 색은 '어느 상권인지'만 뜻한다 — 좋다/나쁘다는 배지와 문장으로만 말한다
    out.c.honesty=this.t('cmp.honesty',{q:this.qtr(r.quarter), ind:this.indName(S.ind)});
    return out;
  }
};
