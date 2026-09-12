'use strict';
// 담은 상권 검색·추가·비교 순위 화면. 후보지와 같은 목록·선택 규칙을 사용한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.comparison = {
  fillComparisonView(out, r, L, PICKS, pickToggle, pickLabelOf){
    const S=this.state;
    const monthly=v=>this.won(v/3);
    // ── 비교
    const picks=PICKS.map(id=>L.find(o=>o.id===id)).filter(Boolean);

    // ── 비교할 상권 찾기 ─────────────────────────────────────────
    // 구별 목록으로 이름을 몰라도 탐색한다. 검색은 같은 목록을 좁힌다.
    // 다른 화면으로 보내지 않는다 — 보내면 '내가 어디 있는지'를 잃는다.
    const rawQ=(S.cmpQ||'').trim();
    const cq=rawQ.replace(/\s/g,'');
    const zgu=S.zgu||{};
    const nameOfZ=o=>this.zoneLabelOf(o.name);
    const row=o=>({
      id:o.id,
      name:nameOfZ(o),
      meta:[this.placeName(zgu[o.id]||''), this.won(o.per/3)].filter(Boolean).join(' · '),
      add:()=>{ const current=this.state.picks||[]; if(current.length>=5||current.includes(o.id)) return;
        // 담으면 검색어를 비우고 최근 본 목록에 남긴다
        const recent=[o.id, ...(S.cmpRecent||[]).filter(x=>x!==o.id)].slice(0,6);
        this.setState({picks:[...current,o.id], cmpQ:'', cmpRecent:recent,cmpAddOpen:true}); },
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
    const gus=[...new Set(L.map(o=>zgu[o.id]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    const gu=gus.includes(S.cmpGu)?S.cmpGu:'';
    const available=L.filter(o=>!gu||zgu[o.id]===gu);
    const found=available.filter(o=>PICKS.indexOf(o.id)<0).filter(hit).slice(0,8).map(row);
    const browse=available.filter(o=>!rawQ||hit(o)).slice().sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    const limit=Math.max(12,Math.min(S.cmpLimit||12,browse.length));
    const addBox={
      browseTitle:this.t('cmp.browseTitle'),browseHint:this.t('cmp.browseHint'),
      guLabel:this.t('market.gu'),guValue:String(gus.indexOf(gu)+1),
      guOptions:[{value:'0',label:this.t('pr.seoulAll')},...gus.map((g,i)=>({value:String(i+1),label:this.placeName(g)}))],
      onGu:e=>{const i=Number(e.target.value);if(Number.isInteger(i)&&i>=0&&i<=gus.length)this.setState({cmpGu:gus[i-1]||'',cmpLimit:12,cmpQ:''});},
      browseRows:browse.slice(0,limit).map(o=>({...row(o),disabled:PICKS.includes(o.id)||PICKS.length>=5,
        action:this.t(PICKS.includes(o.id)?'cmp.selected':'cmp.add')})),
      browseCount:this.t('cmp.browseCount',{n:browse.length}),
      browseEmpty:browse.length===0,emptyBrowseText:this.t('cmp.browseEmpty'),
      hasMore:browse.length>limit,moreLabel:this.t('cmp.more'),
      more:()=>this.setState({cmpLimit:limit+12}),
      q:S.cmpQ||'',
      onQ:e=>this.setState({cmpQ:e.target.value,cmpLimit:12}),
      // Enter 는 첫 결과를 담는다 — 검색창에서 손을 떼지 않아도 되게
      onKey:e=>{ if(e.key!=='Enter') return;
        if(found.length&&PICKS.length<5) found[0].add(); },
      clear:()=>this.setState({cmpQ:''}),
      hasQ:!!rawQ,
      searching:!!rawQ,
      noResult: !!rawQ && found.length===0,
      noResultText:this.tn('cmp.noZone',{q:rawQ}),
      full:PICKS.length>=5,
      fullText:'5곳까지 담을 수 있어요. 하나를 빼면 다른 곳을 담을 수 있어요.',
      // 담을 게 없을 때만 펼쳐 둔다. 이미 비교 중이면 결론이 먼저다(§19·§35).
      open: PICKS.length<2 ? true : !!S.cmpAddOpen,
      canFold: PICKS.length>=2,
      toggle:()=>this.setState({cmpAddOpen:!S.cmpAddOpen}),
      toggleLabel: S.cmpAddOpen? '닫기' : '+ 상권 추가'
    };

    if(picks.length<2){
      out.c={
        headline:'상권을 비교해 보세요',
        sub:this.t('cmp.emptySubFive'),
        emptyCount: picks.length===1? '지금 1곳 담았어요. 한 곳만 더 담으면 비교가 시작돼요.' : '',
        // 담은 게 하나면 그 카드도 보여 준다 — 담은 게 사라진 것처럼 보이면 안 된다
        cols:picks.map(o=>({
          name:this.zoneLabelOf(o.name), rank:(S.zgu&&S.zgu[o.id])||'',
          diag:()=>this.setState({sel:o.id,screen:'diag'}),
          drop:()=>this.setState({picks:PICKS.filter(x=>x!==o.id)}),
          best:false,
          badge:'', badgeStyle:'display:none',
          dot:'display:none',
          cardStyle:'background:var(--card);border:1px solid var(--line);'
            +'border-radius:var(--r-lg);padding:20px;min-width:0;position:relative',
          cells:[{label:'상권 참고 매출 (추정)', value:this.won(o.per/3), note:'',
                  valStyle:'font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums', bar:null},
                 {label:'경쟁 점포', value:o.stores.toLocaleString()+'곳', note:'',
                  valStyle:'font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums', bar:null}]
        })),
        add:addBox, rail:this.rail('cmpCols',{per:3}),
        charts:[], chartRail:this.rail('cmpCh',{per:1, peek:false, arrows:true}), hasCharts:false,
        diffs:[], honesty:'', empty:true, on:picks.length>0,
        verdict:'', verdictWhy:[], hasVerdict:false,
        // 순위 UI 는 두 곳 이상 담아야 뜬다 — 자리만 비워 둔다
        presets:[], presetRail:this.rail('cmpPre',{per:5}),
        whyOpen:false, whyLabel:'', toggleWhy:()=>{}, why:{label:'',rows:[],how:''},
        bestName:'', bestSlotStyle:'', bestRanks:[], order:[]};
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
    const tieSent=KOW[picks.length]+' 곳이 모두 같아요';
    const bigc='font-size:21px;font-weight:600;letter-spacing:-0.02em;margin-top:3px;font-variant-numeric:tabular-nums';
    const MX={per:Math.max(...picks.map(o=>o.per)),sales:Math.max(...picks.map(o=>o.sales)),stores:Math.max(...picks.map(o=>o.stores))};
    const maxPop=Math.max(...RK.list.map(o=>o.pop||0),0)||null;

    // 현재 가중치에서 점수가 가장 높은 후보의 근거 — 지표별 순위에서 뽑는다.
    const whyWin=(()=>{
      if(!top) return [];
      const w=[];
      const r=top._rank||{};
      // 1위라도 동점이면 '가장'이라고 쓰지 않는다 — 공동 1위는 이긴 게 아니다
      if(wPer===top)   w.push({ok:true,  text:'상권 참고 매출이 담은 곳 중 가장 높아요'});
      if(wPop===top)   w.push({ok:true,  text:'유동인구가 담은 곳 중 가장 많아요'});
      if(wSales===top) w.push({ok:true,  text:'상권 소비 규모가 가장 커요'});
      if(wStore===top) w.push({ok:true,  text:'같은 업종 경쟁이 가장 적어요'});
      if(!w.length && r.per===1) w.push({ok:true, text:'상권 참고 매출이 담은 곳 중 가장 높은 축이에요 (공동 1위)'});
      const n=picks.length;
      if(r.stores===n) w.push({ok:false, text:'경쟁 점포는 담은 곳 중 가장 많아요'});
      if(r.per===n)    w.push({ok:false, text:'상권 참고 매출은 담은 곳 중 가장 낮아요'});
      if(top.src.stores<10) w.push({ok:false, text:'표본이 '+top.src.stores+'곳뿐이라 참고 수준으로 봐주세요'});
      if(top._missing&&top._missing.length)
        w.push({ok:false, text:top._missing.join('·')+' 자료가 없어 이 기준에서 빼고 계산했어요'});
      return w.slice(0,4);
    })();

    out.c={
      headline:'담아 둔 '+picks.length+'곳, 어디로 할까요?',
      sub:'내가 고른 상권만 나란히 놓고 봐요. 아래에서 무엇을 더 중요하게 볼지 바꿀 수 있어요.',
      empty:false, on:true, emptyCount:'', add:addBox,

      // ── 기준 고르기 — 누르면 순위가 바로 바뀐다
      presets:this.RANK_PRESETS().map(p=>({
        label:p.label,
        pick:()=>this.setState({rankW:p.k}),
        style:'flex:none;padding:9px 15px;border-radius:999px;font-size:13.5px;cursor:pointer;'
          +'white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;'
          +'transition:background .14s,color .14s;'
          +(p.k===RK.preset.k
            ? 'background:var(--color-primary);color:var(--on-accent);font-weight:600'
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
                  {name:top.name, preset:this.tr(RK.preset.label)}),
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
        badge:o._place===1?'저장한 후보 중 1위':'',
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

        push('cmp-per',{type:'bar', title:'점포당 참고 매출은 어디가 높나요?', sub:'같은 기간·업종의 점포당 참고 매출 (추정)',
          unit:'원', period:q, height:260, labels:names,
          datasets:[{label:'점포당 참고 매출', data:RK.list.map(o=>Math.round(o.per)), colors:cols}],
          winner: wPer? {name:wPer.name, badge:'매출 1위', color:this.slotHex(wPer._slot),
            value:this.won(wPer.per),
            text:'담은 '+picks.length+'곳 중 상권 참고 매출이 가장 높아요.'} : null});

        if(RK.list.some(o=>o.pop!=null))
          push('cmp-pop',{type:'bar', title:'어디에 사람이 더 많나요?', sub:'상권이 속한 행정동 하루 유동인구',
            unit:'명', period:q, height:260, labels:names,
            datasets:[{label:'하루 유동인구', data:RK.list.map(o=>o.pop==null?null:Math.round(o.pop)), colors:cols}],
            winner: wPop? {name:wPop.name, badge:'수요 1위', color:this.slotHex(wPop._slot),
              value:Math.round(wPop.pop).toLocaleString()+'명',
              text:'담은 '+picks.length+'곳 중 유동인구가 가장 많아요.'} : null});

        push('cmp-store',{type:'bar', title:'어디가 경쟁이 덜한가요?', sub:'같은 업종 점포 수 · 적을수록 유리',
          unit:'곳', period:q, height:260, labels:names,
          datasets:[{label:'같은 업종 점포 수', data:RK.list.map(o=>o.stores), colors:cols}],
          winner: wStore? {name:wStore.name, badge:'경쟁 유리', color:this.slotHex(wStore._slot),
            value:wStore.stores.toLocaleString()+'곳',
            text:'담은 '+picks.length+'곳 중 같은 업종 점포가 가장 적어요.'} : null});

        push('cmp-sales',{type:'bar', title:'어디에 돈이 더 도나요?', sub:'최근 3개월 상권 소비 합계',
          unit:'원', period:q, height:260, labels:names,
          datasets:[{label:'3개월 소비 규모', data:RK.list.map(o=>o.sales), colors:cols}],
          winner: wSales? {name:wSales.name, badge:'소비 1위', color:this.slotHex(wSales._slot),
            value:this.won(wSales.sales),
            text:'담은 '+picks.length+'곳 중 손님이 쓴 돈이 가장 많아요.'} : null});
        return C;
      })(),
      chartRail:this.rail('cmpCh',{per:1, peek:false, arrows:true}),
      hasCharts:true,

      cols:RK.list.map(o=>{
        const src=o.src, first=o._place===1;
        return {
        name:o.name, rank:this.placeName((S.zgu&&S.zgu[o.id])||''),
        diag:()=>this.setState({sel:o.id,screen:'diag'}),
        drop:()=>this.setState({picks:PICKS.filter(x=>x!==o.id)}),
        best:first,
        badge:first?'🥇 저장한 후보 중 1위':(o._place+'위'),
        badgeStyle:'flex:none;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap;'
          +(first?'background:var(--color-primary);color:var(--on-accent)'
                 :'background:var(--color-surface);color:var(--color-text-secondary)'),
        // 카드 왼쪽 굵은 띠가 그 상권의 색이다 — 아래 차트와 같은 색
        dot:'flex:none;width:10px;height:10px;border-radius:50%;background:'+o._color,
        cardStyle:'background:var(--color-background);border:1px solid '
          +(first?'var(--color-primary)':'var(--color-border)')
          +';border-left:5px solid '+o._color
          +';border-radius:var(--r-lg);padding:20px;min-width:0;position:relative',
        cells:[
          {label:'상권 참고 매출 (추정)', value:monthly(src.per),
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
         text: (wSales&&wStore&&wSales!==wStore)? this.tn('cmp.diffBoth',{a:wSales.name, b:wStore.name})
             : (wSales&&wSales===wStore)? this.tn('cmp.diffSame',{a:wSales.name})
             : (wSales? this.tn('cmp.diffSales',{a:wSales.name, tie:tieSent})
                  : (wStore? this.tn('cmp.diffStore',{b:wStore.name, tie:tieSent})
                       : this.t('cmp.diffTie',{tie:tieSent})))},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--color-primary-mid);flex:none;margin-top:9px',
         text: wPer? this.tn('cmp.diffPer',{name:wPer.name, amt:monthly(wPer.src.per)})
                 : this.t('cmp.diffPerTie',{tie:tieSent})},
        {dot:'width:5px;height:5px;border-radius:50%;background:var(--color-warning);flex:none;margin-top:9px',
         text:'임대료는 상권 단위 자료가 대부분 없어요. 중개인에게 확인한 금액을 본전 계산에 직접 넣으세요.'}
      ],
      honesty:''
    };
    // 색은 '어느 상권인지'만 뜻한다 — 좋다/나쁘다는 배지와 문장으로만 말한다
    out.c.honesty=this.t('cmp.honesty',{q:this.qtr(r.quarter), ind:this.indName(S.ind)});
    return out;
  }
};
