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
    if(!r) return {text:'아직 데이터를 불러오지 못했습니다. 잠시 후 다시 물어봐 주세요.'};
    const L=r.list, top=L[0];
    const monthly=v=>this.fmt(v/3)+'원';
    if(/어디|추천|자리|후보/.test(t)) return {
      text:this.indName(S.ind)+this.josa(this.indName(S.ind),'ramyeon')+' '+top.name+this.josa(top.name,'eul')+' 먼저 보시면 좋아요.',
      facts:[{label:'기회점수',value:Math.round(top.score)+'점'},
             {label:'경쟁 가게',value:top.stores.toLocaleString()+'곳'},
             {label:'한 집당 월매출',value:monthly(top.per)}],
      source:'서울시 상권분석서비스 '+this.qtr(r.quarter)+' 자료로 계산했어요. 기회점수는 저희가 만든 값이에요.',
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
  },

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
};
