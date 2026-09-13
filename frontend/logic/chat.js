'use strict';
// 도우미 — 이 서비스가 계산한 값만 근거로 답한다
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.chat = {
  answer(q, r, sel){
    const t=(q||'').trim();
    const S=this.state;
    if(!t) return null;
    // 문구는 전부 사전에 있다(§i18n). 여기서 한국어를 이어 붙이면
    // 영어·중국어 화면에서 도우미만 한국어로 답한다 — 실제로 그랬다.
    const ind=S.ind?this.tr(this.indName(S.ind)):'';
    if(!r) return {text:this.t('chat.noData')};
    const L=r.list, top=L[0];
    const monthly=v=>this.won(v);
    if(/어디|추천|자리|후보/.test(t)) return {
      text:this.tn('chat.where.text',{ind:ind, zone:this.zoneLabelOf(top.name)}),
      facts:[{label:this.t('chat.where.score'),value:Math.round(top.score)+'점'},
             {label:this.t('chat.where.stores'),value:top.stores.toLocaleString()+'곳'},
             {label:this.t('chat.where.per'),value:monthly(top.per)}],
      source:this.t('chat.where.src',{q:this.qtr(r.quarter)}),
      cta:this.t('chat.where.cta'), go:'find'
    };
    if(/임대료|월세|보증금|권리금/.test(t)) return {
      text:this.t('chat.rent.text'),
      source:this.t('chat.rent.src'),
      cta:this.t('chat.rent.cta'), go:'diag'
    };
    if(/본전|손익|얼마.*팔|매출.*필요/.test(t)){
      const c=this.calc(sel);
      if(c.valid===false) return {text:c.error,cta:this.t('chat.bep.cta'),go:'diag'};
      return {
        text:this.tn('chat.bep.text',{zone:this.zoneLabelOf(sel.name), amt:this.man(c.bep)}),
        facts:[{label:this.t('chat.bep.bep'),value:this.man(c.bep)},
               {label:this.t('chat.bep.avg'),value:this.man(c.avg)},
               {label:this.t('chat.bep.fixed'),value:this.man(c.fixed)}],
        source:this.t('chat.bep.src',{rent:this.man(c.rent), cogs:Math.round(c.cogs*100), area:c.area}),
        cta:this.t('chat.bep.cta'), go:'diag'
      };
    }
    if(/손님|누가|연령|나이|성별/.test(t)){
      const I=S.sbi&&S.sbi.ind?S.sbi.ind[S.ind]:null;
      if(!I) return {text:this.t('chat.cust.none')};
      const AL=['0~19세','20대','30대','40대','50대','60~74세'];
      let hi=0; I.age.forEach((v,i)=>{ if(v>I.age[hi]) hi=i; });
      const age=this.tr(AL[hi]);
      return {
        text:this.tn('chat.cust.text',{ind:ind, age:age}),
        facts:[{label:age,value:I.age[hi].toFixed(1)+'%'},
               {label:this.t('chat.cust.female'),value:I.gender[1]+'%'},
               {label:this.t('chat.cust.unit'),value:this.wonRaw(I.unit)}],
        source:this.t('chat.cust.src',{ind:ind})
      };
    }
    if(/폐업|위험|망|개업/.test(t)){
      const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
      if(!R) return {text:this.t('chat.risk.none')};
      return {
        text:this.tn(R.closed>R.opened?'chat.risk.down':'chat.risk.up',{ind:ind}),
        facts:[{label:this.t('chat.risk.closed'),value:R.closed.toLocaleString()+'곳'},
               {label:this.t('chat.risk.opened'),value:R.opened.toLocaleString()+'곳'},
               {label:this.t('chat.risk.fr'),value:R.fr_share+'%'}],
        source:this.t('chat.risk.src')
      };
    }
    return {
      text:this.t('chat.none.text'),
      source:this.t('chat.none.src')
    };
  },

  chat(){
    const S=this.state;
    const r=this.rank();
    const sel = r ? (S.sel? (r.list.find(o=>o.id===S.sel)||r.list[0]) : r.list[0]) : null;
    const log = S.chat || [{who:'ai', text:this.t('chat.hello',{ind:this.tr(this.indName(S.ind))})}];
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
            +(me?'background:var(--accent);color:var(--on-accent)':'background:var(--surface);color:var(--ink)'),
          textStyle:'font-size:15.5px;line-height:1.55;letter-spacing:-0.012em;text-wrap:pretty',
          text:m.text,
          hasFacts:!!(m.facts&&m.facts.length), facts:m.facts||[],
          hasSource:!!m.source, source:m.source||'',
          hasCta:!!m.cta, cta:m.cta||'',
          ctaGo:()=>this.setState({screen:m.go||'find'})
        };
      }),
      chips:CH.map(c=>({label:c, ask:()=>ask(c),
        style:'flex:none;font-size:13.5px;padding:9px 15px;border-radius:999px;background:var(--surface);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;transition:color .16s'})),
      draft:S.draft||'',
      onDraft:e=>this.setState({draft:e.target.value}),
      onKey:e=>{ if(e.key==='Enter'&&(S.draft||'').trim()) ask(S.draft.trim()); },
      send:()=>{ if((S.draft||'').trim()) ask(S.draft.trim()); },
      sendStyle:'flex:none;font-size:14.5px;font-weight:500;border:none;border-radius:12px;padding:0 18px;height:42px;cursor:pointer;transition:opacity .16s;'
        +((S.draft||'').trim()?'background:var(--accent);color:var(--on-accent)':'background:transparent;color:var(--ink3)')
    };
  }
};
