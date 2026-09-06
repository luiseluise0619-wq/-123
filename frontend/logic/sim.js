'use strict';
// 정밀비교 — "내 조건을 넣으면 어디가 더 남는가?"
//
// 상권 점수를 자동으로 비교하는 화면이 아니다. 사장님이 직접 넣은 숫자로 도는 계산기다.
// 상권분석에서 계산한 예상 매출은 '처음 값'으로만 넣어 주고, 언제든 고쳐 쓸 수 있다.
//
// 계산 (모두 만원 단위, 월 기준)
//   월 비용   = 월세 + 인건비 + 재료비 + 관리비 + 기타
//   영업이익  = 월매출 − 월 비용
//   영업이익률 = 영업이익 ÷ 월매출 × 100
//   초기 투자금 = 보증금 + 권리금 + 인테리어 + 기타 초기비용
//   회수 기간  = 초기 투자금 ÷ 영업이익 (이익이 0 이하면 '회수 불가')
//
// 회수 기간에서 보증금을 빼지 않는다. 돌려받을 수 있는 돈이지만 언제 얼마나 돌려받을지
// 계약마다 다르고, 우리가 가정하면 그것도 지어낸 값이 된다. 화면에 그렇게 적어 둔다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.sim = {

  // 입력 칸 정의. 한 곳에만 둬서 화면과 계산이 같은 목록을 본다.
  SIM_FIELDS(){
    return {
      monthly:[
        {k:'rev',    label:'예상 월매출', hint:'상권 자료에서 넣어 둔 값이에요'},
        {k:'rent',   label:'월세',      hint:''},
        {k:'labor',  label:'인건비',    hint:''},
        {k:'cogs',   label:'재료비',    hint:''},
        {k:'mgmt',   label:'관리비',    hint:''},
        {k:'etc',    label:'기타 비용',  hint:''}
      ],
      initial:[
        {k:'deposit', label:'보증금',      hint:''},
        {k:'premium', label:'권리금',      hint:''},
        {k:'interior',label:'인테리어',    hint:''},
        {k:'setup',   label:'기타 초기비용', hint:''}
      ]
    };
  },
  SIM_COST_KEYS(){ return ['rent','labor','cogs','mgmt','etc']; },
  SIM_INIT_KEYS(){ return ['deposit','premium','interior','setup']; },

  // 상권 하나의 처음 값. 사장님이 아직 아무것도 안 고쳤을 때만 쓴다.
  simSeed(z){
    const sz=this.size();
    // 예상 월매출: 상권 자료(3개월 합계 ÷ 3 ÷ 만원). 없으면 비워 둔다 — 0 으로 채우지 않는다.
    const rev = (z && Number.isFinite(z.per)) ? Math.round(z.per/3/1e4) : null;
    return {
      rev:rev,
      rent:this.bound(this.state.rent,0,100000,400),
      labor:sz.staff*250,
      cogs: rev!=null? Math.round(rev*this.bound(this.state.cogs,0,95,35)/100) : null,
      mgmt:Math.round(sz.area*2),
      etc:sz.etc,
      deposit:null, premium:null, interior:null, setup:null
    };
  },

  // 사장님이 고친 값이 있으면 그 값, 없으면 처음 값
  simValue(id, key){
    const edits=(this.state.simIn||{})[id]||{};
    if(Object.prototype.hasOwnProperty.call(edits,key)) return edits[key];
    const seed=this._simSeed && this._simSeed[id];
    return seed? seed[key] : null;
  },

  simSet(id, key, raw){
    const S=this.state;
    const cur=S.simIn||{};
    const one={...(cur[id]||{})};
    one[key] = (raw===''||raw==null)? null : this.bound(raw,0,10000000,0);
    this.setState({simIn:{...cur,[id]:one}});
  },
  simReset(id){
    const cur={...(this.state.simIn||{})};
    delete cur[id];
    this.setState({simIn:cur});
  },

  // 한 곳의 손익. 값이 없으면 null 로 두고 '입력 필요'라고 말한다 — 0 으로 계산하지 않는다.
  simCalc(id){
    const v=k=>{ const x=this.simValue(id,k); return (x==null||!isFinite(x))? null : Number(x); };
    const rev=v('rev');
    const costs=this.SIM_COST_KEYS().map(k=>({k, v:v(k)}));
    const missing=[];
    if(rev==null) missing.push('예상 월매출');
    let cost=0, anyCost=false;
    costs.forEach(c=>{ if(c.v!=null){ cost+=c.v; anyCost=true; } });
    const inits=this.SIM_INIT_KEYS().map(k=>v(k));
    const hasInit=inits.some(x=>x!=null);
    const invest=hasInit? inits.reduce((a,b)=>a+(b||0),0) : null;

    const profit = (rev!=null && anyCost)? rev-cost : null;
    const margin = (profit!=null && rev>0)? profit/rev*100 : null;
    // 이익이 0 이하면 회수 기간을 계산하지 않는다. 큰 숫자를 적으면 거짓말이 된다.
    const payback = (invest!=null && profit!=null && profit>0)? invest/profit : null;
    return {rev, cost, profit, margin, invest, payback, missing,
            anyCost, hasInit, costs:costs};
  },

  // ── 화면 ─────────────────────────────────────────────────────
  simView(){
    const S=this.state, r=this.rank();
    const empty={
      ready:false, hasZones:false, zones:[], picker:[], hasPicker:false,
      lead:'내 조건으로 견줘 보세요', sub:'',
      rail:this.rail('simZ',{per:3}), fields:{monthly:[],initial:[]},
      verdict:'', hasVerdict:false, order:[], chart:null, hasChart:false,
      note:this.dataNote('sim','',[]), missingText:'', hasMissing:false
    };
    if(!r||!r.list||!r.list.length) return empty;
    // 이 화면을 보고 있을 때만 계산한다. 다른 화면에서도 돌면
    // 기본 상권이 비교 색 슬롯을 먼저 먹어, 정작 담은 곳들의 색이 밀린다.
    if(S.screen!=='sim') return empty;
    const L=r.list;
    const PICKS=(S.picks||[]).filter(id=>L.some(o=>o.id===id));
    // 비교분석에서 담은 곳이 있으면 그대로 쓰고, 없으면 고른 상권 하나로 시작한다.
    const ids = PICKS.length? PICKS
      : ((S.sel||S.zoneId) && L.some(o=>o.id===(S.sel||S.zoneId)) ? [S.sel||S.zoneId] : [L[0].id]);
    const zones=ids.map(id=>L.find(o=>o.id===id)).filter(Boolean).slice(0,3);
    if(!zones.length) return empty;

    // 처음 값은 렌더마다 같은 값이어야 한다 — 한 번 만들어 두고 재사용한다
    this._simSeed=this._simSeed||{};
    zones.forEach(z=>{ if(!this._simSeed[z.id]) this._simSeed[z.id]=this.simSeed(z); });

    const F=this.SIM_FIELDS();
    const calc={}; zones.forEach(z=>{ calc[z.id]=this.simCalc(z.id); });
    const done=zones.filter(z=>calc[z.id].profit!=null);
    const best=done.slice().sort((a,b)=>calc[b.id].profit-calc[a.id].profit)[0]||null;
    const bestTie = best && done.filter(z=>calc[z.id].profit===calc[best.id].profit).length>1;

    const inputStyle=(on)=>'width:100%;font-size:16px;font-weight:600;color:var(--color-text-primary);'
      +'background:var(--color-surface);border:1px solid '+(on?'var(--color-primary)':'transparent')
      +';border-radius:var(--r-sm);padding:0 12px;height:46px;outline:none;text-align:right;'
      +'font-variant-numeric:tabular-nums';

    const cardOf=z=>{
      const c=calc[z.id], slot=this.colorSlot(z.id), col=this.slotColor(slot);
      const edits=(S.simIn||{})[z.id]||{};
      const one=(f,group)=>({
        k:f.k, label:f.label,
        value: (()=>{ const v=this.simValue(z.id,f.k); return v==null? '' : String(v); })(),
        edited: Object.prototype.hasOwnProperty.call(edits,f.k),
        hint: f.hint && !Object.prototype.hasOwnProperty.call(edits,f.k) ? f.hint : '',
        hasHint: !!(f.hint && !Object.prototype.hasOwnProperty.call(edits,f.k)),
        onIn: e=>this.simSet(z.id, f.k, e.target.value),
        style: inputStyle(Object.prototype.hasOwnProperty.call(edits,f.k)),
        rowStyle:'display:flex;align-items:center;gap:12px'
      });
      // 혼자면 '1위'가 아무 뜻이 없다 — 두 곳 이상일 때만 배지를 단다
      const won = best && z.id===best.id && !bestTie && done.length>1;
      return {
        id:z.id, name:this.zoneLabelOf(z.name),
        gu:(S.zgu&&S.zgu[z.id])||'',
        dot:'flex:none;width:10px;height:10px;border-radius:50%;background:'+col,
        best:won,
        badge: won? '🥇 내 조건 1위' : '',
        badgeStyle:'flex:none;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;'
          +'white-space:nowrap;background:var(--color-primary);color:#FFFFFF',
        drop: zones.length>1? (()=>this.setState({picks:ids.filter(x=>x!==z.id)})) : (()=>{}),
        canDrop: zones.length>1,
        reset:()=>this.simReset(z.id),
        hasEdits:Object.keys(edits).length>0,
        monthly:F.monthly.map(f=>one(f,'monthly')),
        initial:F.initial.map(f=>one(f,'initial')),
        // 결과
        ready:c.profit!=null,
        profit: c.profit!=null? this.man(c.profit) : '입력 필요',
        profitStyle:'font-size:'+this.L('26px','28px','30px')+';font-weight:700;letter-spacing:-.03em;'
          +'font-variant-numeric:tabular-nums;'
          +(c.profit==null? 'color:var(--color-text-muted)'
            : (c.profit>=0? 'color:var(--color-positive)' : 'color:var(--color-negative)')),
        margin: c.margin!=null? (Math.round(c.margin*10)/10)+'%' : '—',
        cost: c.anyCost? this.man(c.cost) : '—',
        rev: c.rev!=null? this.man(c.rev) : '—',
        invest: c.invest!=null? this.man(c.invest) : '입력 안 함',
        payback: c.payback!=null? ('약 '+(Math.round(c.payback*10)/10)+'개월')
          : (c.invest==null? '초기비용 입력 필요'
            : (c.profit!=null&&c.profit<=0? '지금 조건에서는 회수 불가' : '—')),
        paybackStyle:'font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;'
          +(c.payback!=null?'':'color:var(--color-text-muted);font-size:14px;font-weight:500'),
        missing: c.missing.length? c.missing.join(' · ')+' 을(를) 넣어야 계산돼요' : '',
        hasMissing: c.missing.length>0,
        cardStyle:'background:var(--color-background);border:1px solid '
          +(won?'var(--color-primary)':'var(--color-border)')
          +';border-left:5px solid '+col+';box-shadow:var(--shadow-card);'
          +'border-radius:var(--r-lg);padding:'+this.L('18px','20px','22px')+';min-width:0;'
          +(zones.length===1? 'max-width:520px' : '')
      };
    };

    // 더 담을 후보 — 자동 점수가 아니라 '내가 견주고 싶은 곳'을 고르는 목록
    const picker=L.filter(o=>ids.indexOf(o.id)<0).slice(0,10).map(o=>({
      name:this.zoneLabelOf(o.name),
      meta:(S.zgu&&S.zgu[o.id])||'',
      add: ids.length>=3? (()=>{}) : (()=>this.setState({picks:[...ids,o.id]})),
      style:'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:var(--r-sm);'
        +'background:var(--color-surface);cursor:'+(ids.length>=3?'default':'pointer')+';min-width:0;'
        +(ids.length>=3?'opacity:.45':'')
    }));

    // 결과 비교 차트는 하나만(§17)
    const chart=this.chartCard('sim-profit',{
      type:'bar', title:'내 조건에서 월 영업이익은?', sub:'입력한 값으로 계산한 결과 · 만원',
      unit:'만원', height:240,
      labels:done.map(z=>this.zoneLabelOf(z.name)),
      datasets:[{label:'월 영업이익', data:done.map(z=>Math.round(calc[z.id].profit)),
        colors:done.map(z=>this.slotHex(this.colorSlot(z.id)))}],
      winner: (best&&!bestTie)? {name:this.zoneLabelOf(best.name), badge:'이익 1위',
        color:this.slotHex(this.colorSlot(best.id)),
        value:this.man(calc[best.id].profit),
        text:'입력한 조건에서는 여기가 월 영업이익이 가장 커요.'} : null
    });

    return {
      ready:true, hasZones:true,
      lead:'내 조건이면 어디가 더 남을까요?',
      sub:'숫자를 직접 넣어 보세요. 상권 자료에서 넣어 둔 값은 참고용이고, 고치면 바로 다시 계산돼요.',
      zones:zones.map(cardOf),
      // 담은 수만큼만 나눠 쓴다 — 한 곳인데 3분할이면 오른쪽이 텅 빈다
      rail:this.rail('simZ',{per:Math.min(3,Math.max(zones.length,1))}),
      picker, hasPicker:picker.length>0 && ids.length<3,
      pickerFull: ids.length>=3,
      pickerLabel: ids.length>=3? this.t('sim.full') : this.t('sim.addMore'),
      hasVerdict: !!(best && done.length>1),
      verdict: !best? ''
        : (bestTie? this.t('sim.tie')
          : this.tn('sim.verdict',{name:this.zoneLabelOf(best.name)})),
      order:done.slice().sort((a,b)=>calc[b.id].profit-calc[a.id].profit).map((z,i)=>({
        place:(i+1)+'위', name:this.zoneLabelOf(z.name),
        value:this.man(calc[z.id].profit),
        dot:'flex:none;width:9px;height:9px;border-radius:50%;background:'+this.slotColor(this.colorSlot(z.id)),
        style:'display:flex;align-items:center;gap:11px;padding:13px 14px;border-radius:var(--r-sm);'
          +(i===0?'background:var(--color-primary-soft)':'background:var(--color-surface)')
      })),
      chart, hasChart:!!chart,
      missingText: zones.some(z=>calc[z.id].profit==null)
        ? '아직 값이 덜 들어간 곳이 있어요. 매출과 비용을 하나라도 넣으면 그 자리부터 계산돼요.' : '',
      hasMissing: zones.some(z=>calc[z.id].profit==null),
      note:this.dataNote('sim',
        '여기 숫자는 전부 사장님이 넣은 값이에요. 우리가 만든 추정이 아니에요.',
        [['계산식','월 영업이익 = 월매출 − (월세+인건비+재료비+관리비+기타). '
          +'영업이익률 = 영업이익 ÷ 월매출. 회수 기간 = 초기 투자금 ÷ 월 영업이익.'],
         ['처음 값','예상 월매출은 상권 자료(3개월 소비 ÷ 점포 수 ÷ 3)에서 넣어 둔 추정값이에요. '
          +'인건비·관리비는 평수에서 잡은 값이고요. 전부 고쳐 쓰실 수 있어요.'],
         ['보증금','회수 기간에서 보증금을 빼지 않았어요. 돌려받을 수 있는 돈이지만 언제 얼마나 '
          +'돌려받을지는 계약마다 달라서, 우리가 정하면 그것도 지어낸 값이 돼요.'],
         ['빠진 것','세금·대출 이자·감가상각은 넣지 않았어요. 실제 손에 남는 돈은 이보다 적어요.']])
    };
  }
};
