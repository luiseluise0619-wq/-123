'use strict';
// 자료를 화면이 쓸 모양으로 만드는 계산 — 순위·지도·정밀분석 섹션
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.analysis = {
  rank(){
    const {zi,ind}=this.state;
    if(!zi||!ind||!Array.isArray(zi.inds)||!zi.zones) return null;
    if(this._rankCache?.zi===zi&&this._rankCache.ind===ind)return this._rankCache.value;
    const i=zi.inds.indexOf(ind);
    if(i<0) return null;
    const L=[];
    for(const k in zi.zones){
      const z=zi.zones[k], row=(z.rows||[]).find(r=>r[0]===i);
      if(!row||![row[1],row[2]].every(v=>Number.isFinite(v)&&v>0)) continue;
      L.push({id:k,name:z.nm,stores:row[1],sales:row[2],unit:Number.isFinite(row[3])&&row[3]>=0?row[3]:0,per:row[2]/row[1]});
    }
    if(!L.length) return null;
    const pct=(key,inv)=>{ const sorted=[...L].sort((a,b)=>a[key]-b[key]), n=sorted.length;
      for(let start=0;start<n;){let end=start;while(end+1<n&&sorted[end+1][key]===sorted[start][key])end++;
        const value=n===1?50:((start+end)/2)/(n-1)*100;
        for(let j=start;j<=end;j++)sorted[j]['_'+key]=inv?100-value:value;start=end+1;}
    };
    pct('sales',false); pct('stores',true); pct('per',false);
    L.forEach(o=>{ o.c1=o._sales*0.45; o.c2=o._stores*0.35; o.c3=o._per*0.20; o.score=o.c1+o.c2+o.c3; });
    const thin=o=>o.stores<=5?1:0;
    L.sort((a,b)=>(thin(a)-thin(b))||(b.score-a.score));
    const value={list:L,covered:L.length,total:zi.n_zones,quarter:zi.quarter,updated:zi.updated};
    this._rankCache={zi,ind,value};return value;
  },

  // 평수 하나로 직원 수와 운영비가 같이 움직인다.
  // 기준: 10평당 1명, 평당 6만원 — 우리가 정한 값이고 공표 통계가 아니다.
  // 임대료는 상권별 평당 시세가 공개되지 않아 연동하지 않는다(직접 입력).
  buildMap(list, selId){
    const S=this.state, SM=S.smap;
    if(!SM||!list.length) return {ready:false, gus:[], pins:[], vb:'0 0 100 100', stroke:'0.5', legend:[], legendNote:''};
    const cds=list.map(o=>SM.pts[o.id]).filter(Boolean);
    let x0=100,x1=0,y0=100,y1=0;
    cds.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);});
    if(!cds.length){ x0=20;x1=80;y0=20;y1=80; }
    const pad=Math.max((x1-x0),(y1-y0))*0.42+6;
    let vx=x0-pad, vy=y0-pad, vw=(x1-x0)+pad*2, vh=(y1-y0)+pad*2;
    const side=Math.max(vw,vh);
    vx-=(side-vw)/2; vy-=(side-vh)/2;
    // 자치구를 이 장사의 한 곳당 매출로 칠한다
    const agg={};
    if(S.zi&&S.zgu){
      const ix=S.zi.inds.indexOf(S.ind);
      if(ix>=0) for(const k in S.zi.zones){
        const g=S.zgu[k]; if(!g) continue;
        const row=(S.zi.zones[k].rows||[]).find(r=>r[0]===ix);
        if(!row||!row[1]||!row[2]) continue;
        const a=agg[g]||(agg[g]={s:0,n:0}); a.s+=row[2]; a.n+=row[1];
      }
    }
    const per={}; let mx=0;
    for(const g in agg){ const v=agg[g].s/agg[g].n; per[g]=v; if(v>mx) mx=v; }
    const involved={};
    list.forEach(o=>{ const g=(S.zgu&&S.zgu[o.id])||''; if(g) involved[g]=1; });
    return {
      ready:true,
      vb:vx.toFixed(2)+' '+vy.toFixed(2)+' '+side.toFixed(2)+' '+side.toFixed(2),
      stroke:(side/100*0.5).toFixed(2),
      legend:mx>0?[{label:'한 곳당 매출 낮음',op:'0.12'},{label:'보통',op:'0.4'},{label:'높음',op:'0.75'}]:[],
      legendNote:mx>0?'색이 진한 구일수록 이 장사의 가게 한 곳당 매출이 높아요. 데이터가 없는 구는 회색이에요.':'',
      gus:Object.keys(SM.gus).map(g=>{
        const v=per[g];
        return {d:SM.gus[g].d,
          fill:v!=null?'var(--accent)':'var(--surface)',
          op:v!=null?(0.1+0.68*(v/mx)).toFixed(2):'1',
          sw:involved[g]?(side/100*0.9).toFixed(2):(side/100*0.4).toFixed(2),
          sc:involved[g]?'var(--ink)':'var(--line-strong)'};
      }),
      pins:list.filter(o=>SM.pts[o.id]).map((o,i)=>{
        const p=SM.pts[o.id]||[50,50], on=o.id===selId;
        const rr=side/100*(on?3.2:2.5);
        return {n:i+1, name:this.zoneLabelOf(o.name), x:p[0], y:p[1], on:on,
          r:rr.toFixed(2), ty:(p[1]+rr*0.36).toFixed(2), fs:(rr*1.05).toFixed(2),
          fill:on?'var(--accent)':'var(--ink3)',
          chip:'flex:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:8px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:36px;transition:background .14s,color .14s;'
            +(on?'background:var(--accent);color:#FFFFFF;font-weight:600':'background:var(--surface);color:var(--ink2)'),
          pick:()=>this.setState({sel:o.id})};
      })
    };
  },

  // 정밀비교 — 한 자치구 안의 동네를 전부 표로 펼친다
  mvSections(sel,L){
    const S=this.state;
    const lp=S.zlp&&S.zlp[sel.id];
    const R=S.sti&&S.sti.ind?S.sti.ind[S.ind]:null;
    const HI=S.salesHistory, RENT=S.rentStats;
    const med=key=>{ const v=L.map(o=>o[key]).sort((a,b)=>a-b); return v[Math.floor(v.length/2)]; };
    const AL=['10대','20대','30대','40대','50대','60대+'];
    const bar=p=>'display:block;width:'+Math.max(Math.min(p,100),2).toFixed(0)
      +'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.4+0.6*Math.min(p,100)/100).toFixed(2);
    const out=[];

    // 수요
    const dRows=[], dBars=[];
    if(lp){
      const mxA=Math.max(...lp.age,1);
      lp.age.forEach((v,i)=>dBars.push({label:AL[i], value:Math.round(v).toLocaleString()+'명', bar:bar(v/mxA*100)}));
      dRows.push({label:'추정 객단가', value:Math.round(sel.unit).toLocaleString()+'원', tag:'(추정)'});
      dRows.push({label:'여성 / 남성', value:Math.round(lp.f/lp.tot*100)+'% / '+Math.round(lp.m/lp.tot*100)+'%', tag:''});
    }
    out.push({key:'demand', title:'수요 · 누가 오나요',
      q:'하루에 사람이 얼마나 오나요?',
      big: lp? Math.round(lp.tot).toLocaleString()+'명' : '데이터 없음',
      bigLabel: lp? lp.dong+' 행정동 하루 유동인구' : '유동인구 자료가 없어요',
      verdict:(()=>{
        if(!lp) return '유동인구 데이터가 없어서 수요는 판단하지 못했어요.';
        const t=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l?l.tot:null; }).filter(v=>v!=null).sort((a,b)=>a-b);
        const m=t[Math.floor(t.length/2)];
        return lp.tot>=m*1.2? '사람이 많이 오는 편이에요.' : (lp.tot>=m*0.8? '사람은 보통 수준이에요.' : '사람이 적은 편이에요.');
      })(),
      rows:dRows, bars:dBars,
      note: lp? '유동인구는 '+lp.dong+' 행정동 값이라 상권보다 넓어요. 시간대·요일 데이터는 아직 없어요.' : ''});

    // 경쟁
    const cRows=[{label:'같은 장사 수', value:sel.stores.toLocaleString()+'곳', tag:''},
      {label:'서울 중앙값', value:Math.round(med('stores')).toLocaleString()+'곳', tag:'이 장사 동네들의 중앙값'}];
    let satWord='';
    if(lp){
      const sat=sel.stores/(lp.tot/10000);
      const sats=L.map(o=>{ const l=S.zlp&&S.zlp[o.id]; return l&&l.tot?o.stores/(l.tot/10000):null; })
        .filter(v=>v!=null).sort((a,b)=>a-b);
      const sm=sats[Math.floor(sats.length/2)];
      cRows.push({label:'사람 1만 명당 가게', value:sat.toFixed(1)+'개', tag:'사람 수 대비'});
      cRows.push({label:'서울 중앙값', value:sm.toFixed(1)+'개', tag:'포화도 기준선'});
      satWord = sat<=sm*0.7? '사람 수에 비해 가게가 적어요.' : (sat<=sm*1.3? '경쟁은 보통 수준이에요.' : '사람 수에 비해 가게가 많은 편이에요.');
    }
    out.push({key:'comp', title:'경쟁 · 얼마나 치열한가요',
      q:'같은 장사가 몇 곳 있나요?',
      big:sel.stores.toLocaleString()+'곳',
      bigLabel:'서울 중앙값 '+Math.round(med('stores')).toLocaleString()+'곳',
      verdict: satWord || (sel.stores<=med('stores')? '같은 장사가 서울 중앙값보다 적어요.' : '같은 장사가 많은 편이에요.'),
      rows:cRows, bars:[],
      note:'가게 수만 보면 큰 동네가 늘 불리해 보여요. 그래서 사람 수로 나눠 견줘요.'});

    // 매출
    const mp=med('per'), diff=Math.round((sel.per-mp)/mp*100);
    const sRows=[{label:'가게 한 곳당 월매출', value:this.fmt(sel.per/3)+'원', tag:'(추정)'},
      {label:'서울 중앙값', value:this.fmt(mp/3)+'원', tag:'이 장사 동네들의 중앙값'},
      {label:'손님이 쓴 돈 (3개월)', value:this.fmt(sel.sales)+'원', tag:''}];
    let trend=null;
    if(HI&&HI.ind[S.ind]){
      const series=HI.ind[S.ind];
      const qs=HI.quarters.filter(q=>series[q]!=null);
      const last4=qs.slice(-4), prev4=qs.slice(-8,-4);
      const sum=a=>a.reduce((x,q)=>x+series[q],0);
      const cur=sum(last4), prv=prev4.length?sum(prev4):0;
      const pct=prv? (cur-prv)/prv*100 : null;
      const vals=last4.map(q=>series[q]);
      const mn=Math.min(...vals), mx=Math.max(...vals), sp=(mx-mn)||1;
      trend={label:'최근 4분기 흐름',
        delta: pct==null?'—':((pct>0?'+':'')+pct.toFixed(1)+'%'),
        deltaStyle:'font-size:14px;font-weight:700;white-space:nowrap;color:'+(pct==null?'var(--ink3)':(pct>=0?'var(--good)':'var(--warn)')),
        bars:last4.map((q,i)=>({label:this.qtr(q).replace('년 ','.').replace('분기','Q'),
          bar:'display:block;width:100%;height:'+(18+((vals[i]-mn)/sp)*46).toFixed(0)+'px;border-radius:4px 4px 0 0;background:var(--accent);opacity:'+(0.4+0.6*((vals[i]-mn)/sp)).toFixed(2)})),
        full:'서울 전체 합계라 이 동네만의 흐름은 아니에요. 21분기 전체는 시세분석에서 볼 수 있어요.'};
    }
    out.push({key:'sales', title:'매출 · 얼마나 버나요',
      q:'가게 한 곳이 한 달에 얼마 파나요?',
      big:this.fmt(sel.per/3)+'원',
      bigLabel:'서울 중앙값 '+this.fmt(mp/3)+'원 · 추정',
      verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요.' : (diff<=-10? '서울 중앙값보다 '+Math.abs(diff)+'% 낮아요.' : '서울 중앙값과 비슷해요.')),
      rows:sRows, bars:[], trend:trend,
      note:'한 곳당 매출은 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아니에요.'});

    // 비용
    const kRows=[];
    if(RENT&&RENT.zones){
      const zs=Object.values(RENT.zones);
      const rr=zs.map(o=>o.rent).sort((a,b)=>a-b);
      const vv=zs.map(o=>o.vacancy).sort((a,b)=>a-b);
      kRows.push({label:'서울 권역 ㎡당 월 임대료 중앙값', value:rr[Math.floor(rr.length/2)].toFixed(1)+'만원', tag:'서울 평균'});
      kRows.push({label:'서울 권역 빈 상가 비율 중앙값', value:vv[Math.floor(vv.length/2)].toFixed(1)+'%', tag:'서울 평균'});
    }
    kRows.push({label:'권리금 · 인테리어', value:'자료 없음', tag:'공개 통계에 없어요'});
    // 임대료를 '데이터 없음'으로 비워 두면 이 칸이 늘 죽어 있다.
    // 있는 자료(한국부동산원)를 쓰되, 이 상권 값인지 서울 평균인지 분명히 밝힌다.
    const rf=this.rentRef(sel.name);
    out.push({key:'cost', title:'비용 · 얼마가 나가나요',
      q:'임대료는 얼마인가요?',
      big: rf? rf.value : '자료 없음',
      bigLabel: rf? (rf.per+' · '+rf.note) : '상가 임대료 자료를 아직 불러오지 못했어요',
      verdict: rf&&rf.exact
        ? '이 값은 조사 기준 상권 평균이에요. 실제 계약은 층·면적·위치로 크게 달라져요.'
        : '상권 단위 임대료는 아직 없어요. 중개인에게 확인한 금액을 본전 계산에 직접 넣으세요.',
      rows:kRows, bars:[],
      note:'한국부동산원 상업용부동산 임대동향조사(중대형 상가) 기준이에요. 조사 상권 구획이 이 앱의 상권 1,564곳과 달라, 이름이 정확히 맞는 곳만 그 상권 값을 쓰고 나머지는 서울 평균을 보여드려요.'});

    // 시장 구조
    const kk=[];
    if(R){
      const rate=R.stores? R.closed/R.stores*100 : 0;
      kk.push({label:'프랜차이즈 비중', value:R.fr_share+'%', tag:'서울 전체'});
      kk.push({label:'새로 연 곳 / 문 닫은 곳', value:R.opened.toLocaleString()+'곳 / '+R.closed.toLocaleString()+'곳', tag:'서울 전체 · 3개월'});
      kk.push({label:'폐업률', value:rate.toFixed(1)+'%', tag:'서울 전체 · 폐업 ÷ 전체'});
    } else kk.push({label:'개·폐업', value:'데이터 없음', tag:''});
    // 이 자리 다른 장사 — 같은 상권 안 다른 업종의 가게 수와 한 곳당 매출
    const nb=(()=>{
      const z=S.zi&&S.zi.zones?S.zi.zones[sel.id]:null;
      if(!z||!z.rows) return null;
      const names=S.zi.inds||[];
      const all=z.rows.map(r=>({idx:r[0], name:names[r[0]]||('업종 '+r[0]), stores:r[1], sales:r[2]}))
        .filter(o=>o.stores>0).map(o=>({...o, per:o.sales/o.stores/3}));
      if(!all.length) return null;
      const mine=all.find(o=>o.name===S.ind);
      const top=all.slice().sort((a,b)=>b.per-a.per).slice(0,8);
      const mx=Math.max(...top.map(o=>o.per));
      return {
        total:all.length,
        mine:mine||null,
        rank:mine? all.slice().sort((a,b)=>b.per-a.per).findIndex(o=>o.name===S.ind)+1 : null,
        bars:top.map(o=>({label:o.name, value:this.fmt(o.per)+'원',
          bar:bar(o.per/mx*100)+(o.name===S.ind?';background:var(--accent)':';background:var(--ink3)')}))
      };
    })();
    if(nb){
      const nRows=[{label:'이 자리 장사 종류', value:nb.total+'가지', tag:''}];
      if(nb.mine) nRows.push({label:'내 장사 순위', value:nb.rank+'위 / '+nb.total+'가지', tag:'가게 한 곳당 매출 기준'});
      out.push({key:'nearby', title:'이 자리 · 다른 장사는 어떤가요',
        q:'이 자리에서 뭐가 가장 잘 팔리나요?',
        big:nb.bars[0].label,
        bigLabel:'가게 한 곳당 월매출 1위 · '+nb.bars[0].value,
        verdict: nb.rank && nb.rank<=3
          ? '고른 장사가 이 자리에서 '+nb.rank+'번째로 잘 팔려요.'
          : (nb.rank? '이 자리에서는 다른 장사가 더 잘 팔려요. 위 목록을 보고 업종을 다시 볼 수도 있어요.' : '고른 장사는 이 자리에 아직 없어요.'),
        rows:nRows, bars:nb.bars,
        note:'같은 상권 안 다른 장사의 가게 수와 매출이에요. 초록색이 지금 고른 장사예요. 잘 팔리는 장사가 늘 좋은 건 아니에요 — 그만큼 이미 자리를 잡았다는 뜻일 수도 있어요.'});
    }

    // 매출 늘리기 — 있는 데이터에서만 뽑는다
    const tips=[];
    if(lp){
      let hi=0; lp.age.forEach((v,i)=>{ if(v>lp.age[hi]) hi=i; });
      const fw=Math.round(lp.f/lp.tot*100);
      tips.push({label:'가장 많은 손님', value:AL[hi], tag:'하루 '+Math.round(lp.age[hi]).toLocaleString()+'명'});
      tips.push({label:'여성 비율', value:fw+'%', tag:fw>=55?'여성 손님이 많아요':(fw<=45?'남성 손님이 많아요':'비슷해요')});
      const perHead=sel.unit;
      tips.push({label:'추정 객단가', value:Math.round(perHead).toLocaleString()+'원',
        tag:'(추정)'});
    }
    if(nb&&nb.bars.length>1) tips.push({label:'같이 잘 되는 장사', value:nb.bars.slice(0,2).map(b=>b.label).join(' · '), tag:'이 자리 매출 상위'});
    if(tips.length) out.push({key:'grow', title:'늘리기 · 무엇을 해볼까요',
      q:'이 자리에서 매출을 어떻게 늘리나요?',
      big: lp? AL[(()=>{let h=0;lp.age.forEach((v,i)=>{if(v>lp.age[h])h=i;});return h;})()] : '데이터 없음',
      bigLabel: lp? '가장 많이 오는 나이대에 맞추는 게 먼저예요' : '',
      verdict:(()=>{
        if(!lp) return '유동인구가 없어서 손님 구성을 말하지 못했어요.';
        const perHead=sel.unit;
          return '유동인구 구성은 방문객의 참고 정보입니다. 실제 고객과 메뉴 수요는 현장에서 확인해 주세요.';
      })(),
      rows:tips, bars:[],
      note:'저희가 가진 데이터로 말할 수 있는 것만 적었어요. 메뉴·가격·마케팅은 데이터가 아니라 사장님 판단이에요.'});

    out.push({key:'market', title:'시장 구조 · 누가 버티고 있나요',
      q:'이 장사는 앞으로 어떨까요?',
      big: R? ((R.opened-R.closed>0?'+':'')+(R.opened-R.closed).toLocaleString()+'곳') : '데이터 없음',
      bigLabel: R? '3개월 동안 새로 연 곳 − 문 닫은 곳 · 서울 전체' : '',
      verdict: R? (R.opened>=R.closed
        ? '가게가 늘고 있어요. 지금 계산한 한 곳당 매출은 앞으로 더 나뉠 수 있어요.'
        : '가게가 줄고 있어요. 경쟁이 풀리는 신호일 수도, 장사가 어려워지는 신호일 수도 있어요.') : '개·폐업 데이터가 없어요.',
      rows:kk, bars:[],
      note:'모두 서울 전체 이 장사 기준이라 자리를 바꿔도 변하지 않아요.'});

    // 메뉴는 6개까지. 순서는 '매출 → 수요 → 경쟁 → 비용 → 이 자리 → 시장 구조'.
    // '늘리기'는 숫자가 아니라 조언이라 메뉴에서 빼고 대시보드 아래에 따로 둔다.
    const ORDER=['sales','demand','comp','cost','nearby','market'];
    const rk=k=>{ const i=ORDER.indexOf(k); return i<0?99:i; };
    out.sort((a,b)=>rk(a.key)-rk(b.key));
    return out;
  }
};
