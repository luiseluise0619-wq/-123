'use strict';
// 리포트 설문·지원사업 표시·CSV/인쇄/이메일. 출력 핸들러와 공고 선택은 같은 렌더의 값을 사용한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.report = {
  reportView(r){
    const S=this.state;
    const reportSelection=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)||r.list[0]):null;
    const reportZone=reportSelection?this.zoneLabelOf(reportSelection.name):this.tr('동네 미선택');
    const email=(S.rp_email||'').trim();
    const ok=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!S.rp_agree;
    const sent=!!S.rp_sent; const sending=!!S.rp_sending; const enabled=!!S.reportEmailEnabled;
    // 리포트(미리보기·CSV·메일)에 넣을 지원사업 목록.
    // sp 를 그리면서 채우고, 내보내기 버튼을 눌렀을 때 buildReport 가 읽는다.
    // (sp 는 renderVals 안에서 돌고 buildReport 는 그 뒤 클릭 때 불린다.)
    let supportForReport=[];
    // 화면 맨 앞에 세운 '최대 얼마' 를 인쇄본에도 같이 적는다(같은 값, 같은 근거).
    let supportMaxForReport=null;
    const buildReport=()=>{
        // 상권을 직접 고르지 않았으면 **설문에서 답한 구** 안에서 1위를 고른다.
        // 서울 밖(부산 등)은 자료가 없어 서울 1위로 떨어진다 — 그건 아래에서 밝혀 적는다.
        const rpGu=(S.rp_sido==='서울' && S.rp_gu && S.rp_gu!=='아직 몰라요') ? S.rp_gu : '';
        const inGu=(r&&rpGu&&S.zgu) ? r.list.find(o=>S.zgu[o.id]===rpGu) : null;
        const sel=r?(r.list.find(o=>o.id===S.sel)||r.list.find(o=>o.id===S.zoneId)
                    ||inGu||r.list[0]):null;
        // 손익은 **리포트 결과물에만** 넣는다(사장님 지시 2026-09-07).
        // 리포트 화면은 설문 → 지원사업 둘뿐이고, 아래 값은 PDF·CSV·메일에서만 보인다.
        // 설문의 '가게 조건' 단계에서 받은 값을 쓰고, 비워 두셨으면 기본 가정으로 계산한다.
        // 어느 쪽인지 줄마다 적는다 — 지어낸 값과 넣으신 값이 섞이면 안 된다(§1).
        const c=sel?this.calc(sel):null;
        // 그 칸을 실제로 손댔을 때만 '직접 넣으신 값'이라고 적는다.
        const touched=S.rp_touched||{};
        const said=k=>touched[k]? '직접 넣으신 값' : '기본 가정';
        const bep=c&&c.valid!==false?[
          {label:'월 본전선 (이만큼 팔면 본전)', value:this.man(c.bep), tag:'고정비 ÷ (1 − 원가율)'},
          {label:'월매출 가정 ('+S.scen+')', value:this.man(c.rev), tag:'상권 평균 추정 × '+c.mult},
          {label:'월 영업이익', value:this.man(c.profit), tag:'세금·대출 이자는 빼지 않음'},
          // 계산에 **실제로 쓴 값**을 적는다. 화면 state 를 그대로 적으면
          // 칸을 비웠을 때 '0만원' 이라고 인쇄해 놓고 계산은 400 으로 하게 된다.
          {label:'월 임대료', value:c.rent.toLocaleString()+'만원', tag:said('rent')},
          {label:'평수', value:c.area+'평', tag:said('area')},
          {label:'인건비', value:this.man(c.labor),
           tag:(touched.staffOv&&S.staffOv!=null)?'직접 넣으신 직원 수':'평수로 추정'},
          {label:'원가율', value:Math.round(c.cogs*100)+'%', tag:'계산에 쓴 값'}
        ]:(c?[{label:'손익 계산',value:'계산할 수 없음',tag:c.error}]:null);
        if(c&&c.payback!=null) bep.push(
          {label:'회수기간', value:c.payback.toFixed(1)+'개월', tag:'초기투자 ÷ 월 영업이익'});
        const payload={
          ind:S.ind?this.tr(this.indName(S.ind)):'', zone:sel?this.zoneLabelOf(sel.name):this.tr('동네 미선택'),
          gu:sel?this.guLabel(sel.id):'',
          // 상권을 안 고르고 리포트를 받으면 앱이 골라 계산한다.
          // 그걸 '고르신 곳'처럼 적으면 지어낸 값이 된다(§1) — 리포트에 밝혀 적는다.
          zoneAuto: !(S.sel||S.zoneId),
          zoneAutoGu: (!(S.sel||S.zoneId) && inGu) ? rpGu : '',
          quarter:S.zi?this.qtr(S.zi.quarter):'',
          support:supportForReport,
          supportMax:supportMaxForReport,
          bep:bep,
          // 돈이 어디로 나가는지 — 매출 대비 비중
          money:c&&c.valid!==false?(()=>{
            const rev=c.rev||1;
            const rows=[
              {label:'임대료', v:c.rent},
              {label:'인건비', v:c.labor||0},
              {label:'재료비', v:rev*c.cogs},
              {label:'그 밖의 운영비', v:c.etc||0}
            ];
            const mx=Math.max(...rows.map(o=>o.v),1);
            return rows.filter(o=>o.v>0).map(o=>({
              label:o.label, value:this.man(o.v),
              pct:Math.round(o.v/mx*100),
              warn:o.v/rev>0.3
            }));
          })():null,
          survey:[
            // 지역·업종은 이름이라 이어 붙이면 사전이 못 찾는다 — 조각마다 옮긴 뒤 잇는다
            ['지역',[S.rp_sido,S.rp_gu&&S.rp_gu!=='아직 몰라요'?S.rp_gu:'']
              .filter(Boolean).map(v=>this.placeName(v)).join(' ')],
            ['업종',S.rp_ind?this.tr(this.indName(S.rp_ind)):''],
            ['창업 단계',S.rp_stage],['나이',S.rp_age],['사업자등록',S.rp_biz],
            ['개업 시기',S.rp_when],['필요한 지원',S.rp_need]
          ].filter(([,v])=>!!v).map(([label,value])=>({label,value})),
          // 비교에 담은 자리
          zones:(S.picks|| (r?r.list.slice(0,3).map(o=>o.id):[])).map(id=>r&&r.list?r.list.find(o=>o.id===id):null)
            .filter(Boolean).map(o=>({
              name:this.zoneLabelOf(o.name), score:Math.round(o.score),
              stores:o.stores.toLocaleString()+'곳'
            }))
        };
        if(!payload.zones.length) delete payload.zones;
        if(!payload.survey.length) delete payload.survey;
        if(!payload.support.length) delete payload.support;
        if(!payload.bep) delete payload.bep;
        if(!payload.money||!payload.money.length) delete payload.money;
        return payload;
    };
    return {
      // 담을 항목 체크박스를 없앴으니 '고른 게 0개'인 상태도 없다 — 자리만 있으면 내보낼 수 있다
      exportDisabled:!reportSelection,
      title:'창업 지원 리포트',
      sub:'몇 가지만 고르면 조건에 맞는 지원사업과 상권 분석을 한 장으로 정리해요.',
      // '담을 항목 N개'는 지운 체크박스를 가리키던 말이라 뺐다
      target:(S.ind?this.indName(S.ind):'장사 미선택')+' · '+reportZone,
      // ── 리포트에 담을 내용을 한 번에 하나씩 묻는다 ──────────────────
      // 설문이 아니라 '리포트 만들기'다. 답한 것이 그대로 리포트에 들어간다.
      // 지역 → 구 → 동네 → 비교 대상 → 창업 조건 순으로, 큰 것부터 좁혀 간다.
      ...(()=>{
        const zi=S.zi, zgu=S.zgu||{};
        const sido=S.sido||'서울특별시';
        const seoul=sido==='서울특별시';
        const gu=S.rp_gu||'';
        const idx=zi?zi.inds.indexOf(S.ind):-1;
        const PICKS=S.picks||[];

        const zlp=S.zlp||{};
        const q0=(S.rp_q||'').trim().replace(/\s/g,'');

        // 서울 전체에서 이 장사 데이터가 있는 상권 (매출 높은 순).
        // 자치구와 행정동을 함께 들고 있어야 '주소처럼' 찾을 수 있다.
        const allZones=(()=>{
          if(!zi||idx<0) return [];
          const out=[];
          for(const k in zi.zones){
            const row=(zi.zones[k].rows||[]).find(r=>r[0]===idx);
            if(!row||!row[1]||!row[2]) continue;
            out.push({id:k, gu:zgu[k]||'', dong:(zlp[k]&&zlp[k].dong)||'',
              name:this.zoneLabelOf(zi.zones[k].nm), stores:row[1], per:row[2]/row[1]});
          }
          out.sort((a,b)=>b.per-a.per);
          return out;
        })();
        // 고른 구 안에서만. 순위는 구 안에서 매긴다.
        const zonesOfGu=allZones.filter(z=>gu&&z.gu===gu);
        zonesOfGu.forEach((z,i)=>{ z.rank=i+1; });
        const nameOf=id=>(zi&&zi.zones[id])?this.zoneLabelOf(zi.zones[id].nm):id;
        const guOf=id=>zgu[id]||'';
        // 동네 이름만 있으면 뭘 골라야 할지 알 수 없다 — 순위와 가게당 매출을 같이 적는다.
        // per 는 3개월 합계라 /3 해서 월로 적는다(다른 화면과 같은 기준). 가게가 2곳 이하면
        // '가게당'이 사실상 한 가게 실적이라 그 사실을 숨기지 않고 함께 적는다.
        const zoneSub=z=>z.rank+'위 · 가게당 월 '+this.won(z.per/3)
          +(z.stores<=2?' · 가게 '+z.stores+'곳뿐':'');
        // 쳐서 찾을 때는 순위 대신 '어디인지'를 먼저 알려준다 — 다른 구가 나올 수 있어서다
        // ── 리포트 설문 ─────────────────────────────────────────────
        // 지역은 시·도 → 구 두 걸음으로 묻는다. 지자체 공고가 지역별로 따로 있어서다.
        const RP_SIDO=['서울','부산','대구','인천','광주','대전','울산','세종',
                       '경기','강원','충북','충남','전북','전남','경북','경남','제주'];
        const RP_GU_SEOUL=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구',
                           '강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구',
                           '구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
        const RP_GU_NONE='아직 몰라요';
        // 이 설문의 목적은 본전 계산이 아니라 '신청할 수 있는 정부 창업지원사업'을
        // 찾아 주는 것이다. 그래서 매칭에 쓰지 않는 질문(자금·대출·버틸 기간)은 뺐다.
        // 남은 것은 전부 공고 자격 요건에 실제로 등장하는 조건이다.
        const BEPD=globalThis.MysbizonConst.BEP_DEFAULT;
        const STEPS=[
          // ① 시·도 — 지자체 공고는 지역별로 따로 있다. 자료가 서울뿐이어도 지역은 다 묻는다.
          {k:'sido', q:'어느 지역에서 창업하세요?',
           hint:'지역별 공고도 함께 확인해요.',
           opts:RP_SIDO.map(v=>({v,label:v})), grid:true,
           val:S.rp_sido, set:v=>({rp_sido:v, rp_gu:''})},

          // ② 구 — 서울만 구 목록을 갖고 있다. 다른 시·도는 이 단계를 건너뛴다.
          {k:'gu', q:'서울 어느 구인가요?',
           hint:'아직 안 정하셨으면 건너뛰어도 돼요.',
           opts:[{v:RP_GU_NONE,label:RP_GU_NONE}, ...RP_GU_SEOUL.map(v=>({v,label:v}))], grid:true,
           val:S.rp_gu, set:v=>({rp_gu:v}),
           only: S.rp_sido==='서울'},

          // ③ 업종 — 공고마다 지원 업종이 정해져 있다. 많이 찾는 것부터, 나머지는 검색.
          {k:'ind', q:'어떤 업종으로 시작하세요?',
           hint:'공고마다 지원 업종이 정해져 있어요.',
           opts:(zi?zi.inds:[]).map(v=>({v,label:this.indName(v)})),
           defaultOpts:(zi?['커피-음료','한식음식점','치킨전문점','호프-간이주점','분식전문점','제과점','미용실','편의점']
                      .filter(n=>zi.inds.indexOf(n)>=0):[]).map(v=>({v,label:this.indName(v)})),
           search:'업종 이름 (예: 카페)', grid:true,
           val:S.rp_ind,
           set:v=>({ind:v, rp_ind:v})},

          // ③ 창업 단계 — '예비창업자' 전용 공고가 가장 많다
          {k:'stage', q:'지금 어느 단계에 계세요?',
           hint:'예비창업자만 신청할 수 있는 공고가 따로 있어요.',
           opts:['아직 준비 중이에요 (예비창업자)','문 연 지 1년 안 됐어요','1~3년 됐어요','3년 넘었어요'].map(v=>({v,label:v})),
           val:S.rp_stage, set:v=>({rp_stage:v})},

          // ④ 나이 — 청년 창업 지원의 기준선
          {k:'age', q:'나이가 어떻게 되세요?',
           hint:'청년 창업 지원은 보통 만 39세 이하가 대상이에요.',
           opts:['만 39세 이하','만 40세 이상'].map(v=>({v,label:v})),
           val:S.rp_age, set:v=>({rp_age:v})},

          // ⑤ 사업자등록 여부
          {k:'biz', q:'사업자등록을 하셨나요?',
           hint:'등록 전이면 예비창업 공고, 등록 후면 소상공인 공고 쪽이에요.',
           opts:['아직 안 했어요','했어요'].map(v=>({v,label:v})),
           val:S.rp_biz, set:v=>({rp_biz:v})},

          // ⑥ 창업 시기 — 마감이 그 안에 있는 공고를 앞으로 끌어온다
          {k:'when', q:'언제 문을 열 계획이세요?',
           hint:'고른 시기 안에 마감되는 공고를 먼저 보여줘요.',
           opts:['3개월 안','6개월 안','1년 안','아직 미정'].map(v=>({v,label:v})),
           val:S.rp_when, set:v=>({rp_when:v})},

          // ⑦ 필요한 지원 — 공고의 '지원 분야'와 바로 이어진다
          {k:'need', q:'어떤 지원이 가장 필요하세요?',
           hint:'고른 분야와 가까운 공고를 먼저 보여줘요.',
           opts:['사업화 자금','시설·임차 비용','교육·멘토링','융자·대출'].map(v=>({v,label:v})),
           val:S.rp_need, set:v=>({rp_need:v})},

          // ⑧ 가게 조건 — 여기만 성격이 다르다.
          //   지원사업 매칭에는 **쓰지 않는다**(공고 자격에 임대료·평수가 나오지 않는다).
          //   리포트(PDF·CSV·메일)의 손익 계산에만 쓴다. 화면에는 결과를 그리지 않는다.
          //   비워 두고 넘어갈 수 있다 — 자리를 아직 안 정한 분은 임대료를 알 수 없다.
          //   그때는 기본 가정으로 계산하고, 리포트에 '기본 가정'이라고 적는다(§1).
          {k:'cost', q:'가게 조건을 넣으면 손익도 계산할 수 있어요',
           hint:'리포트(PDF·메일)에만 들어가요. 모르시면 비워 두고 넘어가셔도 돼요.',
           // blank = 비웠을 때 되돌아갈 값(= 이 서비스의 기본 가정). staffOv 는 null 이면
           // 평수에서 자동으로 잡는다.
           // max 는 계산이 쓰는 상한과 같은 값이다(util.calc·size). 여기서 더 큰 값을 받으면
           // 화면에는 그 숫자가 남고 계산은 상한으로 하게 되어, 넣은 값과 결과가 어긋난다.
           nums:[{label:'월 임대료 (만원)', key:'rent',    value:S.rent,    blank:BEPD.rent, max:100000},
                 {label:'평수 (평)',        key:'area',    value:S.area,    blank:BEPD.area, max:1000},
                 {label:'직원 수 (명)',     key:'staffOv', value:S.staffOv, blank:null,      max:100}],
           opts:[], val:S.rp_cost},

          // 이메일 — 리포트를 보낼 곳. 건너뛸 수 없다.
          {k:'email', q:'결과를 받을 이메일을 입력해 주세요',
           hint:'지원사업과 상권 분석을 한 장의 리포트로 받아보세요.',
           input:'email', opts:[], val:S.rp_email||''}
        ].filter(s=>s.only!==false);

        const N=STEPS.length;
        const firstOpen=STEPS.findIndex(s=>s.multi?false:!s.val);
        const step=Math.max(0,Math.min(
          S.rp_step!=null?S.rp_step:(firstOpen<0?N:firstOpen), N));
        const cur=step<N?STEPS[step]:null;
        const q=(S.rp_q||'').trim();
        // 지금 화면에 그릴 후보. 상권 단계는 이미 걸러서 왔고(preFiltered),
        // 구 단계는 치기 전까지 한 줄도 안 띄운다(blank).
        const visible = !cur ? []
          : cur.preFiltered ? cur.opts
          : cur.search ? (q
              ? cur.opts.filter(o=>o.label.replace(/\s/g,'').indexOf(q.replace(/\s/g,''))>=0).slice(0,8)
              : (cur.defaultOpts || (cur.blank? [] : cur.opts.slice(0,6))))
          : cur.opts;

        const optStyle=on=>'display:flex;align-items:center;justify-content:space-between;gap:12px;'
          +'width:100%;padding:17px 18px;border-radius:14px;cursor:pointer;'
          +'font-size:15.5px;line-height:1.4;text-align:left;'
          +'transition:background .14s,color .14s;'
          +'border:1px solid '+(on?'var(--accent)':'var(--line)')+';'
          +(on?'background:var(--card);color:var(--accent-hover);font-weight:700'
             :'background:var(--card);color:var(--ink)');
        // 지역·업종처럼 항목이 많은 단계는 격자로 깐다 — 세로로 세우면 버튼 벽이 된다(§29)
        const optStyleGrid=on=>'display:flex;align-items:center;justify-content:center;'
          +'padding:13px 10px;border-radius:12px;cursor:pointer;min-width:0;'
          +'font-size:14.5px;line-height:1.3;text-align:center;white-space:nowrap;'
          +'overflow:hidden;text-overflow:ellipsis;transition:background .14s,color .14s,border-color .14s;'
          +'border:1px solid '+(on?'var(--accent)':'var(--line-strong)')
          +(on?'background:var(--card);color:var(--accent-hover);font-weight:700'
             :'background:var(--card);color:var(--ink)');

        // 요약에 적을 말. 상권 단계는 코드(3001496)가 아니라 동네 이름으로 적는다.
        const shown=(v,isZone)=>Array.isArray(v)
          ? (v.length? v.map(nameOf).join(' · ') : '없음')
          : (v? (isZone? nameOf(v) : v) : '건너뜀');

        const hasSelect = visible.length>0 && cur&&cur.opts && !cur.multi && !cur.nums && !cur.input && (cur.grid || visible.length>5);

        return {
          qsStep: cur? (step+1)+' / '+N : '',
          hasStep: !!cur,
          qsBar:'display:block;height:100%;border-radius:2px;background:var(--accent);'
            // 옆 글자가 '1 / 9' 인데 막대는 step/N 이라 첫 질문에서 0% 였다 — 글자와 맞춘다
            +'transition:width .3s cubic-bezier(.22,.7,.25,1);width:'+Math.round((step+1)/N*100)+'%',

          hasCur: !!cur,
          curQ: cur?cur.q:'',
          curHint: cur?cur.hint:'',
          // 구 25개·동네 99개를 버튼으로 늘어놓으면 화면이 버튼 벽이 된다.
          // 치는 대로 걸러 6개만 보여준다. '강'만 쳐도 강남구·강동구가 뜬다.
          // 후보가 0개면 목록 칸 자체를 안 그린다 — 안 그러면 빈 여백만 22px 뜬다
          // 항목이 많은 단계를 드롭다운으로 바꿔 버튼 부담을 낮춘다.
          hasSelect,
          hasOpts: visible.length>0 && cur&&cur.opts && !hasSelect && !cur.multi && !cur.nums && !cur.input,
          // 격자로 그릴지, 한 줄씩 그릴지
          hasGridOpts: visible.length>0 && !!(cur&&cur.grid) && !hasSelect,
          // 칸 수는 언어를 따른다. 로마자 표기는 한글보다 두 배쯤 길어서
          // 3칸으로 두면 영어 화면에서 자치구 17개 중 15개가 말줄임으로 잘린다.
          optsGridStyle:'display:grid;gap:8px;margin-top:22px;'
            +'grid-template-columns:repeat('
            +(this.locale()==='en' ? this.L(2,3,3) : this.L(3,4,4))
            +',minmax(0,1fr))',
          // 주소 → 상권 매칭 확인. '강남역 상권으로 확인했어요' 처럼 말해 준다.
          isSearch: !!(cur&&cur.search),
          searchHint: cur&&cur.search?cur.search:'',
          searchQ: S.rp_q||'',
          onSearchQ: e=>this.setState({rp_q:e.target.value}),
          // Enter 로 첫 결과를 고른다 — 검색창에서 손을 떼지 않아도 되게
          onSearchKey: e=>{
            if(e.key!=='Enter') return;
            const first=visible[0];
            if(!first||!cur||!cur.set) return;
            this.setState(cur.stay
              ? {...cur.set(first.v), rp_step:step}
              : {...cur.set(first.v), rp_step:step+1, rp_q:''});
          },
          searchEmpty: !!(cur&&cur.search&&q&&visible.length===0),
          searchEmptyText: q? this.tn('search.noHit',{q:q}) : '',
          curOpts: visible.map(o=>{
            const on=cur.multi? (PICKS.indexOf(o.v)>=0) : (cur.val===o.v);
            return {
              value:o.v,
              label:o.label, on:on, style:(cur.grid?optStyleGrid:optStyle)(on),
              sub:o.sub||'', hasSub:!!o.sub,
              pick: cur.multi
                ? ()=>{ const has=PICKS.indexOf(o.v)>=0;
                    const next=has?PICKS.filter(x=>x!==o.v):(PICKS.length>=5?PICKS:[...PICKS,o.v]);
                    this.setState({picks:next, rp_sent:false}); }
                : ()=>this.setState(cur.stay
                    ? {...cur.set(o.v), rp_step:step, rp_sent:false, rp_error:''}
                    : {...cur.set(o.v), rp_step:step+1, rp_q:'', rp_sent:false, rp_error:''})
            };
          }),
          selectStyle:'width:100%;min-height:52px;padding:0 16px;border:1px solid var(--line-strong);border-radius:14px;background:var(--card);color:var(--ink);font-family:inherit;font-size:16px;appearance:none;',
          selectValue: cur?cur.val:'',
          selectPlaceholder:'선택하세요',
          onSelect:e=>{
            const v=e.target.value;
            if(!cur||!cur.set || !v) return;
            this.setState(cur.stay
              ? {...cur.set(v), rp_step:step, rp_sent:false, rp_error:''}
              : {...cur.set(v), rp_step:step+1, rp_q:'', rp_sent:false, rp_error:''});
          },
          // 여러 개 고르는 단계에서만 '다음'이 필요하다 — 하나 고르는 단계는 누르면 바로 넘어간다
          isMulti: !!(cur&&cur.multi),
          multiNext: ()=>this.setState({rp_step:step+1, rp_q:''}),
          multiLabel: PICKS.length? PICKS.length+'곳 담음 · 다음' : '안 고르고 다음',

          // 가게 조건 단계 — 숫자 칸 셋. 비워도 넘어간다(그러면 기본 가정으로 계산한다).
          isNums: !!(cur&&cur.nums),
          numFields: (cur&&cur.nums||[]).map(f=>({
            label:f.label,
            value:(f.value==null?'':String(f.value)),
            // 숫자만 받는다.
            //   비우면 '안 넣음'으로 되돌린다 — 값도 기본으로, 표시도 '기본 가정'으로.
            //   (비운 걸 0 으로 두면 임대료 0원·평수 1평으로 계산돼 본전선이 통째로 어긋난다.)
            //   어느 칸을 실제로 손댔는지 기억한다 — 임대료·평수는 기본값(400·15)이 미리 들어
            //   있어서, 그냥 넘긴 값을 리포트에 '직접 넣으신 값'이라고 적으면 거짓말이 된다(§1).
            onChange:e=>{ const raw=String(e.target.value||'').replace(/[^0-9]/g,'').slice(0,7);
              const t={...(S.rp_touched||{})};
              if(raw===''){ delete t[f.key]; }
              else t[f.key]=true;
              this.setState({[f.key]: raw===''? f.blank : Math.min(Number(raw), f.max),
                             rp_sent:false, rp_touched:t}); },
            style:'width:100%;font-size:16px;font-weight:500;color:var(--ink);background:var(--surface);'
              +'border:none;border-radius:14px;padding:0 16px;height:52px;outline:none'
          })),
          numsNext: ()=>this.setState({rp_cost:'입력함', rp_step:step+1, rp_q:'', rp_sent:false}),
          numsLabel:'다음',
          numsNextStyle:'width:100%;margin-top:18px;font-size:15.5px;font-weight:600;border:none;'
            +'border-radius:14px;height:50px;cursor:pointer;transition:filter .16s;'
            +'background:var(--accent);color:var(--on-accent)',

          // 이메일 단계 — 입력칸과 동의 체크가 이 카드 안에서 끝난다.
          // 여기는 건너뛸 수 없다. 주소가 있어야 리포트를 보내 드릴 수 있어서다.
          // 버튼은 늘 눌린다. 비었으면 막는 대신 입력칸이 흔들리고 빨간 글자로 이유를 말한다
          // — 눌리지 않는 회색 버튼은 '고장난 건가?' 하고 멈추게 만든다.
          isEmail: !!(cur&&cur.input==='email'),
          emailNext: ()=>this.setState(ok
            ? {rp_step:step+1, rp_q:'', rp_shake:0}
            : {rp_shake:(S.rp_shake||0)+1}),
          emailNextLabel:'리포트 받기',
          emailNextStyle:'width:100%;margin-top:16px;font-size:15.5px;font-weight:600;border:none;'
            +'border-radius:14px;height:50px;cursor:pointer;transition:filter .16s;'
            +'background:var(--accent);color:var(--on-accent)',
          // 한 번이라도 그냥 누른 뒤에만 빨간 글자가 뜬다 — 처음부터 혼내지 않는다
          hasEmailErr: !!S.rp_shake && !ok,
          emailErr: !email ? '메일 주소를 입력해 주세요'
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '메일 주소 형식이 맞지 않아요 (예: name@example.com)'
            : '아래 동의에 체크해 주세요',
          emailInputStyle:'width:100%;margin-top:20px;font-size:16px;font-weight:500;color:var(--ink);'
            +'background:var(--surface);border:none;border-radius:14px;padding:0 16px;height:52px;outline:none;'
            +((S.rp_shake && !ok)
              ? 'box-shadow:inset 0 0 0 1.5px var(--err);animation:'
                +(S.rp_shake%2?'shakeA':'shakeB')+' .4s cubic-bezier(.36,.07,.19,.97)'
              : ''),

          // 건너뛰기는 없앴다. 답이 비면 리포트의 그 칸이 빈 채로 나가서,
          // 사장님이 '왜 이건 안 나왔지'를 나중에 다시 물어야 했다.
          // 되돌아가는 길(←)은 남겨 둔다.
          curBack: step>0?()=>this.setState({rp_step:step-1, rp_q:''}):()=>{},
          hasBack: step>0,
          qsAllDone: !cur,
          // 공고 목록은 '가게 조건'·'이메일' 뒤에 숨어 있었다. 두 단계는 공고 매칭에
          // 쓰지 않는데도(임대료·평수·직원 수·이메일은 자격 요건에 안 나온다),
          // 이메일을 안 남기면 설문의 결론을 영영 못 보게 돼 있었다.
          spReady: !cur || cur.k==='email' || cur.k==='cost',
          // 다 답한 뒤엔 카드가 사라진다. 답을 다시 볼 수 있게 한 줄만 남긴다.
          // 이어 붙인 뒤에는 사전이 못 찾는다 — 조각마다 옮긴 뒤 잇는다.
          // '가게 조건'은 숫자라 요약에 넣지 않는다('입력함'은 사장님께 아무 뜻이 없다).
          doneLine: STEPS.map(st=>{
              if(st.k==='cost') return '';
              const v=shown(st.val, st.isZone);
              return st.k==='ind'? (st.val? this.indName(st.val) : '') : v;
            }).filter(v=>v&&v!=='건너뜀'&&v!=='없음').map(v=>this.tr(v)).join(' · '),
          editAgain: ()=>this.setState({rp_step:0, rp_q:''})
        };
      })(),
      customerEnabled:!!S.customerData?.enabled,
      customerTitle:this.t('customer.title'), customerExplain:this.t('customer.explain'),
      customerConsentLabel:this.t('customer.agree'), customerAgreed:S.customerAgree===true,
      customerRetention:this.t('customer.retention',{days:S.customerData?.retentionDays||0,contact:S.customerData?.contact||''}),
      customerOperator:S.customerData?.controller||'',
      customerToggle:()=>this.setState({customerAgree:!S.customerAgree,customerNote:''}),
      customerSaveLabel:this.t(S.customerSaving?'customer.saving':'customer.save'),
      customerSaveDisabled:!S.customerData?.enabled||!S.customerAgree||!email||!!S.customerSaving,
      customerNote:S.customerNote?this.t(S.customerNote):'',
      customerSave:async()=>{
        if(!S.customerData?.enabled||!S.customerAgree||this._customerSaving)return;
        this._customerSaving=true;this.setState({customerSaving:true,customerNote:''});
        try{
          const fields={sido:'rp_sido',gu:'rp_gu',industry:'rp_ind',stage:'rp_stage',age:'rp_age',business:'rp_biz',when:'rp_when',need:'rp_need',cost:'rp_cost'};
          const answers=Object.fromEntries(Object.entries(fields).map(([key,stateKey])=>[key,String(this.state[stateKey]||'')]));
          const payload={email,agreed:true,privacyVersion:S.customerData.privacyVersion,answers};
          const signature=JSON.stringify(payload);
          if(this._customerPayload!==signature){this._customerPayload=signature;this._customerId=crypto.randomUUID();}
          const response=await fetch('/api/customer-submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id:this._customerId}),signal:AbortSignal.timeout(12000)});
          if(!response.ok)throw new Error('Save failed');
          this.setState({customerNote:'customer.saved'});
        }catch{this.setState({customerNote:'customer.failed'});}
        finally{this._customerSaving=false;this.setState({customerSaving:false});}
      },
      email:email,
      onEmail:e=>{this._reportKey=null;this.setState({rp_email:e.target.value,rp_sent:false,rp_error:''});},
      agreed:!!S.rp_agree,
      toggleAgree:()=>this.setState({rp_agree:!S.rp_agree}),
      agreeText:'리포트 발송을 위해 이메일과 선택한 분석 내용을 메일 처리업체에 전달하는 데 동의합니다. 자세한 처리 내용은 개인정보 안내를 확인해 주세요.',
      checkStyle:'flex:none;width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;transition:background .14s;'
        +(S.rp_agree?'background:var(--accent)':'background:var(--surface);box-shadow:inset 0 0 0 1.5px var(--line-strong)'),
      sendDisabled:!enabled||!ok||sent||sending,
      sendLabel:sending?'발송 중…':sent?'발송 요청 완료':!enabled?'메일 발송 준비 중':(ok?'메일로 받기':'이메일과 동의가 필요해요'),
      sendStyle:'width:100%;font-size:15.5px;font-weight:600;border:none;border-radius:14px;height:50px;'
        +'transition:filter .16s,transform .2s cubic-bezier(.2,0,0,1);'
        +((ok&&!sent)?'cursor:pointer;background:var(--accent);color:var(--on-accent)'
          :(sent?'cursor:default;background:var(--good);color:var(--on-good)'
            :'cursor:pointer;background:var(--accent-3);color:var(--accent-hover)')),
      // ── 정부·지자체 지원사업 ────────────────────────────────────────
      // 위 '내 창업 조건'의 답으로 해당할 수 있는 공고를 앞으로 끌어온다.
      // 거르지 않고 순서만 바꾼다 — 우리 분류와 공고의 표현이 달라서
      // 못 맞춘 것을 버리면 진짜 필요한 제도가 사라진다.
      // 자격은 판정하지 않는다(CLAUDE.md §17: 법률 판단은 확정적으로 말하지 않는다).
      sp:(()=>{
        const d=S.sp;
        // ── 조건 → 공고 매칭 ────────────────────────────────────────
        // 자격을 '판정'하지 않는다(§17). 답한 조건과 겹치는 말이 공고에 있으면
        // 위로 올리고, 왜 올렸는지를 그대로 보여 준다. 최종 확인은 원문에서.
        const RULES=[];
        if(S.rp_stage==='아직 준비 중이에요 (예비창업자)')
          RULES.push({why:'예비창업자 조건', kw:['예비','창업 준비','신규','초기','스타트']});
        else if(S.rp_stage) RULES.push({why:'기존 사업자 대상', kw:['소상공인','기존','재도전','성장','스케일']});
        if(S.rp_age==='만 39세 이하') RULES.push({why:'청년 연령 조건', kw:['청년','39세','만 39','2030']});
        if(S.rp_biz==='아직 안 했어요') RULES.push({why:'사업자등록 전', kw:['예비','미등록','창업 전']});
        if(S.rp_biz==='했어요') RULES.push({why:'사업자등록 완료', kw:['소상공인','사업자','업력']});
        if(S.rp_need==='사업화 자금') RULES.push({why:'사업화 자금 지원', kw:['사업화','자금','바우처','보조']});
        if(S.rp_need==='시설·임차 비용') RULES.push({why:'시설·임차 지원', kw:['시설','임차','임대','공간','인테리어']});
        if(S.rp_need==='교육·멘토링') RULES.push({why:'교육·멘토링', kw:['교육','멘토','컨설팅','아카데미','사관학교']});
        if(S.rp_need==='융자·대출') RULES.push({why:'융자·정책자금', kw:['융자','대출','정책자금','보증']});
        if(S.ind) RULES.push({why:'업종 조건', kw:[this.indName(S.ind), S.ind]});
        const sidoNow=S.rp_sido||'';
        const guNow=(S.rp_gu && S.rp_gu!=='아직 몰라요')? S.rp_gu : '';
        if(sidoNow||guNow) RULES.push({why:'지역 조건', kw:[guNow, sidoNow].filter(Boolean)});

        const reasonsOf=it=>{
          const t=((it.title||'')+' '+(it.target||'')+' '+(it.kind||'')+' '+(it.content||'')+' '+(it.region||'')).toLowerCase();
          return RULES.filter(r=>r.kw.some(k=>k&&t.indexOf(String(k).toLowerCase())>=0)).map(r=>r.why);
        };
        const all=(d&&Array.isArray(d.items))?d.items:[];
        const scored=all.map(it=>({it, why:reasonsOf(it)}));
        const matched=scored.filter(o=>o.why.length>0).sort((a,b)=>b.why.length-a.why.length);
        const rest=scored.filter(o=>o.why.length===0);

        const today=new Date(); today.setHours(0,0,0,0);
        const ddOf=it=>it.deadline?Math.round((new Date(it.deadline+'T00:00:00')-today)/86400000):null;
        // 창업 시기를 고르면 그 안에 마감인 공고를 먼저 본다
        const horizon={'3개월 안':90,'6개월 안':180,'1년 안':365}[S.rp_when]||null;

        const card=(o)=>{
          const it=o.it, dd=ddOf(it);
          const soon=dd!=null&&dd<=14;
          return {
            title:it.title,
            org:it.org||'',
            hasOrg:!!it.org,
            amount:it.amount||'',
            hasAmount:!!it.amount,
            content:(it.content||'').slice(0,140),
            hasContent:!!it.content,
            target:it.target||'',
            hasTarget:!!it.target,
            dday: dd==null? '상시 모집' : (dd===0? '오늘 마감' : 'D-'+dd),
            ddayStyle:'flex:none;font-size:13px;font-weight:700;white-space:nowrap;'
              +'padding:5px 11px;border-radius:999px;font-variant-numeric:tabular-nums;'
              +(dd==null?'background:var(--surface);color:var(--ink2)'
                // 어두운 화면의 빨강(#FF6B60)에 흰 글자를 얹으면 2.79:1 이라 AA(4.5) 미달이다.
                :(soon?'background:var(--err);color:var(--on-err)':'background:var(--accent-3);color:var(--accent-hover)')),
            period:[it.start,it.deadline].filter(Boolean).join(' ~ ')||'',
            hasPeriod:!!(it.start||it.deadline),
            why:o.why.map(w=>({text:w})),
            hasWhy:o.why.length>0,
            url:it.url||'', hasUrl:!!it.url,
            // 아래 '조건에 걸리지 않은 공고' 격자에서는 카드 높이를 맞춘다
            style:'display:flex;flex-direction:column;gap:0;padding:22px;border-radius:var(--r-lg);height:100%;'
              +'background:var(--card);border:1px solid '+(soon?'var(--accent-2)':'var(--line)')
              +';min-width:0'
          };
        };
        const top=matched.filter(o=>{ const dd=ddOf(o.it); return horizon==null||dd==null||dd<=horizon; });
        const shownList=(top.length?top:matched).slice(0,12);
        const list=shownList.map(card);
        // 화면에 뜬 그대로를 리포트(미리보기·CSV·메일)에도 담는다 — 다시 고르지 않는다.
        supportForReport=shownList.map(o=>({
          title:o.it.title||'',
          org:o.it.org||'',
          amount:o.it.amount||'',
          period:[o.it.start,o.it.deadline].filter(Boolean).join(' ~ '),
          // 이어 붙인 뒤에는 사전이 통째로는 못 찾는다 — 조각마다 옮긴 뒤 잇는다
          why:o.why.map(w=>this.tr(w)).join(' · '),
          url:o.it.url||''
        }));
        const nearest=(top.length?top:matched).map(o=>ddOf(o.it)).filter(v=>v!=null).sort((a,b)=>a-b)[0];

        // ── '최대 얼마까지' ────────────────────────────────────────
        // 화면에 뜬 공고들의 금액 글자에서 숫자를 읽어 가장 큰 값을 앞에 세운다.
        // 읽어낸 게 하나도 없으면 이 줄은 아예 안 나온다 — 없는 값을 지어내지 않는다(§1).
        // 자격을 판정한 값이 아니다(§17). 그래서 어느 공고의 금액인지 이름을 같이 적는다.
        let maxOf=null;
        shownList.forEach(o=>{
          const v=this.wonParse(o.it.amount);
          if(v!=null && (maxOf==null||v>maxOf.v)) maxOf={v:v, title:o.it.title||''};
        });
        supportMaxForReport = maxOf? {amount:this.won(maxOf.v), title:maxOf.title} : null;

        return {
          loading:!d,
          notConfigured:!!d&&d.configured===false,
          failed:!!d&&d.configured!==false&&!d.ok,
          ready:!!d&&!!d.ok,
          // 사용자용 문구만. 환경변수 이름 같은 개발자 메시지는 내보내지 않는다.
          message: (!!d&&d.configured===false)
            ? '지원사업 정보를 준비 중이에요. 준비되면 이 자리에 신청할 수 있는 공고가 떠요.'
            : '지원사업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
          retry:()=>{this._spLoading=false;this.setState({sp:null});},
          countLabel:list.length+'개',
          nearest: nearest==null? '—' : (nearest===0?'오늘':'D-'+nearest),
          hasNearest: nearest!=null,
          hasMax: !!maxOf,
          maxAmount: maxOf? this.wonMax(maxOf.v) : '',
          maxFrom: maxOf? maxOf.title : '',
          items:list,
          hasItems:list.length>0,
          empty:!!d&&!!d.ok&&all.length===0,
          noMatch:!!d&&!!d.ok&&all.length>0&&list.length===0,
          hasRest:rest.length>0,
          rest:rest.slice(0,20).map(card),
          restLabel:'조건에 걸리지 않은 공고 '+rest.length+'개도 보기',
          showRest:!!S.spRest,
          toggleRest:()=>this.setState({spRest:!S.spRest}),
          // 세 조각을 이어 붙인 뒤에는 사전이 통째로는 못 찾는다 — 조각마다 옮긴 뒤 잇는다.
          warn:[
            this.tr('자격을 판정한 목록이 아니에요. 실제 신청 자격은 업력·매출·지역·업종·소상공인 여부에 따라 달라요. '
              +'여기 있는 건 답하신 조건과 겹치는 공고이고, 신청 가능 여부는 반드시 원문에서 확인해 주세요.'),
            (d&&d.undated)? this.tr('마감일을 읽지 못한 공고 '+d.undated+'개가 섞여 있어요(상시 모집일 수 있어요).') : '',
            (d&&d.expired)? this.tr('마감이 지난 '+d.expired+'개는 뺐어요.') : ''
          ].filter(Boolean).join(' ')
        };
      })(),

      // 엑셀에서 바로 열리는 CSV. 서버 없이 지금 화면의 값만 담는다.
      csv:()=>{

        const p=buildReport();
        const rows=[['항목','값','비고'],
          ['기준 분기',S.zi?this.qtr(S.zi.quarter):'','원자료 기준'],
          ['장사',p.ind,''],
          // 인쇄본과 같은 안내를 CSV 에도 남긴다 — 고른 적 없는 상권이면 그렇다고 적는다(§1)
          // 이름이 문장 가운데 들어가면 통째로는 사전에서 못 찾는다 — 자리표시자로 옮긴 뒤 끼운다
          ['동네',p.zone, p.zoneAuto? this.tr('직접 고른 상권이 아니라 {0} 이 업종 1위 상권')
            .split('{0}').join(this.placeName(p.zoneAutoGu||'서울')) : ''],
          ...(p.survey||[]).map(x=>[x.label,x.value,'설문 답']),
          ...(p.support||[]).map(x=>[x.title,[x.amount,x.period].filter(Boolean).join(' · '),
                                     [x.org,x.why,x.url].filter(Boolean).join(' · ')]),
          ...(p.bep||[]).map(x=>[x.label,x.value,x.tag]),
          ...(p.zones||[]).map(x=>[x.name,x.score+'점','비교 후보'])];
        const q=v=>{let t=String(v==null?'':v);if(/^[\s]*[=+@-]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
        // 화면은 영어인데 받은 파일만 한국어면 쓸 수 없다. 화면과 같은 표(@phrases)로 옮긴다 —
        // 공고 제목·기관명·상권 이름 같은 고유명사는 표에 없어 원문 그대로 남는다(그게 맞다).
        const body=rows.map(r=>r.map(v=>q(this.tr(String(v==null?'':v)))).join(',')).join('\r\n');
        // 엑셀이 한글을 깨지 않게 BOM을 붙인다
        const blob=new Blob(['\uFEFF'+body],{type:'text/csv;charset=utf-8'});
        const a=document.createElement('a');
        a.href=URL.createObjectURL(blob);
        // 파일 이름에 한글을 넣으면 **크로미움이 이름을 통째로 버린다** —
        // 확장자 없는 'download' 로 저장돼 엑셀이 더블클릭으로 못 연다(재현 확인).
        // 로마자로 옮기고 ASCII 만 남긴다. 날짜를 붙여 여러 번 받아도 안 겹친다.
        const asciiName=t=>String(t||'').replace(/[^\x20-\x7E]/g,'').trim()
          .replace(/\s+/g,'-').replace(/[^A-Za-z0-9._-]/g,'').replace(/-{2,}/g,'-').slice(0,40);
        const zoneName=asciiName(this.romanizeName(S.homeZoneName||''))||'Seoul';
        const indName =asciiName(this.romanizeName(S.ind?this.indName(S.ind):''));
        const day=new Date().toISOString().slice(0,10);
        a.download=['MYSBIZON',zoneName,indName,day].filter(Boolean).join('_')+'.csv';
        document.body.appendChild(a); a.click();
        setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },0);
      },
      // 리포트에는 본전 계산을 넣지 않는다(사장님 지시 2026-09-07).
      // 리포트 탭은 설문 → 찾은 지원사업, 딱 둘이다. 본전 계산은 ② 정밀분석 안에 따로 있다.
      // 여기 있던 rv(화면 안 본전 리포트) 블록은 어느 조각도 참조하지 않는 죽은 코드라 지웠다.
      // 인쇄본으로 넘어가기 전에 지금 상태를 담아 둔다.
      // 설문 답(rp_*)도 같이 담아야 '돌아가기' 로 왔을 때 다시 안 물어본다.
      preview:()=>{try{
        // 인쇄본도 화면과 같은 언어로 나가야 한다 — 담기 전에 한 번 옮긴다.
        // 한국어면 trDeep 이 아무 일도 하지 않는다.
        const payload=this.trDeep(buildReport());
        sessionStorage.setItem('mysbizon.report',JSON.stringify(payload));
        const restore=Object.fromEntries(
          ['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen','picks',
           'rp_sido','rp_gu','rp_ind','rp_stage','rp_age','rp_biz','rp_when','rp_need',
           'rp_cost','rp_email','rp_agree','rp_step','rp_touched'].map(k=>[k,S[k]]));
        sessionStorage.setItem('mysbizon.return',JSON.stringify(restore));
        location.href='report-print.html';
      }catch{this.setState({rp_error:'브라우저 저장 공간을 쓸 수 없어요. CSV 저장을 이용해 주세요.'});}},
      submit:async()=>{
        if(!enabled||!ok||sent||sending||this._reportSending)return;
        this._reportSending=true;
        this.setState({rp_sending:true,rp_error:''});
        try {
          // 메일도 화면과 같은 언어로 나간다(한국어면 trDeep 이 아무 일도 하지 않는다)
          const p=this.trDeep(buildReport());
          // 지원사업이 먼저고 손익이 그 다음이다 — 화면과 같은 순서로 담는다.
          const body=JSON.stringify({email,agreed:S.rp_agree===true,headline:this.tr('창업 지원사업 리포트'),sub:p.zone+' · '+p.ind,
            facts:[...(p.support||[]).map(x=>({label:x.title, value:[x.amount,x.period].filter(Boolean).join(' · '), tag:x.org})),
                   ...(p.bep||[])],
            survey:p.survey||[],zones:(p.zones||[]).map(z=>({name:z.name,value:z.score+'점'})),
            honesty:this.tr('지원사업은 자격을 판정한 목록이 아니에요 — 답하신 조건과 겹치는 공고라, 신청 가능 여부는 공고 원문에서 확인해 주세요. 손익은 상권 집계에서 계산한 추정치이고, 넣어 주신 조건은 서버에서 다시 검증하지 않았어요.')});
          if(this._reportBody!==body){this._reportBody=body;this._reportKey=crypto.randomUUID();}
          const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':this._reportKey},body,signal:AbortSignal.timeout(15000)});
          const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||'발송하지 못했어요.');
          this.setState({rp_sent:true});
        }catch(e){this.setState({rp_error:e.name==='TimeoutError'?'응답을 확인하는 데 시간이 너무 걸렸어요. 수신함을 확인한 뒤 다시 시도해 주세요.':e.message});}
        finally{this._reportSending=false;this.setState({rp_sending:false});}
      },
      note:S.rp_error||(sent?'메일 발송을 요청했어요. 스팸함도 확인해 주세요.':!enabled?'지금은 미리보기와 CSV 저장을 이용할 수 있어요. 이메일 발송은 준비 중이에요.':'이메일은 리포트 발송에만 써요. 매출 추정치와 직접 입력한 조건은 구분해서 담아요.')
    };
  }
};
