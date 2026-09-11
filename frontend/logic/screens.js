'use strict';
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
// 지역 비교·선택 지역·자치구 분석 화면.
globalThis.MysbizonParts.screens = {
  zoneCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    const empty={rows:[], cards:[], ind:'', lead:'', sub:'', note:this.dataNote('zc','',[]), maxPer:1,
      charts:[], hasCharts:false, rail:this.rail('zc',{per:4}), chartRail:this.rail('zcc',{per:1, peek:false, arrows:true}),
      hasList:false, allOpen:false, toggleAll:()=>{}, allLabel:'', medLine:'', medNote:'', picked:''};
    if(!zi||!zgu) return empty;
    const idx=zi.inds.indexOf(S.ind);
    if(idx<0) return empty;
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
    const list=Object.values(agg).map(a=>({...a, per:a.sales/a.stores,
      pop:pop[a.gu]?pop[a.gu].sum:null}));
    if(!list.length) return empty;
    const maxPer=Math.max(...list.map(o=>o.per));
    list.sort((a,b)=>b.per-a.per);
    const top=list[0];
    const med=arr=>{ const v=arr.filter(x=>x!=null).sort((a,b)=>a-b);
      return v.length? v[Math.floor(v.length/2)] : null; };
    const perMed=med(list.map(x=>x.per));
    const storeMed=med(list.map(x=>x.stores));
    const satOf=o=>o.pop? o.stores/(o.pop/10000) : null;
    const satMed=med(list.map(satOf));
    const medPct=Math.min(perMed/maxPer*100,100);

    // 고른 구 — 카드를 누르면 아래 차트에서 그 구가 강조된다
    const picked=(S.zcGu && list.some(o=>o.gu===S.zcGu))? S.zcGu : top.gu;

    const card=(o,i)=>{
      const perM=o.per/3;
      const sat=satOf(o);
      const diff=Math.round((o.per-perMed)/perMed*100);
      const dStore=storeMed!=null? o.stores-storeMed : null;
      const on=o.gu===picked;
      // 카드에는 '여기서 장사할지'를 가르는 값만 둔다.
      // '분석 가능한 상권 N곳'·'사람 1만 명당 N곳'은 우리 사정이지 사장님의 판단 기준이 아니다
      // — 전체 목록과 아래 차트에서 볼 수 있다.
      const facts=[
        {label:'경쟁 점포', value:o.stores.toLocaleString()+'곳',
         tag: dStore==null? '' : (Math.abs(dStore)<1? '서울 중앙값과 비슷'
              : '중앙값보다 '+Math.abs(dStore).toLocaleString()+'곳 '+(dStore>0?'많아요':'적어요'))},
        {label:'유동인구', value:o.pop? Math.round(o.pop).toLocaleString()+'명' : '자료 없음',
         tag:o.pop? '자치구 안 행정동 하루 합계' : ''},
        {label:'상권 소비 규모', value:this.won(o.sales), tag:'최근 3개월'}
      ];
      if(sat!=null && satMed!=null){
        facts.push({label:'경쟁 강도',
          value: sat<=satMed*0.7? '여유' : (sat<=satMed*1.3? '보통' : '과밀'),
          tag:''});
      }
      return {
        gu:this.placeName(o.gu), rank:String(i+1).padStart(2,'0'),
        per:this.won(perM),
        verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요'
               : (diff<=-10? '중앙값보다 '+Math.abs(diff)+'% 낮아요' : '중앙값과 비슷해요')),
        facts:facts,
        pick:()=>this.setState({zcGu:o.gu}),
        bar:'display:block;width:'+Math.max(o.per/maxPer*100,3).toFixed(1)+'%;height:100%;border-radius:3px;'
          +'background:var(--accent);opacity:'+(0.45+0.55*(o.per/maxPer)).toFixed(2),
        style:'min-width:0;padding:20px;border-radius:var(--r-lg);cursor:pointer;'
          +'transition:box-shadow .16s,transform .16s;'
          +(on?'background:var(--card);border:1px solid var(--accent)'
              :'background:var(--card);border:1px solid var(--line)')
      };
    };

    // ── 차트 — 같은 숫자를 모양만 바꿔 반복하지 않는다. 넷은 서로 다른 질문이다. ──
    const C=[];
    const push=(id,opt)=>{ const c=this.chartCard(id,opt); if(c) C.push(c); };
    const q=this.qtr(zi.quarter);
    const byPer=list.slice(0,12);
    push('zc-per',{type:'hbar', title:'자치구별 예상 매출', sub:'가게 한 곳당 월매출 (추정) · 상위 12곳',
      unit:'원', period:q, height:300,
      labels:byPer.map(o=>this.placeName(o.gu)),
      datasets:[{label:'가게 한 곳당 월매출', data:byPer.map(o=>Math.round(o.per/3)),
        colors:byPer.map(o=>o.gu===picked?'on':'')}]});
    const byStore=list.slice().sort((a,b)=>b.stores-a.stores).slice(0,12);
    push('zc-store',{type:'hbar', title:'자치구별 경쟁 점포 수', sub:'같은 업종 점포가 많은 12곳',
      unit:'곳', period:q, height:300,
      labels:byStore.map(o=>this.placeName(o.gu)),
      datasets:[{label:'같은 업종 점포 수', data:byStore.map(o=>o.stores),
        colors:byStore.map(o=>o.gu===picked?'on':'')}]});
    const byPop=list.filter(o=>o.pop).sort((a,b)=>b.pop-a.pop).slice(0,12);
    push('zc-pop',{type:'hbar', title:'자치구별 유동인구', sub:'상권이 속한 행정동 하루 유동인구 합계',
      unit:'명', period:q, height:300,
      labels:byPop.map(o=>this.placeName(o.gu)),
      datasets:[{label:'하루 유동인구', data:byPop.map(o=>Math.round(o.pop)),
        colors:byPop.map(o=>o.gu===picked?'on':'')}]});
    const bySales=list.slice().sort((a,b)=>b.sales-a.sales).slice(0,12);
    push('zc-sales',{type:'hbar', title:'자치구별 소비 규모', sub:'최근 3개월 상권 소비 합계',
      unit:'원', period:q, height:300,
      labels:bySales.map(o=>this.placeName(o.gu)),
      datasets:[{label:'3개월 소비 규모', data:bySales.map(o=>o.sales),
        colors:bySales.map(o=>o.gu===picked?'on':'')}]});

    const allOpen=!!S.zcAll;
    return {
      ind:this.indName(S.ind),
      lead:this.tn('zc.lead',{ind:this.indName(S.ind), gu:this.placeName(top.gu)}),
      sub:'카드를 누르면 아래 차트에서 그 자치구가 강조돼요. 옆으로 넘겨 보세요.',
      picked:this.placeName(picked),
      pickedTitle:this.t('zc.pickedTitle',{gu:this.placeName(picked)}),
      medLine:'position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;'
        +'background:var(--ink3);opacity:.55;left:'+medPct.toFixed(1)+'%',
      medNote:'가운데 눈금이 서울 자치구 중앙값이에요',
      // 가로 슬라이드 — 25개를 세로로 펼치지 않는다
      rail:this.rail('zc',{per:4}),
      chartRail:this.rail('zcc',{per:1, peek:false, arrows:true}),
      cards:list.map(card),
      charts:C, hasCharts:C.length>0,
      // 전체 목록은 눌렀을 때만
      allOpen:allOpen,
      allLabel:allOpen? '전체 목록 접기' : '전체 목록 보기 ('+list.length+'곳)',
      toggleAll:()=>this.setState({zcAll:!allOpen}),
      hasList:allOpen,
      rows:list.map((o,i)=>({
        rank:i+1, gu:this.placeName(o.gu),
        per:this.won(o.per/3),
        stores:o.stores.toLocaleString()+'개',
        zones:o.zones+'곳',
        pick:()=>this.setState({zcGu:o.gu}),
        bar:'display:block;width:'+Math.max(o.per/maxPer*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*(o.per/maxPer)).toFixed(2),
        row:'display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line);cursor:pointer'
      })),
      // 긴 회색 문단 대신 한 줄 + 펼치기 (design.js dataNote)
      note:this.dataNote('zc',
        '금액은 가게 한 곳이 한 달에 파는 돈의 추정값이에요. 어느 한 가게의 실적은 아니에요.',
        [['어떻게 계산했나요',
          '자치구 안 상권 매출을 다 더해 같은 업종 가게 수로 나눴어요. 원자료가 3개월치라 3으로 나눠 한 달 값으로 적었어요.'],
         ['무엇이 빠졌나요',
          '이 업종의 매출·점포 기록이 없는 상권은 합산에서 빠졌어요. 그래서 구마다 합산에 들어간 상권 수가 달라요.'],
         ['기준 시점', this.qtr(zi.quarter)+' · '+this.tr('서울열린데이터광장 상권분석서비스')],
         ['주의할 점',
          '가게마다 규모·업력·자리가 달라 실제 매출은 이 값과 크게 다를 수 있어요. 자치구끼리 견주는 용도로만 봐주세요.']])
    };
  },

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
        lead:this.tn('rg.share',{ind:this.indName(S.regPick), pct:share.toFixed(1)}),
        facts:[
          {label:'가게 한 곳이 한 달에 파는 돈', value:this.won(per/3), tag:'(추정)'},
          {label:'가게 수', value:stores.toLocaleString()+'곳', tag:''},
          {label:'손님이 쓴 돈 (3개월)', value:this.won(sales), tag:''},
          {label:'결제 1건당 추정 금액', value:unit? this.wonRaw(unit):'데이터 없음', tag:unit?'실제 집계':'정부 자료에 없어 점수에 넣지 않았어요'}
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
      name:this.zoneLabelOf(z.nm),
      sub:'이 동네에서 확인된 장사가 '+rows.length+'가지예요. 하나를 고르면 본전까지 계산해 드려요.',
      stats:[
        {label:'가게', value:totalStores.toLocaleString()+'곳', tag:''},
        {label:'손님이 쓴 돈 (3개월)', value:this.won(totalSales), tag:''},
        {label:'확인된 장사', value:rows.length+'가지', tag:''}
      ],
      inds:rows.sort((a,b)=>b[2]-a[2]).map(r=>{
        const name=zi.inds[r[0]], per=r[2]/r[1];
        return {
          name:this.indName(name), stores:r[1].toLocaleString()+'곳', per:this.won(per/3),
          bar:'display:block;width:'+Math.max(per/maxPer*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*(per/maxPer)).toFixed(2),
          pick:()=>this.setState({regPick:name}),
          row:'display:flex;align-items:center;gap:14px;padding:15px 0;border-top:1px solid var(--line);cursor:pointer'
        };
      })
    };
  },

  // 괄호가 중복 설명이면 떼고 보여준다. 검색은 원래 이름으로 계속 걸린다.
  fineCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    const GU=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const gu=S.fcGu|| (S.zoneId&&zgu&&zgu[S.zoneId]) || '강남구';
    // 정렬 기준은 하나로 고정한다 — 네 가지를 고르게 하면 무엇을 보는 화면인지 흐려진다
    const sort='per';
    // select 의 value 는 원래 이름이어야 한다 — 옮긴 이름을 value 로 쓰면 어느 항목과도 안 맞아
    // 영어 화면에서 늘 첫 구가 골라진 것처럼 보인다. 보이는 글자만 옮긴다(sidoOptions 와 같은 꼴).
    const guOpts=GU.map(g=>({v:g, label:this.placeName(g)}));
    if(!zi||!zgu) return {guValue:gu, guOptions:guOpts, onGu:()=>{}, ind:'', rows:[], lead:'', top:[],
                          hasList:false, hasMore:false, hasMed:false,
                          topRail:this.rail('fcTop',{per:3}), note:this.dataNote('fc','',[])};
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
    // 71줄을 그냥 늘어놓으면 '그래서 어디로?'가 안 보인다. 결론과 상위 셋을 먼저 둔다.
    const top3=list.slice(0,3);
    const showAll=!!S.fcAll;
    const shown=showAll? list : list.slice(0,6);
    return {
      guValue:gu, ind:this.indName(S.ind),
      guOptions:guOpts,
      onGu:e=>this.setState({fcGu:e.target.value, fcAll:false}),
      lead: list.length
        ? this.tn('fc.lead',{gu:this.placeName(gu), ind:this.indName(S.ind), top:top3[0].name})
        : this.t('fc.none',{gu:this.placeName(gu), ind:this.indName(S.ind)}),
      sub: list.length
        ? this.t('fc.note',{gu:this.placeName(gu), n:list.length})
        : this.t('fc.pickOther'),
      hasList:list.length>0,
      // 상위 셋은 카드로 — 눈이 먼저 닿는 곳에 결론을 둔다
      top:top3.map((o,i)=>({
        rank:String(i+1),
        name:o.name, gu:o.gu||'',
        per:this.won(o.per/3),
        stores:o.stores.toLocaleString()+'곳',
        thin:o.stores<=2, thinText:'표본 '+o.stores+'곳이라 참고용이에요',
        vs:(()=>{
          if(!medPer) return '';
          const d=Math.round((o.per-medPer)/medPer*100);
          if(Math.abs(d)>=200) return this.pctRank(o.per, list.map(x=>x.per), true).text.replace('서울 상권 중','이 구에서');
          return d>=0? '구 중앙값보다 '+d+'% 높아요' : '구 중앙값보다 '+Math.abs(d)+'% 낮아요';
        })(),
        vsStyle:'font-size:12.5px;font-weight:600;margin-top:6px;color:'
          +((medPer&&o.per>=medPer)?'var(--good)':'var(--ink3)'),
        pick:()=>this.setState({sel:o.id,screen:'diag'}),
        style:'display:flex;flex-direction:column;padding:20px;border-radius:var(--r-lg);cursor:pointer;min-width:0;'
          +(i===0?'background:var(--card);border:1px solid var(--accent)'
                 :'background:var(--card);border:1px solid var(--line)')
      })),
      topRail:this.rail('fcTop',{per:3}),
      // 나머지는 접어 둔다 — 71줄을 한 번에 던지지 않는다
      moreLabel: showAll? '접기' : ('나머지 '+Math.max(list.length-6,0)+'곳 더 보기'),
      hasMore: list.length>6,
      toggleMore:()=>this.setState({fcAll:!showAll}),
      // 자치구 중앙값 — 화면 위에 기준선으로 적는다
      medLabel:list.length? this.won(medPer/3) : '',
      hasMed:list.length>0,
      rows:shown.map((o,i)=>{
        // 가게가 2곳 이하면 '가게 한 곳당'이 사실상 그 한 가게의 실적이다.
        // 숫자를 지우지는 않고(값은 진짜다) 믿을 만한 정도를 함께 적는다.
        const thin=o.stores<=2;
        return {
        rank:i+1, name:o.name+(o.gu&&o.gu.indexOf('경계')>=0?' · '+o.gu:''),
        per:this.won(o.per/3),
        // 가게 수는 두 가지를 한 번에 말해준다 — 이 숫자를 믿어도 되는지, 경쟁이 얼마나 센지
        storeTag:o.stores.toLocaleString()+'곳'+(thin?' · 표본 적음':''),
        storeStyle:'flex:none;font-size:11.5px;white-space:nowrap;font-variant-numeric:tabular-nums;'
          +(thin?'color:var(--warn)':'color:var(--ink3)'),
        vsMed:medPer? (o.per>=medPer? '중앙값 이상':'중앙값 미만') : '',
        vsStyle:'flex:none;font-size:11.5px;white-space:nowrap;'
          +(medPer&&o.per>=medPer?'color:var(--good)':'color:var(--ink3)'),
        sales:this.won(o.sales),
        stores:o.stores.toLocaleString()+'개',
        unit:o.unit? this.wonRaw(o.unit):'데이터 없음',
        bar:'display:block;width:'+Math.max((o[key]||0)/maxV*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*((o[key]||0)/maxV)).toFixed(2),
        pick:()=>this.setState({sel:o.id,screen:'diag'}),
        row:'display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer'
      };}),
      // 긴 회색 문단을 화면에 그대로 두지 않는다(§5·§6) — 한 줄만 두고 나머지는 접는다
      note:this.dataNote('fc','금액은 가게 한 곳당 월매출 추정값이에요.',[
        ['어떻게 계산하나요','손님이 쓴 돈을 가게 수로 나눈 값이라 어느 한 가게의 실적이 아니에요.'],
        ['자치구는 어떻게 붙였나요','상권 좌표로 붙였고, 경계에서 250m 안쪽인 곳은 두 구를 함께 적었어요 — 강남역처럼 강남대로를 경계로 서쪽이 서초구인 곳이 그래요.']
      ])
    };
  },

  // 지역비교 — 자치구 25개를 고른 장사 기준으로 묶어 비교한다
  // ── 통합시세 ───────────────────────────────────────────────────
  // 갈래·지표를 고르는 세로 목록은 logic/market.js 의 marketView() 가 만든다.
  // 여기는 '고른 지표 하나'의 핵심 수치·차트·목록만 만든다(§16).

};
