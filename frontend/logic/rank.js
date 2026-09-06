'use strict';
// 종합순위 — "그래서 어디가 제일 좋은데?"에 답하는 계산.
//
// 원칙
//   · 느낌으로 추천하지 않는다. 비교 대상 안에서 정규화(min-max)하고 가중치를 곱한다.
//   · 높을수록 좋은 값과 낮을수록 좋은 값을 방향(dir)으로 구분한다.
//     경쟁 점포·임대료·공실률은 낮을수록 좋다. 무조건 큰 값을 초록으로 칠하지 않는다.
//   · 근거 없는 87점·92점을 만들지 않는다. 화면에는 '몇 위'만 쓰고,
//     점수는 순서를 정하는 내부 값으로만 쓴다.
//   · 어떤 지표가 없으면 그 지표를 빼고 남은 가중치로 다시 나눈다. 0으로 치지 않는다.
//
// 색(§39~41)
//   비교에 담긴 상권마다 고정 색 슬롯을 준다. 한 상권은 모든 차트에서 같은 색이다.
//   중간에 한 곳을 빼도 남은 곳의 색은 바뀌지 않는다(id 로 기억한다).
//   승자는 색이 아니라 배지로 표시한다 — 색은 '누구인지', 배지는 '몇 위인지'.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.rank = {

  // 비교에 쓰는 지표. dir: 1 = 높을수록 좋다, -1 = 낮을수록 좋다.
  RANK_METRICS(){
    return [
      {k:'per',    label:'예상 매출',   short:'매출',   unit:'원', dir: 1, win:'매출 1위',   lose:'매출 낮음'},
      {k:'pop',    label:'유동인구',   short:'유동인구', unit:'명', dir: 1, win:'수요 1위',   lose:'수요 낮음'},
      {k:'stores', label:'경쟁 점포',   short:'경쟁',   unit:'곳', dir:-1, win:'경쟁 유리',  lose:'경쟁 많음'},
      {k:'sales',  label:'소비 규모',   short:'소비',   unit:'원', dir: 1, win:'소비 1위',   lose:'소비 낮음'},
      {k:'rent',   label:'임대료',     short:'임대료',  unit:'원', dir:-1, win:'임대료 유리', lose:'임대료 높음'},
      {k:'vac',    label:'공실률',     short:'공실',   unit:'%',  dir:-1, win:'공실 유리',  lose:'공실 높음'}
    ];
  },

  // 기준 프리셋. 합이 100 이 되게 둔다 — '무엇을 얼마나 봤는지'를 그대로 보여줄 수 있다.
  RANK_PRESETS(){
    return [
      {k:'balanced', label:'균형 있게',        w:{per:40, pop:30, stores:30}},
      {k:'sales',    label:'매출 우선',        w:{per:55, sales:20, pop:15, stores:10}},
      {k:'pop',      label:'유동인구 우선',     w:{pop:55, per:25, stores:20}},
      {k:'comp',     label:'경쟁 적은 곳 우선', w:{stores:55, per:25, pop:20}},
      {k:'cost',     label:'비용 우선',        w:{rent:45, vac:20, per:20, stores:15}}
    ];
  },

  rankPreset(){
    const k=this.state.rankW||'balanced';
    const P=this.RANK_PRESETS();
    return P.find(p=>p.k===k)||P[0];
  },

  // 담은 순서대로 색 슬롯 1..5. id 로 기억해서, 하나를 빼도 남은 색이 안 바뀐다.
  colorSlot(id){
    this._slots = this._slots || {};
    if(this._slots[id]) return this._slots[id];
    const used = Object.values(this._slots);
    for(let i=1;i<=5;i++) if(used.indexOf(i)<0){ this._slots[id]=i; return i; }
    this._slots[id]=((used.length)%5)+1;      // 6곳 이상이면 돌려 쓴다
    return this._slots[id];
  },
  slotColor(slot){ return 'var(--chart-series-'+(((slot-1)%5)+1)+')'; },
  // 차트는 CSS 변수를 그대로 못 먹는다 — 실제 색으로 바꿔 준다
  slotHex(slot){
    const fallback=['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00'][(slot-1)%5];
    // 테스트(브라우저 밖)에서는 getComputedStyle 이 없다 — 기본 팔레트로 돌아간다
    if(typeof getComputedStyle!=='function'||typeof document==='undefined') return fallback;
    try{
      const cs=getComputedStyle(document.documentElement);
      return (cs.getPropertyValue('--chart-series-'+(((slot-1)%5)+1))||'').trim() || fallback;
    }catch(e){ return fallback; }
  },

  // items: [{id, name, per, pop, stores, sales, rent, vac}] — 없는 값은 null 로 둔다.
  // 반환: 점수 내림차순. 각 항목에 rankOf(지표별 순위) · missing(빠진 지표) 이 붙는다.
  rankZones(items, presetKey){
    const P=this.RANK_PRESETS();
    const preset=P.find(p=>p.k===(presetKey||this.state.rankW||'balanced'))||P[0];
    const M=this.RANK_METRICS().filter(m=>preset.w[m.k]!=null);
    const num=(o,k)=>{ const v=o[k]; return (v==null||!isFinite(v))? null : v; };

    // 지표마다 비교 대상 안에서의 최소·최대
    const range={};
    M.forEach(m=>{
      const vs=items.map(o=>num(o,m.k)).filter(v=>v!=null);
      range[m.k]= vs.length? {min:Math.min(...vs), max:Math.max(...vs)} : null;
    });

    const scored=items.map(o=>{
      let sum=0, wsum=0; const missing=[];
      M.forEach(m=>{
        const v=num(o,m.k), r=range[m.k];
        if(v==null||!r){ missing.push(m.label); return; }
        // 다 같은 값이면 우열이 없다 — 0.5 로 두고 아무도 이기지 않게 한다
        const n = (r.max===r.min) ? 0.5 : (v-r.min)/(r.max-r.min);
        sum += (m.dir>0? n : 1-n) * preset.w[m.k];
        wsum += preset.w[m.k];
      });
      return {...o, _score: wsum? sum/wsum*100 : null, _missing:missing, _wsum:wsum};
    });

    // 지표별 순위 (동점은 같은 순위)
    const rankOf={};
    M.forEach(m=>{
      const arr=scored.filter(o=>num(o,m.k)!=null)
        .sort((a,b)=> m.dir>0 ? b[m.k]-a[m.k] : a[m.k]-b[m.k]);
      const map={}; let last=null, lastRank=0;
      arr.forEach((o,i)=>{ const v=o[m.k];
        if(v!==last){ lastRank=i+1; last=v; }
        map[o.id]=lastRank; });
      rankOf[m.k]=map;
    });

    scored.forEach(o=>{
      o._rank={}; M.forEach(m=>{ o._rank[m.k]=rankOf[m.k][o.id]||null; });
      o._slot=this.colorSlot(o.id);
      o._color=this.slotColor(o._slot);
    });
    // 점수를 못 낸 곳(쓸 지표가 하나도 없음)은 뒤로
    scored.sort((a,b)=>(b._score==null?-1:b._score)-(a._score==null?-1:a._score));
    scored.forEach((o,i)=>{ o._place=i+1; });
    return {list:scored, preset, metrics:M, range};
  },

  // 한 지표의 승자. 동점이면 승자를 세우지 않는다(거짓말이 된다).
  winnerOf(list, key){
    const m=this.RANK_METRICS().find(x=>x.k===key);
    if(!m) return null;
    const vs=list.filter(o=>o[key]!=null&&isFinite(o[key]));
    if(vs.length<2) return null;
    const best=m.dir>0? Math.max(...vs.map(o=>o[key])) : Math.min(...vs.map(o=>o[key]));
    const tops=vs.filter(o=>o[key]===best);
    return tops.length===1? tops[0] : null;
  },

  // '지금 무엇을 얼마나 보고 있는지' — [추천 기준 보기]에서 편다
  rankWhy(){
    const p=this.rankPreset();
    const M=this.RANK_METRICS();
    return {
      label:p.label,
      rows:Object.keys(p.w).map(k=>{
        const m=M.find(x=>x.k===k)||{label:k,dir:1};
        return {label:m.label, weight:p.w[k]+'%',
                dir: m.dir>0? '높을수록 좋음' : '낮을수록 좋음'};
      }),
      how:'담은 곳들 안에서 각 지표를 0~1 로 환산하고(가장 낮은 곳 0, 가장 높은 곳 1) '
        +'위 비율만큼 곱해 더했어요. 낮을수록 좋은 지표는 방향을 뒤집어 계산해요. '
        +'값이 없는 지표는 빼고 남은 비율로 다시 나눠요 — 0 으로 치지 않아요.'
    };
  }
};
