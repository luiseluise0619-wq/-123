'use strict';
// 본전 계산·입력·수요 및 위험 근거 화면. 계산 엔진은 util.calc를 그대로 사용한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.diagnosis = {
  fillDiagnosisView(out, sel, L){
    const S=this.state;
    const {arrowUp,arrowDn,arrowInfo}=MysbizonConst.TREND_STYLES;
    // ── 진단
    const c=this.calc(sel), over=c.profit>=0;
    const revName = S.scen==='적게 팔릴 때'?'적게 팔릴 때':(S.scen==='잘될 때'?'잘될 때':'이 자리 평균');
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
      headline: over?'지금 조건에서는 본전을 넘어요.':'지금 조건에서는 본전에 못 미쳐요.',
      bep:this.man(c.bep), rev:this.man(c.rev), revName:revName,
      // 값이 작은 쪽이 왼쪽 — 라벨 순서를 막대 위치에서 끌어낸다
      gaugeLabels:[{v:c.rev,label:revName,value:this.man(c.rev)},{v:c.bep,label:'본전',value:this.man(c.bep)}]
        .sort((a,b)=>a.v-b.v)
        .map((g,i)=>({label:g.label, value:g.value,
          // 영어 라벨은 길다('Average for this spot') — 못 줄이면 390px 화면이 밀린다.
          // 줄바꿈은 허용하고, 금액만 안 끊기게 둔다(아래 조각의 <b>).
          style:(i===0?'text-align:left':'text-align:right;margin-left:auto')})),
      fill:'position:absolute;left:0;top:0;bottom:0;width:'+Math.max(Math.min(c.rev/mx*100,100),1).toFixed(1)+'%;border-radius:6px;background:'+(over?'var(--good)':'var(--warn)')+';transition:width .2s cubic-bezier(.2,.7,.3,1)',
      mark:'position:absolute;top:-7px;bottom:-7px;left:'+Math.min(c.bep/mx*100,100).toFixed(1)+'%;width:2px;background:var(--ink);border-radius:1px;transition:left .2s cubic-bezier(.2,.7,.3,1)',
      gapStyle:'font-size:13px;margin-top:11px;font-weight:500;white-space:nowrap;color:'+(over?'var(--good)':'var(--warn)'),
      gap: this.t(over?'diag.left':'diag.short',{amt:this.man(Math.abs(c.profit))}),
      factors:[
        over? {sign:'↑', arrow:arrowUp, text:'이 매출이면 인건비·임대료를 덮어요'}
            : {sign:'↓', arrow:arrowDn, text:this.t('diag.fixed',{amt:this.man(c.fixed)})},
        over
          ? {sign:'↑', arrow:arrowUp, text:'하루 '+(dailyCnt?dailyCnt.toLocaleString()+'건':'—')+'이 본전선인데, 이 매출이면 넘어요'}
          : {sign:'↓', arrow:arrowDn, text:'하루 '+(dailyCnt?dailyCnt.toLocaleString()+'건':'—')+'까지 올려야 본전이에요'},
        // 회수기간 = 초기투자 ÷ 월 영업이익. 안 넣으면 넣으라고만 말한다(지어내지 않는다).
        c.payback!=null
          ? {sign:'↑', arrow:arrowUp,
             text:'초기투자 '+this.man(c.invest)+'을 되찾는 데 약 '+Math.ceil(c.payback)+'개월'}
          : (c.invest>0
            ? {sign:'↓', arrow:arrowDn, text:'지금 조건에서는 초기투자를 회수하지 못해요'}
            : {sign:'·', arrow:arrowInfo, text:'초기투자를 넣으면 회수기간도 나와요'})
      ],
      thinStyle: sel.stores<=5?'font-size:12.5px;color:var(--warn);margin-top:26px;max-width:600px;text-wrap:pretty':'display:none',
      // 업종 이름이 문장 안에 들어가면 통째로는 사전에서 못 찾는다 — 자리표시자로 둔다
      thin: sel.stores>5 ? ''
        : this.t('diag.thinAvg',{ind:this.tr(this.indName(S.ind)), n:sel.stores}),
      honesty:'본전 = 고정비 ÷ (1 − 원가율). 임대료와 평수는 입력값이며 처음에는 기본 가정이 들어 있어요. 직원 수와 기타 운영비는 평수에서 자동으로 잡은 값이고(10평당 1명 · 평당 6만원, 우리 기준), 칸에 직접 넣으면 그 값을 써요. 원가율도 기본 가정이라 고칠 수 있어요. '
        +'매출은 이 자리에서 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아니에요. 보수적 70%·낙관적 130%는 우리가 정한 배수예요. '
        +'세금·대출 이자는 넣지 않았어요. 회수기간은 초기투자(보증금+권리금+인테리어) ÷ 월 영업이익이고, 보증금은 나갈 때 돌려받지만 묶이는 돈이라 포함했어요.'
    };

    const num=k=>e=>{const v=e.target.value;this.setState({[k]:v===''?'':this.bound(v,0,k==='cogs'?95:100000,0)});};
    const ovr=k=>e=>{const v=e.target.value;this.setState({[k]:v===''?null:this.bound(v,0,k==='staffOv'?100:100000,0)});};

    // 다른 화면과 같은 방식으로 접는다 — 문장은 그대로 두고 '데이터 기준 보기' 안으로 넣는다.
    out.d.note=this.dataNote('bep', '본전 = 고정비 ÷ (1 − 원가율) 로 계산해요.', [['계산 기준', out.d.honesty]]);
    // 평수 하나로 규모가 움직인다
    // 슬라이더는 '계산에 쓰는 평수'를 보여준다. 설문에서 상한을 넘는 값을 넣었을 때
    // 슬라이더만 다른 숫자를 들고 있으면 화면과 계산이 어긋난다.
    out.area=c.area;
    out.onArea=e=>this.setState({area:this.bound(e.target.value,1,1000,globalThis.MysbizonConst.BEP_DEFAULT.area)});
    out.areaLabel=c.area+'평';
    out.areaWord=c.area<=10?'작은 가게':(c.area<=25?'보통 가게':'큰 가게');
    out.linked=[
      {label:'직원', value:c.staff+'명', tag:c.staffAuto?'평수 따라 자동':'직접 넣은 값'},
      {label:'인건비', value:this.man(c.labor), tag:'1인 250만원'},
      {label:'기타 운영비', value:this.man(c.etc), tag:c.etcAuto?'평수 따라 자동':'직접 넣은 값'},
      {label:'평당 임대료', value:this.man(Math.round(c.rent/c.area)), tag:'임대료 ÷ 평수'}
    ];
    out.linkNote='평수를 움직이면 직원 수와 기타 운영비가 같이 바뀌어요. 10평당 1명, 평당 6만원으로 잡은 우리 기준이라 실제와 다를 수 있고, 아래 칸에 직접 넣으면 그 값을 써요. 임대료는 상권별 평당 시세가 공개되지 않아 자동으로 채울 수 없어요.';

    // 어떤 경로로든 숫자가 아닌 값이 상태에 들어오면 칸을 비운다 —
    // 'Infinity' 나 'NaN' 이 입력칸에 그대로 보이면 안 된다.
    const numIn=v=>(v===''||v==null)? v : (Number.isFinite(Number(v))? v : '');
    out.inputs=[
      {label:'월 임대료 (만원)', value:numIn(S.rent), onChange:num('rent'), tag:'기본 400만원 · 실제 금액으로 수정'},
      {label:'원가율 (%)', value:numIn(S.cogs), onChange:num('cogs'), tag:'기본 가정 · 수정 가능'},
      {label:'직원 수 (명)', value:numIn(S.staffOv==null?'':S.staffOv), onChange:ovr('staffOv'), tag:c.staffAuto?'비우면 '+c.staff+'명':'직접 넣은 값'},
      {label:'기타 운영비 (만원)', value:numIn(S.etcOv==null?'':S.etcOv), onChange:ovr('etcOv'), tag:c.etcAuto?'비우면 '+c.etc+'만원':'직접 넣은 값'},
      // 처음 한 번 나가는 돈 — 회수기간(초기투자 ÷ 월 영업이익)에만 쓴다.
      // 기본값을 두지 않는다. 상권별 보증금·권리금은 공개 자료가 없어 지어낼 수 없다(§1).
      {label:'보증금 (만원)', value:numIn(S.deposit==null?'':S.deposit), onChange:num('deposit'), tag:'나갈 때 돌려받지만 묶이는 돈이라 포함'},
      {label:'권리금 (만원)', value:numIn(S.premium==null?'':S.premium), onChange:num('premium'), tag:'없으면 비워 두세요'},
      {label:'인테리어 (만원)', value:numIn(S.interior==null?'':S.interior), onChange:num('interior'), tag:'설비·집기까지 합쳐서'}
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
        word: c.rev>0? (v/c.rev>=0.4?'가장 무거워요':(v/c.rev>=0.2?'부담돼요':'가벼워요')) : ''};
    });
    // 항목별 독립 막대다 — 한 예산을 나눠 쓰는 그림이 아니라고 분명히 쓴다
    const totPct=c.rev>0? Math.round((c.rev*c.cogs+c.rent+c.labor+c.etc)/c.rev*100) : 0;
    out.dotNote = c.rev>0
      ? (totPct>100
        ? '한 줄이 매출 전체(20칸)이고, 칠한 칸이 그 항목이 가져가는 몫이에요. 네 항목을 더하면 '+totPct+'%로 매출을 넘어서 남는 게 없어요.'
        : '한 줄이 매출 전체(20칸)이고, 칠한 칸이 그 항목이 가져가는 몫이에요. 네 항목을 더하면 '+totPct+'%, 나머지 '+(100-totPct)+'%가 내 몫이에요.')
      : '';
    out.scens=['적게 팔릴 때','보통일 때','잘될 때'].map(p=>({
      label:p, pick:()=>this.setState({scen:p}),
      style:'font-size:14px;padding:9px 18px;border-radius:9px;cursor:pointer;white-space:nowrap;min-height:40px;display:inline-flex;align-items:center;transition:background .16s;'+(S.scen===p?'background:var(--card);color:var(--ink);font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,.06)':'color:var(--ink2)')
    }));
    out.scenNote = S.scen==='적게 팔릴 때'? '이 동네 평균의 70%만 팔린다고 보고 계산해요. 70%는 우리가 정한 값이에요.'
      : (S.scen==='잘될 때'? '이 동네 평균보다 30% 더 팔린다고 보고 계산해요. 30%는 우리가 정한 값이에요.'
      : this.t('bep.scenNote',{ind:this.tr(this.indName(S.ind))}));
    out.condHint=this.t('diag.cond',{area:c.area, rent:this.man(c.rent), n:c.staff});

    const parts=[['원가',c.rev*c.cogs,'var(--accent)'],['임대료',c.rent,'var(--accent-2)'],['인건비',c.labor,'var(--accent-3)'],['기타',c.etc,'var(--ink2)']];
    if(c.profit>0) parts.push(['남는 돈',c.profit,'var(--good)']);
    // 1만원 기준으로 바꿔 말한다 — 금액보다 비중이 바로 읽힌다
    const tot=parts.reduce((a,[,v])=>a+Math.max(v,0),0)||1;
    // 몫을 먼저 계산하고 그 다음에 글자로 만든다.
    //   wonRaw() 는 '10,000원' 같은 **글자**를 돌려준다. 그걸 곱셈 안에 넣고 있어서
    //   화면에 값 대신 NaN 이 다섯 줄 떴다(본전 계산 › '돈이 어디로 나가나요?').
    out.stack=parts.map(([label,v,col])=>({label, amount:this.man(v),
      won:this.wonRaw(Math.round(Math.max(v,0)/tot*10000)),
      style:'flex:'+Math.max(v,0.01)+' 0 auto;background:'+col+';display:block',
      chip:'width:9px;height:9px;border-radius:2px;background:'+col+';display:inline-block'}));
    out.stackLead=(()=>{
      const left=c.profit>0?Math.round(c.profit/tot*10000):0;
      return c.profit>0
        ? '1만원어치 팔면 '+left.toLocaleString()+'원이 남아요.'
        : '1만원어치 팔면 '+Math.round(Math.abs(c.profit)/tot*10000).toLocaleString()+'원이 모자라요.';
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
      ? this.t('bep.dayWhy',{bep:this.man(c.bep), src:this.tr(unitSrc), unit:unit.toLocaleString(), ind:this.tr(this.indName(S.ind))})
      : '이 장사는 결제 1건당 추정 금액이 자료에 없어 건수를 낼 수 없어요.';

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
      // 면 색마다 그 위에 얹을 글자색이 따로 있다 — 어두운 화면에서 흰 글자는 2.9:1 까지 떨어진다
      const state=ratio<=0.7?{t:'여유',c:'var(--good)',fg:'var(--on-good)'}
        :(ratio<=1.3?{t:'보통',c:'var(--ink2)',fg:'var(--card)'}
        :{t:'과밀',c:'var(--warn)',fg:'var(--on-warn)'});
      return {
        has:true,
        lead:this.tn('sat.lead',{ind:this.tr(this.indName(S.ind)), v:me.v.toFixed(1), med:med.toFixed(1), word:this.tr(state.t)}),
        mine:me.v.toFixed(1)+'개', medText:med.toFixed(1)+'개',
        badge:state.t,
        badgeStyle:'display:inline-block;font-size:12px;font-weight:600;padding:5px 11px;border-radius:999px;white-space:nowrap;color:'+state.fg+';background:'+state.c,
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
        lead: '이 동네에 하루 '+Math.round(lp.tot).toLocaleString()+'명이 오가요.',
        stats:[
          {label:'하루 오가는 사람', value:Math.round(lp.tot).toLocaleString()+'명', tag:this.placeName(lp.dong)},
          {label:'추정 객단가', value:this.wonRaw(Math.round(perHead)), tag:'(추정)'},
          {label:'가장 많은 나이', value:AL[hi], tag:''},
          {label:'여성 비율', value:Math.round(lp.f/lp.tot*100)+'%', tag:''}
        ],
        note:this.t('pop.noteLong',{dong:this.placeName(lp.dong)})
      };
    })();
    out.riskLead = R? (R.closed>R.opened
      ? '가게가 줄고 있어요. 경쟁이 풀리는 신호일 수도, 업종이 어려워지는 신호일 수도 있어요.'
      : '가게가 늘고 있어요. 지금 계산한 한 집당 매출은 앞으로 더 나뉠 수 있어요.') : '';
    out.riskHint = R? (R.closed>R.opened? '줄고 있음':'늘고 있음') : '—';

  }
};
