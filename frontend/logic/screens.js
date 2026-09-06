'use strict';
// 화면 하나가 쓸 값 묶음 — 홈·지역비교·후보 지역·시세분석
// app-logic.js 의 Component 프로토타입에 합쳐진다.
// 메서드 안의 this 는 컴포넌트 인스턴스다 — 옮기기 전과 똑같이 동작한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
const PRICE_CATS=globalThis.MysbizonConst.PRICE_CATS;
globalThis.MysbizonParts.screens = {
  home(){
    const S=this.state;
    // 원자료의 골목상권 이름에는 주민센터·은행지점·학교 같은 POI가 섞여 있다.
    // 지역을 찾는 사람에게 학교나 은행을 보여주지 않도록 걸러낸다.
    const POI=/주민센터|지점|초등학교|중학교|고등학교|중부중|병원|우체국|파출소|지구대|시장\)|아파트|교회|성당|역\d|출구/;
    const POP_Z=['강남역','홍대입구','성수','연남','을지로','서울대입구','가로수길','건대입구'];
    const POP=['한식음식점','커피-음료','치킨전문점','미용실','편의점','호프-간이주점','분식전문점','일반의원','제과점','일반교습학원'];
    const q=(S.zq||'').trim();
    // 목록 각 줄에 판단 근거를 붙인다 — 이름만으로는 고를 수 없다
    // 경계에 걸친 상권은 두 구를 함께 쓴다 (강남역은 강남대로 서쪽이라 서초구다)
    const guOf=id=>{
      const own=(S.zgu&&S.zgu[id])||'';
      const b=S.zbd&&S.zbd[id];
      return (own&&b&&b[1])? own+'·'+b[1]+' 경계' : own;
    };
    const meta=id=>{
      if(!S.zi||!S.zi.zones[id]) return '';
      const rows=(S.zi.zones[id].rows||[]).filter(r=>r[1]&&r[2]);
      const g=guOf(id);
      // 가게 개수는 고를 때 쓰지 않는다 — 자치구만 남긴다
      return g || (rows.length? '' : '데이터 없음');
    };
    let list=[], heading='', empty=false, emptyText='';
    if(S.zi){
      const names=[];
      for(const k in S.zi.zones){ const z=S.zi.zones[k]; names.push({id:k,name:z.nm}); }
      if(q){
        const hit=names.filter(z=>z.name.indexOf(q)>=0);
        // 검색은 사용자가 직접 친 말이므로 POI도 남기되 뒤로 보낸다
        list=hit.filter(z=>!POI.test(z.name)).concat(hit.filter(z=>POI.test(z.name))).slice(0,40);
        heading=list.length? '검색 결과 '+list.length+'곳' : '';
        empty=!list.length; emptyText='‘'+q+'’와 맞는 동네가 없어요';
      } else {
        const recent=(S.recent||[]);
        if(recent.length){
          heading='최근 본 지역';
          list=recent.map(nm=>names.find(z=>z.name===nm)).filter(Boolean).slice(0,4);
        }
        if(!list.length){
          heading='많이 찾는 지역';
          POP.forEach(p=>{
            const hit=names.filter(z=>z.name.indexOf(p)>=0 && !POI.test(z.name))
              .sort((a,b)=>a.name.length-b.name.length)[0];
            if(hit&&!list.find(x=>x.id===hit.id)) list.push(hit);
          });
          if(list.length<6){
            names.filter(z=>!POI.test(z.name)&&z.name.length<=6).slice(0,8)
              .forEach(z=>{ if(list.length<8&&!list.find(x=>x.id===z.id)) list.push(z); });
          }
          list=list.slice(0,8);
        }
      }
    } else { heading='지역을 불러오는 중이에요'; }

    const rowS='display:flex;align-items:center;gap:12px;padding:13px 20px 13px 14px;border-radius:12px;cursor:pointer;font-size:15.5px;min-height:46px;transition:background .12s';

    // 업종 · 지역 두 칸. 업종은 필수, 지역은 비워두면 서울 전체.
    const open=S.pickOpen||null;
    // 칸 자체가 입력창이다 — 드롭다운 안에 또 검색창을 두지 않는다
    const zq=S.zq||'', iq=S.iq||'';
    const typed=open==='zone'?zq:iq;
    const picked=open==='zone'?(S.homeZoneName||''):(S.homeInd?this.indName(S.homeInd):'');
    const pq=(typed.trim()===picked.trim())?'':typed.trim();
    const hasInd=!!S.homeInd;
    const indsAll=S.zi?S.zi.inds:[];
    // cmdk 점수로 정렬 — '카페'로도 '커피-음료'가 나오고, 오타·약칭도 걸린다
    const sc=this._score;
    const rank=(label,aliases)=>{
      if(!pq) return 1;
      if(sc) return sc(label,pq,aliases||[]);
      return (label+' '+(aliases||[]).join(' ')).indexOf(pq)>=0?1:0;
    };
    const indMatch=n=>rank(this.indName(n),[n])>0;
    const indList=(pq
      ? indsAll.map(n=>({n:n,s:rank(this.indName(n),[n])})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.n)
      : [...POP.filter(n=>indsAll.indexOf(n)>=0),...indsAll.filter(n=>POP.indexOf(n)<0)]).slice(0,60);
    const zoneAll=[];
    if(S.zi) for(const k in S.zi.zones) zoneAll.push({id:k,name:S.zi.zones[k].nm});
    const zoneHits=pq
      ? zoneAll.map(z=>({z:z,s:rank(z.name,[])})).filter(o=>o.s>0).sort((a,b)=>b.s-a.s).map(o=>o.z)
      : [];
    // 최근 본 곳이 인기 동네를 대체하면 목록이 두세 줄로 줄어든다 — 둘을 합친다
    const zoneDefault=(()=>{
      const out=(S.recent||[]).map(nm=>zoneAll.find(z=>z.name===nm)).filter(Boolean).slice(0,3);
      POP_Z.forEach(p=>{
        const h=zoneAll.filter(z=>z.name.indexOf(p)>=0&&!POI.test(z.name)).sort((a,b)=>a.name.length-b.name.length)[0];
        if(h&&!out.find(x=>x.id===h.id)) out.push(h);
      });
      return out.slice(0,10);
    })();
    const zoneList=(pq?zoneHits.filter(z=>!POI.test(z.name)).concat(zoneHits.filter(z=>POI.test(z.name))):zoneDefault).slice(0,40);
    // 대분류는 우리가 나눈 것이다. 통계에는 분류 필드가 없다.
    const CATS=['외식','서비스','도소매','교육','의료','여가'];
    const CATMAP={
      외식:/음식점|커피|호프|치킨|분식|제과|패스트푸드|주점|반찬|일식|중식|양식|한식/,
      서비스:/미용|네일|피부|세탁|부동산|수리|정비|이발|스포츠 강습|사진|여관|숙박|철물|인테리어|가정용/,
      도소매:/판매|편의점|슈퍼|의류|화장품|안경|가방|신발|시계|귀금속|문구|서적|완구|가전|컴퓨터|핸드폰|청과|육류|수산|가구|조명|의약품|의료기기|섬유|자전거|예술품|고인용품|전자상거래/,
      교육:/학원|교습|어학|독서실|스터디/,
      의료:/의원|치과|한의원|병원|약국/,
      여가:/pc방|노래방|당구|골프|스포츠클럽|애완|여가|오락|볼링|헬스/i
    };
    const catOf=n=>{
      for(const c of CATS) if(CATMAP[c].test(n)) return c;
      return '도소매';
    };
    const cat=S.indCat||'외식';
    const catList=pq
      ? indsAll.filter(indMatch).slice(0,40)
      : indsAll.filter(n=>catOf(n)===cat);
    const storeText=n=>{
      const R=S.sti&&S.sti.ind?S.sti.ind[n]:null;
      return R? '서울 '+R.stores.toLocaleString()+'곳' : '집계 없음';
    };
    // 자치구 목록과 선택된 구의 동네 (좌표로 계산한 zone_gu.json)
    const GU_LIST=['종로구','중구','용산구','성동구','광진구','동대문구','중랑구','성북구','강북구','도봉구','노원구','은평구','서대문구','마포구','양천구','강서구','구로구','금천구','영등포구','동작구','관악구','서초구','강남구','송파구','강동구'];
    const guTab=S.guTab||'강남구';
    const guZoneList=(()=>{
      if(!S.zi||!S.zgu) return [];
      const out=[];
      for(const k in S.zi.zones){
        if(S.zgu[k]!==guTab) continue;
        const rows=(S.zi.zones[k].rows||[]).filter(r=>r[1]&&r[2]);
        out.push({id:k, name:S.zi.zones[k].nm, n:rows.reduce((a,r)=>a+r[1],0),
          stores:rows.length? '' : '데이터 없음'});
      }
      return out.sort((a,b)=>b.n-a.n);
    })();
    const fieldBase='flex:1 1 0;min-width:0;display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:'+this.L('14px','16px','16px')+';transition:background .16s;'
      // 라벨 21px + 입력 22px 이 들어간다. 56 이면 위아래 6px 밖에 안 남아 꾸겨 보였다.
      +'padding:0 '+this.L('14px','18px','18px')+';height:'+this.L('58px','64px','64px')+';';
    const valBase='font-size:15px;font-weight:500;letter-spacing:-0.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

    // 인기 검색 — 실제 데이터에서 뽑는다. 그 동네에 그 장사 기록이 있는 조합만.
    const tagSrc=['성수','연남','가로수길'];
    const tags=[];
    if(S.zi){
      tagSrc.forEach(p=>{
        const z=zoneAll.filter(x=>x.name.indexOf(p)>=0&&!POI.test(x.name)).sort((a,b)=>a.name.length-b.name.length)[0];
        if(!z) return;
        const rows=(S.zi.zones[z.id].rows||[]).filter(r=>r[1]&&r[2]);
        if(!rows.length) return;
        const top=rows.sort((a,b)=>b[2]-a[2])[0];
        const raw=S.zi.inds[top[0]];
        const zl=this.zoneLabelOf(z.name);
        tags.push({
          label:zl+' '+this.indName(raw),
          // 두 칸의 입력값(zq·iq)까지 채워야 화면과 상태가 어긋나지 않는다
          pick:()=>this.setState({
            homeZoneName:z.name, zoneId:z.id,sel:z.id, zq:zl,
            homeInd:raw, ind:raw, iq:this.indName(raw),
            pickOpen:null, cursor:0
          }),
          style:'flex:none;font-size:13px;padding:8px 14px;border-radius:999px;background:var(--surface);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;transition:background .16s,color .16s'
        });
      });
    }

    return {
      badgeStyle:'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2);background:var(--surface);border-radius:999px;padding:7px 14px;margin:0 auto 26px;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .7s cubic-bezier(.22,.7,.25,1) .5s forwards'),
      titleStyle:'font-size:'+this.L('23px','44px','52px')+';font-weight:700;letter-spacing:-0.025em;line-height:1.15;margin:0;white-space:nowrap',
      tagRow:'display:flex;align-items:center;gap:8px;margin-top:20px;flex-wrap:wrap;justify-content:center;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .8s cubic-bezier(.22,.7,.25,1) 2.7s forwards'),
      tags:tags,
      // 이메일을 받게 되었으니 소개의 약속 문구도 바꾼다

      // 드롭다운이 잘리지 않도록 세로 클리핑은 하지 않는다(배경 그래픽은 자체 마스크로 처리)
      heroSection:'position:relative;min-height:calc(100vh - '+this.L('56px','60px','64px')+');display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:'+this.L('52px','76px','88px')+' 0 0;overflow:visible',
      // 아무 곳이나 누르면 도입부를 건너뛴다. 재방문·급한 사용자가 기다리지 않게.
      skipAnim:()=>{ if(!S.skip) this.setState({skip:true}); },
      // z-index:2면 스태킹 컨텍스트가 되어 드롭다운이 헤더(50) 아래로 갇힌다
      // 헤더(50)보다 낮아야 한다. 60이면 스크롤할 때 제목이 헤더 위로 지나간다.
      // 드롭다운은 이 안에서만 위로 올라가면 되고(배경 그래픽 위), 헤더까지 넘을 필요는 없다
      // — 검색창이 헤더에서 한참 아래라 열린 목록이 헤더에 닿지 않는다.
      heroInner:'position:relative;z-index:10;width:100%;max-width:'+this.L('100%','620px','740px')+';text-align:center;'
        +(S.skip
          ? 'opacity:1'
          : 'opacity:0;will-change:transform,opacity;animation:heroRise 2.9s cubic-bezier(.22,.72,.24,1) .25s forwards'),
      subStyle:'font-size:17px;font-weight:500;color:var(--ink2);margin:22px 0 0;line-height:1.7;white-space:normal;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .8s cubic-bezier(.22,.7,.25,1) .95s forwards'),
      searchWrap:'position:relative;margin-top:40px;text-align:left;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .85s cubic-bezier(.22,.7,.25,1) 2.5s forwards'),
      skylineRow:'position:absolute;left:0;right:0;bottom:19%;display:flex;align-items:flex-end;justify-content:space-between;gap:'+this.L('10px','14px','18px')+';padding:0 '+this.L('18px','32px','48px'),
      // 가운데를 비우는 마스크 — 모바일에서 그래픽이 글자를 방해하지 않게 한다
      // 위로 갈수록 사라지게 해서 제목·검색창과 겹치지 않는다
      heroWrap:'position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;overflow:hidden;'
        +'-webkit-mask-image:linear-gradient(to bottom,transparent 34%,#000 62%);'
        +'mask-image:linear-gradient(to bottom,transparent 34%,#000 62%);'
        +'transition:transform .9s cubic-bezier(.22,.7,.25,1),opacity .9s;'
        +(S.picking?'opacity:.45;transform:scale(1.1)':''),
      // 테두리 없이 그림자만. 상자 속 상자를 만들지 않는다.
      // 모바일에서는 가로 3분할이 각 칸을 25px로 만든다 — 세로로 쌓아 전폭을 준다
      pickerRow:'display:flex;background:var(--bg);border-radius:20px;padding:6px;transition:box-shadow .22s;'
        +this.L('flex-direction:column;align-items:stretch;gap:4px;','align-items:center;gap:0;','align-items:center;gap:0;')
        +(open
          ? 'box-shadow:0 16px 40px rgba(0,0,0,.12)'
          : 'box-shadow:0 12px 32px rgba(0,0,0,.08)'),
      segInput:'width:100%;min-width:0;font-size:15px;font-weight:500;letter-spacing:-0.015em;color:var(--ink);'
        +'background:transparent;border:none;padding:0;height:22px;outline:none',
      zq:zq, iq:iq,
      onZoneQ:e=>this.setState({zq:e.target.value,pickOpen:'zone',cursor:0}),
      onIndQ:e=>this.setState({iq:e.target.value,pickOpen:'ind',cursor:0}),
      // ↑↓로 항목을 옮기고 Enter로 고른다 (cmdk 방식)
      onZoneKey:e=>{
        const n=zoneList.length;
        if(e.key==='Escape'){ this.setState({pickOpen:null,cursor:0}); e.target.blur(); return; }
        if(e.key==='ArrowDown'){ e.preventDefault(); this.setState({pickOpen:'zone',cursor:Math.min((S.cursor||0)+1,n)}); return; }
        if(e.key==='ArrowUp'){ e.preventDefault(); this.setState({cursor:Math.max((S.cursor||0)-1,0)}); return; }
        if(e.key==='Enter'){
          e.preventDefault();
          const c=S.cursor||0;
          if(c===0){ this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null,cursor:0}); return; }
          const f=zoneList[c-1];
          if(f) this.setState({homeZoneName:f.name,zoneId:f.id,zq:f.name,pickOpen:null,cursor:0});
        }
      },
      onIndKey:e=>{
        const list=catList;
        if(e.key==='Escape'){ this.setState({pickOpen:null,cursor:0}); e.target.blur(); return; }
        if(e.key==='ArrowDown'){ e.preventDefault(); this.setState({pickOpen:'ind',cursor:Math.min((S.cursor||0)+1,Math.max(list.length-1,0))}); return; }
        if(e.key==='ArrowUp'){ e.preventDefault(); this.setState({cursor:Math.max((S.cursor||0)-1,0)}); return; }
        if(e.key==='Enter'){
          e.preventDefault();
          const f=list[S.cursor||0];
          if(f) this.setState({homeInd:f,ind:f,iq:this.indName(f),pickOpen:null,cursor:0});
          return;
        }
        // 빈 칸에서 Backspace면 앞 칸으로
        if(e.key==='Backspace' && !iq){
          e.preventDefault();
          this.setState({pickOpen:'zone'});
          const el=document.querySelectorAll('[data-search] input')[0];
          if(el) el.focus();
        }
      },
      dividerStyle:this.L('flex:none;height:1px;margin:0 16px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)'),
      indBtn:fieldBase+(open==='ind'?'background:rgba(0,0,0,.04)':''),
      zoneBtn:fieldBase+(open==='zone'?'background:rgba(0,0,0,.04)':''),
      // 값이 있을 때만 나오는 지우기. 메인 버튼과 12px 이상 떨어져 있고 클릭이 위로 전파되지 않는다.
      hasZone:!!S.homeZoneName, hasIndVal:hasInd,
      clearStyle:'flex:none;width:32px;height:32px;margin-left:8px;border-radius:50%;background:var(--surface);color:var(--ink3);'
        +'font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s',
      clearZone:e=>{ e.stopPropagation(); this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null}); },
      clearInd:e=>{ e.stopPropagation(); this.setState({homeInd:null,iq:'',pickOpen:null}); },
      zoneHint:S.homeZoneName?'':'· 몰라도 돼요',
      openInd:()=>{ if(open!=='ind') this.setState({pickOpen:'ind'});
        const el=document.querySelectorAll('[data-search] input')[1]; if(el) el.focus(); },
      openZone:()=>{ if(open!=='zone') this.setState({pickOpen:'zone'});
        const el=document.querySelectorAll('[data-search] input')[0]; if(el) el.focus(); },
      pickOpen:!!open, indPanel:open==='ind', zonePanel:open==='zone',
      // 통째로 교체되는 목록은 위치 애니메이션 대신 짧은 페이드로 바꾼다
      indGridStyle:'display:grid;grid-template-columns:'+this.L('1fr','1fr 1fr','1fr 1fr')+';gap:8px;'
        +'animation:fadeIn .14s linear both',
      hotInds:[['커피-음료','☕'],['치킨전문점','🍗'],['편의점','🏪'],['미용실','💇'],['한식음식점','🍚'],['호프-간이주점','🍺']]
        .filter(([n])=>indsAll.indexOf(n)>=0)
        .map(([n,em])=>({label:em+' '+this.indName(n),
          pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null}),
          style:'flex:none;font-size:13.5px;font-weight:500;padding:9px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:38px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
            +(n===S.homeInd?'background:var(--accent);color:#FFFFFF':'background:var(--surface);color:var(--ink2)')})),
      indCats:CATS.map(c=>({label:c,
        pick:()=>this.setState({indCat:c}),
        style:'font-size:13.5px;font-weight:500;padding:11px 12px;border-radius:10px;cursor:pointer;white-space:nowrap;transition:background .14s,color .14s;'
          +(c===cat?'background:var(--line);color:var(--ink);font-weight:600':'color:var(--ink2)')})),
      indCards:catList.map((n,i)=>({name:this.indName(n), stores:'',
        pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null,cursor:0}),
        style:'display:flex;align-items:center;min-width:0;padding:14px 12px;border-radius:12px;cursor:pointer;transition:background .14s;'
          +(n===S.homeInd?'background:var(--accent-3)'
            :(i===(S.cursor||0)&&open==='ind'?'background:var(--line)':'background:var(--surface)'))})),
      indEmpty:catList.length===0,
      indEmptyText: pq? '‘'+pq+'’와 맞는 장사가 없어요' : '이 분류에 해당하는 장사가 없어요',
      pickList: open==='zone'
        ? (()=>{
            const out=[{row:true, name:'서울 전체', meta:'아직 안 정함',
              pick:()=>this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null})}];
            let n=0;
            const push=z=>{ out.push({row:true, name:this.zoneLabelOf(z.name), meta:meta(z.id),
              pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null,cursor:0})}); n++; };
            if(pq){ zoneList.forEach(push); }
            else {
              const rec=zoneList.filter(z=>(S.recent||[]).indexOf(z.name)>=0);
              const hot=zoneList.filter(z=>(S.recent||[]).indexOf(z.name)<0);
              if(rec.length){ out.push({header:true,name:'⏱️ 최근 본 동네'}); rec.forEach(push); }
              if(hot.length){ out.push({header:true,name:'🔥 많이 찾는 동네'}); hot.forEach(push); }
            }
            let ri=-1;
            return out.map(o=>{
              if(o.header) return {isHeader:true,isRow:false,name:o.name,meta:'',style:'',pick:()=>{}};
              ri++;
              return {isHeader:false,isRow:true,name:o.name,meta:o.meta,pick:o.pick,
                style:rowS+(ri===(S.cursor||0)?';background:var(--line)':'')};
            });
          })()
        : indList.map(n=>({isHeader:false,isRow:true,name:this.indName(n), meta:'',
            pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null}),
            style:rowS+(n===S.homeInd?';background:var(--surface);font-weight:600':'')})),
      // 검색 중이면 결과 목록, 아니면 자치구 2단
      zoneSearching: open==='zone' && !!pq,
      zoneBrowsing: open==='zone' && !pq,
      allCardStyle:'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:12px;background:var(--surface);cursor:pointer;transition:background .14s'
        +(S.homeZoneName?'':';box-shadow:inset 0 0 0 1.5px var(--accent)'),
      pickAll:()=>this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null}),
      // 목록 높이를 끌어서 늘릴 수 있다. 최소 150 / 최대 420px로 묶는다.
      // 구 25개를 세로 한 줄로 세우면 옆이 텅 비고 스크롤이 생긴다.
      // ㄱㄴㄷ 순으로 여러 열에 깔면 25개가 한 화면에 다 들어와 스크롤이 없어진다.
      guGridStyle:'flex:none;display:grid;gap:4px;margin-top:14px;padding-top:14px;'
        +'border-top:1px solid var(--line);'
        +'grid-template-columns:repeat('+this.L(3,4,5)+',minmax(0,1fr))',
      // 상권 목록도 같은 이유로 폭을 채운다. 끌어서 높이를 조절하는 건 그대로.
      colsStyle:'flex:none;height:'+(S.colsH||190)+'px;overflow-y:auto;margin-top:12px;padding-right:6px',
      zoneGridStyle:'display:grid;gap:4px;'
        +'grid-template-columns:repeat(auto-fill,minmax('+this.L(140,180,200)+'px,1fr))',
      onResize:e=>{
        const startY=(e.touches?e.touches[0].clientY:e.clientY);
        const startH=S.colsH||190;
        const move=ev=>{
          const y=(ev.touches?ev.touches[0].clientY:ev.clientY);
          const h=Math.min(Math.max(startH+(y-startY),150),420);
          this.setState({colsH:h});
        };
        const up=()=>{
          window.removeEventListener('mousemove',move);
          window.removeEventListener('mouseup',up);
          window.removeEventListener('touchmove',move);
          window.removeEventListener('touchend',up);
          window.removeEventListener('touchcancel',up);
        };
        this._dragCleanup?.();this._dragCleanup=up;
        window.addEventListener('touchcancel',up);
        window.addEventListener('mousemove',move);
        window.addEventListener('mouseup',up);
        window.addEventListener('touchmove',move,{passive:false});
        window.addEventListener('touchend',up);
      },
      hasRecent:(S.recent||[]).length>0,
      recentChips:(S.recent||[]).map(nm=>zoneAll.find(z=>z.name===nm)).filter(Boolean).slice(0,4).map(z=>({
        name:this.zoneLabelOf(z.name), meta:guOf(z.id),
        pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null}),
        style:'flex:none;display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;background:var(--surface);cursor:pointer;white-space:nowrap;min-height:38px;transition:background .14s,color .14s'
      })),
      // ㄱㄴㄷ 순 — 행정 순서(종로구부터)는 사장님이 아는 순서가 아니라 찾기 어렵다
      guTabs:GU_LIST.slice().sort((a,b)=>a.localeCompare(b,'ko')).map(g=>({
        label:g, pick:()=>this.setState({guTab:g}),
        style:'font-size:13.5px;font-weight:500;padding:10px 6px;border-radius:9px;cursor:pointer;'
          +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;'
          +'transition:background .14s,color .14s;'
          +(g===guTab?'background:var(--line);color:var(--ink);font-weight:600':'color:var(--ink2)')
      })),
      guZones:guZoneList.map(z=>({
        name:this.zoneLabelOf(z.name), meta:z.stores,
        pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(z.id===S.zoneId?'background:var(--accent-3)':'')
      })),
      pickEmpty: !!pq && (open==='zone'? zoneList.length===0 : indList.length===0),
      pickEmptyText:'‘'+pq+'’와 맞는 '+(open==='zone'?'동네가':'장사가')+' 없어요',
      startDisabled:!!S.starting,
      starting:!!S.starting, notStarting:!S.starting,
      startStyle:this.L('flex:none;width:100%;margin-top:4px;','flex:none;','flex:none;')
        +'font-size:15px;font-weight:600;border:none;border-radius:14px;height:'+this.L('46px','48px','48px')+';'
        +this.L('','min-width:106px;','min-width:116px;')+'padding:0 '+this.L('18px','22px','26px')+';white-space:nowrap;'
        +'display:inline-flex;align-items:center;justify-content:center;'
        +'transition:transform .2s cubic-bezier(.2,0,0,1),background .18s,box-shadow .2s,filter .18s;'
        // 비활성이어도 브랜드 컬러 글자와 옅은 배경을 남겨 누를 수 있는 요소로 읽히게 한다
        +(hasInd
          ? 'cursor:'+(S.starting?'default':'pointer')+';background:var(--accent);color:#FFFFFF;box-shadow:0 6px 16px -6px rgba(0,0,0,.2)'
          : 'cursor:pointer;background:var(--accent-3);color:var(--accent)'),
      startActive:S.starting?'':'transform:scale(.96)',
      startHover:S.starting?'':(hasInd?'filter:brightness(1.05)':'filter:brightness(.97)'),
      start:()=>{
        if(S.starting) return;
        if(!hasInd){ this.setState({pickOpen:'ind'});
          const el=document.querySelectorAll('[data-search] input')[1]; if(el) el.focus(); return; }
        this.setState({starting:true,pickOpen:null});
        if(S.zoneId){ this.startZone(); return; }
        this.setState({screen:'find',sel:null,fromRegion:false,homeZone:null,starting:false});
      },
      // 흰 필드 + 아주 얕은 그림자. 회색 덩어리보다 가볍고 정확해 보인다.
      picking:!!S.picking,
      pickingText:S.picking? S.picking+' 상권을 분석하고 있어요' : ''
    };
  },

  // 지역까지 고른 경우 — 짧은 전환 뒤 그 지역 화면으로
  startZone(){
    const S=this.state, name=S.homeZoneName;
    const prev=(S.recent||[]).filter(n=>n!==name);
    const recent=[name,...prev].slice(0,4);
    try{ localStorage.setItem('mysbizon.recentZones',JSON.stringify(recent)); }catch(e){}
    this.setState({picking:name,pickOpen:null,recent:recent});
    this.setState({screen:'region',picking:null,starting:false,homeZone:name,regPick:S.homeInd||null});
  },

  // 순수 SVG 꺾은선 — 차트 라이브러리를 쓰지 않는다
  zoneCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    if(!zi||!zgu) return {rows:[], cards:[], ind:'', lead:'', note:'', maxPer:1};
    const idx=zi.inds.indexOf(S.ind);
    if(idx<0) return {rows:[], cards:[], ind:this.indName(S.ind), lead:'', note:'', maxPer:1};
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
    const list=Object.values(agg).map(a=>({...a,per:a.sales/a.stores,
      pop:pop[a.gu]?pop[a.gu].sum:null}));
    if(!list.length) return {rows:[], cards:[], ind:this.indName(S.ind), lead:'', note:'', maxPer:1};
    const maxPer=Math.max(...list.map(o=>o.per));
    list.sort((a,b)=>b.per-a.per);
    const top=list[0];
    // 중앙값들 — 막대와 회색 글자가 '무엇에 견준 값인지' 말할 수 있게 미리 구한다
    const med=arr=>{ const v=arr.filter(x=>x!=null).sort((a,b)=>a-b);
      return v.length? v[Math.floor(v.length/2)] : null; };
    const perMed=med(list.map(x=>x.per));
    const storeMed=med(list.map(x=>x.stores));
    const satOf=o=>o.pop? o.stores/(o.pop/10000) : null;
    const satMed=med(list.map(satOf));
    // 막대는 최고값 대비 길이다. 그것만 두면 1등은 늘 꽉 차서 '길다'가 무슨 뜻인지 알 수 없다.
    // 서울 중앙값 자리에 눈금을 하나 세워, 막대가 그 선을 넘었는지로 읽히게 한다.
    const medPct=Math.min(perMed/maxPer*100,100);
    return {
      ind:this.indName(S.ind),
      lead:this.indName(S.ind)+this.josa(this.indName(S.ind),'eun')+' '+top.gu+'가 가게 한 곳당 가장 많이 팔아요.',
      medLine:'position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;'
        +'background:var(--ink3);opacity:.55;left:'+medPct.toFixed(1)+'%',
      medNote:'가운데 눈금이 서울 자치구 중앙값이에요',
      // 데스크톱은 그리드로 폭을 채우고, 좁은 화면에서만 옆으로 넘긴다
      cardsWrap:this.L(
        'display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin-top:12px;padding:2px 2px 8px',
        'display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;margin-top:12px;padding:2px 2px 8px',
        'display:grid;gap:18px;margin-top:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))'),
      // 자치구 카드 — 옆으로 넘기며 본다
      cards:list.map((o,i)=>{
        const perM=o.per/3;
        const sat=satOf(o);
        const diff=Math.round((o.per-perMed)/perMed*100);
        const dStore=storeMed!=null? o.stores-storeMed : null;
        // 회색 글자는 '출처'가 아니라 '서울과 견주면 어떤가'를 말한다.
        const facts=[
          {label:'경쟁 점포', value:o.stores.toLocaleString()+'곳',
           tag: dStore==null? '' : (Math.abs(dStore)<1? '서울 자치구 중앙값과 비슷'
                : '서울 중앙값보다 '+Math.abs(dStore).toLocaleString()+'곳 '+(dStore>0?'많아요':'적어요'))},
          {label:'분석 가능한 상권', value:o.zones+'곳', tag:''},
          {label:'상권 소비 규모', value:this.fmt(o.sales)+'원', tag:'최근 3개월'}
        ];
        // '사람 1만 명당 몇 개'는 그 자체로는 판단이 안 되는 숫자였다.
        // 여유/보통/과밀로 결론을 앞에 두고, 근거가 된 값은 회색으로 뒤에 남긴다.
        if(sat!=null && satMed!=null){
          facts.push({label:'경쟁 강도',
            value: sat<=satMed*0.7? '여유' : (sat<=satMed*1.3? '보통' : '과밀'),
            tag:'사람 1만 명당 '+sat.toFixed(1)+'곳'});
        }
        return {
          style:'min-width:0;padding:20px;border-radius:var(--r-lg);'
            +this.L('flex:0 0 86%;scroll-snap-align:start;','flex:0 0 300px;scroll-snap-align:start;','')
            +(i===0?'background:var(--accent-3);border:1px solid var(--accent-2)'
                   :'background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card)'),
          rank:String(i+1).padStart(2,'0'), gu:o.gu,
          per:this.fmt(perM)+'원',
          verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요' : (diff<=-10? '중앙값보다 '+Math.abs(diff)+'% 낮아요' : '중앙값과 비슷해요')),
          facts:facts,
          bar:'display:block;width:'+Math.max(o.per/maxPer*100,3).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.45+0.55*(o.per/maxPer)).toFixed(2)
        };
      }),
      rows:list.map((o,i)=>({
        rank:i+1, gu:o.gu,
        per:this.fmt(o.per/3)+'원',
        stores:o.stores.toLocaleString()+'개',
        zones:o.zones+'곳',
        bar:'display:block;width:'+Math.max(o.per/maxPer*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*(o.per/maxPer)).toFixed(2),
        row:'display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line)'
      })),
      note:'막대는 가게 한 곳이 한 달에 파는 돈이에요. 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적은 아니에요. 자료가 있는 상권만 합산했습니다.'
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
        lead:this.indName(S.regPick)+this.josa(this.indName(S.regPick),'eun')+' 이 동네에서 손님이 쓴 돈의 '+share.toFixed(1)+'%를 차지해요.',
        facts:[
          {label:'가게 한 곳이 한 달에 파는 돈', value:this.fmt(per/3)+'원', tag:'(추정)'},
          {label:'가게 수', value:stores.toLocaleString()+'곳', tag:''},
          {label:'손님이 쓴 돈 (3개월)', value:this.fmt(sales)+'원', tag:''},
          {label:'결제 1건당 추정 금액', value:unit? unit.toLocaleString()+'원':'데이터 없음', tag:unit?'실제 집계':'정부 자료에 없어 점수에 넣지 않았습니다'}
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
      name:z.nm,
      sub:'이 동네에서 확인된 장사가 '+rows.length+'가지예요. 하나를 고르면 본전까지 계산해 드려요.',
      stats:[
        {label:'가게', value:totalStores.toLocaleString()+'곳', tag:''},
        {label:'손님이 쓴 돈 (3개월)', value:this.fmt(totalSales)+'원', tag:''},
        {label:'확인된 장사', value:rows.length+'가지', tag:''}
      ],
      inds:rows.sort((a,b)=>b[2]-a[2]).map(r=>{
        const name=zi.inds[r[0]], per=r[2]/r[1];
        return {
          name:this.indName(name), stores:r[1].toLocaleString()+'곳', per:this.fmt(per/3)+'원',
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
    if(!zi||!zgu) return {gu:gu, guOptions:GU, onGu:()=>{}, ind:'', rows:[], lead:'', note:''};
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
    const shown=showAll? list : list.slice(0,12);
    return {
      gu:gu, ind:this.indName(S.ind),
      guOptions:GU,
      onGu:e=>this.setState({fcGu:e.target.value, fcAll:false}),
      lead: list.length
        ? gu+'에서 '+this.indName(S.ind)+this.josa(this.indName(S.ind),'ga')+' 가장 잘 되는 곳은 '+top3[0].name+this.josa(top3[0].name,'ieyo')
        : gu+'에는 '+this.indName(S.ind)+' 자료가 있는 상권이 없어요.',
      sub: list.length
        ? gu+' 안에서 자료가 있는 상권 '+list.length+'곳을 가게 한 곳당 매출로 줄 세웠어요.'
        : '다른 자치구를 골라 보세요.',
      hasList:list.length>0,
      // 상위 셋은 카드로 — 눈이 먼저 닿는 곳에 결론을 둔다
      top:top3.map((o,i)=>({
        rank:String(i+1),
        name:o.name, gu:o.gu||'',
        per:this.fmt(o.per/3)+'원',
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
          +(i===0?'background:var(--accent-3);border:1px solid var(--accent-2)'
                 :'background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card)')
      })),
      // 나머지는 접어 둔다 — 71줄을 한 번에 던지지 않는다
      moreLabel: showAll? '접기' : ('나머지 '+Math.max(list.length-12,0)+'곳 더 보기'),
      hasMore: list.length>12,
      toggleMore:()=>this.setState({fcAll:!showAll}),
      // 자치구 중앙값 — 화면 위에 기준선으로 적는다
      medLabel:list.length? this.fmt(medPer/3)+'원' : '',
      hasMed:list.length>0,
      rows:shown.map((o,i)=>{
        // 가게가 2곳 이하면 '가게 한 곳당'이 사실상 그 한 가게의 실적이다.
        // 숫자를 지우지는 않고(값은 진짜다) 믿을 만한 정도를 함께 적는다.
        const thin=o.stores<=2;
        return {
        rank:i+1, name:o.name+(o.gu&&o.gu.indexOf('경계')>=0?' · '+o.gu:''),
        per:this.fmt(o.per/3)+'원',
        // 가게 수는 두 가지를 한 번에 말해준다 — 이 숫자를 믿어도 되는지, 경쟁이 얼마나 센지
        storeTag:o.stores.toLocaleString()+'곳'+(thin?' · 표본 적음':''),
        storeStyle:'flex:none;font-size:11.5px;white-space:nowrap;font-variant-numeric:tabular-nums;'
          +(thin?'color:var(--warn)':'color:var(--ink3)'),
        vsMed:medPer? (o.per>=medPer? '중앙값 이상':'중앙값 미만') : '',
        vsStyle:'flex:none;font-size:11.5px;white-space:nowrap;'
          +(medPer&&o.per>=medPer?'color:var(--good)':'color:var(--ink3)'),
        sales:this.fmt(o.sales)+'원',
        stores:o.stores.toLocaleString()+'개',
        unit:o.unit? o.unit.toLocaleString()+'원':'데이터 없음',
        bar:'display:block;width:'+Math.max((o[key]||0)/maxV*100,2).toFixed(1)+'%;height:100%;border-radius:3px;background:var(--accent);opacity:'+(0.35+0.65*((o[key]||0)/maxV)).toFixed(2),
        pick:()=>this.setState({sel:o.id,screen:'diag'}),
        row:'display:flex;align-items:center;gap:12px;padding:13px 0;border-top:1px solid var(--line);cursor:pointer'
      };}),
      note:'금액은 가게 한 곳이 한 달에 파는 돈이에요. 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적은 아니에요. 자치구는 상권 좌표로 붙였고, 경계에서 250m 안쪽인 곳은 두 구를 함께 적었어요 — 강남역처럼 강남대로를 경계로 서쪽이 서초구인 곳이 그래요.'
    };
  },

  // 지역비교 — 자치구 25개를 고른 장사 기준으로 묶어 비교한다
  priceView(catArg){
    const S=this.state;
    // 차트 하나를 그린다. catArg 를 주면 그 차트를, 안 주면 고른 차트를 그린다.
    // 여섯 개를 한 화면에 같이 보여주려고 이 함수를 여섯 번 부른다.
    const cat=catArg||S.prCat||'rent';
    const meta=PRICE_CATS.find(c=>c.k===cat)||PRICE_CATS[0];
    // 켜 둔 차트들. 처음에는 임대료 하나만 켜 둔다.
    const ON=(Array.isArray(S.prOn)&&S.prOn.length)? S.prOn : ['rent'];
    const W=640,H=200,PAD=16;
    const out={
      k:cat, catLabel:meta.label, when:meta.when, on:ON.indexOf(cat)>=0,
      // 켜고 끄는 버튼이다 — 여러 개를 같이 켜 놓고 볼 수 있다.
      // 다 끄면 볼 게 없어지니 마지막 하나는 안 꺼진다.
      pick:()=>{ const has=ON.indexOf(cat)>=0;
        const next=has? ON.filter(x=>x!==cat) : [...ON, cat];
        this.setState({prOn: next.length? next : ON, prCat:cat, prPick:has?S.prPick:null}); },
      // 세로 메뉴 한 줄. 켜 둔 항목은 민트로 표시한다.
      chipStyle:'display:block;padding:12px 14px;border-radius:var(--r-sm);'
        +'font-size:14.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
        +'transition:background .14s,color .14s;'
        +(ON.indexOf(cat)>=0
          ? 'background:var(--accent-3);color:var(--accent);font-weight:700'
          : 'color:var(--ink2)'),
      cardStyle:'display:flex;flex-direction:column;padding:22px 20px;border-radius:18px;'
        +'background:var(--bg);box-shadow:0 0 0 1px var(--line)',
      whenStyle:'flex:none;align-self:flex-start;font-size:10.5px;font-weight:600;letter-spacing:.02em;'
        +'padding:3px 8px;border-radius:999px;white-space:nowrap;'
        +'background:var(--accent-3);color:var(--accent)',
      title:'', unit:'', now:'', nowLabel:'', delta:'', deltaStyle:'display:none',
      labels:[], line:{d:'',area:'',pts:[]}, list:[], listTitle:'', note:'', w:W, h:H,
      missing:'', hasChart:false, pairs:null, dots:null, legend:null, bars:null};

    const R=S.rentStats, HI=S.salesHistory;
    if(cat==='rent'||cat==='vacancy'){
      if(!R||!Array.isArray(R.quarters)||!R.quarters.length||!R.zones) { out.note='임대료 자료가 없거나 아직 불러오지 못했어요.'; return out; }
      const zones=Object.values(R.zones||{});
      const pickNm=S.prPick|| (zones[0]&&zones[0].nm);
      const z=zones.find(o=>o.nm===pickNm)||zones[0];
      const isRent=cat==='rent';
      const rawTrend=z? (isRent? z.rent_trend : z.vacancy_trend) : [];
      const trend=Array.isArray(rawTrend)?rawTrend:[];
      if(!trend.length||!trend.every(Number.isFinite)){out.note='이 지역의 추이를 표시할 자료가 부족해요.';return out;}
      const cur=trend[trend.length-1], prev=trend[0];
      const d=cur-prev;
      out.title=(z?z.nm:'')+' · '+(isRent?'㎡당 월 임대료':'빈 상가 비율');
      out.now=isRent? (cur||0).toFixed(1)+'만원' : (cur||0).toFixed(1)+'%';
      out.nowLabel=R.quarters[R.quarters.length-1]+' 기준';
      out.delta=(d>0?'▲ ':(d<0?'▼ ':''))+Math.abs(d).toFixed(1)+(isRent?'만원':'%p')+' · 2년 전 대비';
      out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(d>0?'var(--warn)':(d<0?'var(--good)':'var(--ink3)'));
      out.labels=[R.quarters[0], R.quarters[R.quarters.length-1]];
      out.line=this.linePath(trend,W,H,PAD);
      out.hasChart=trend.length>1;
      out.listTitle='상권 '+zones.length+'곳';
      out.list=zones.slice().sort((a,b)=>(isRent?b.rent-a.rent:b.vacancy-a.vacancy)).map(o=>({
        name:o.nm, meta:o.gwon,
        value:isRent? o.rent.toFixed(1)+'만원' : o.vacancy.toFixed(1)+'%',
        pick:()=>this.setState({prPick:o.nm}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(o.nm===(z&&z.nm)?'background:var(--accent-3)':'')
      }));
      out.note='한국부동산원 상업용부동산 임대동향조사(중대형 상가). '+R.unit+'. 이 조사의 상권 구획은 서울시 상권분석의 동네 1,564곳과 다른 지리라 동네별 임대료로 쓸 수 없어요. 권역 수준의 참고값이에요.';
      return out;
    }

    if(cat==='sales'){
      if(!HI){ out.note='매출 추이 자료를 불러오는 중입니다.'; return out; }
      const inds=Object.keys(HI.ind);
      const pick=S.prPick|| (inds.indexOf(S.ind)>=0? S.ind : inds[0]);
      const series=HI.ind[pick]||{};
      const qs=HI.quarters.filter(q=>series[q]!=null);
      const vals=qs.map(q=>series[q]);
      const cur=vals[vals.length-1], prev=vals[vals.length-5];
      const pct=prev? (cur-prev)/prev*100 : 0;
      out.title=this.indName(pick)+' · 서울 전체 분기 매출';
      out.now=this.fmt(cur)+'원';
      out.nowLabel=this.qtr(qs[qs.length-1])+' 기준';
      out.delta=(pct>0?'▲ ':'▼ ')+Math.abs(pct).toFixed(1)+'% · 1년 전 대비';
      out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(pct>=0?'var(--good)':'var(--warn)');
      out.labels=[this.qtr(qs[0]), this.qtr(qs[qs.length-1])];
      out.line=this.linePath(vals,W,H,PAD);
      out.hasChart=vals.length>1;
      out.listTitle='장사 '+inds.length+'가지';
      out.list=inds.map(n=>({
        name:this.indName(n), meta:'',
        value:this.fmt(series[qs[qs.length-1]]||HI.ind[n][HI.quarters[HI.quarters.length-1]])+'원',
        pick:()=>this.setState({prPick:n}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
          +(n===pick?'background:var(--accent-3)':'')
      }));
      out.note='서울시 상권분석서비스 추정매출을 분기별로 합산한 값이에요. 서울 전체 합계이고 동네별 값이 아니에요.';
      return out;
    }

    // 문 열고 닫는 수 — 개업/폐업을 한 줄에 두 색으로
    if(cat==='churn'||cat==='fr'){
      const ST=S.sti&&S.sti.ind;
      if(!ST){ out.note='개·폐업 자료를 불러오는 중입니다.'; return out; }
      const rows=Object.keys(ST).map(n=>({raw:n,name:this.indName(n),...ST[n]}))
        .filter(o=>o.stores);
      if(cat==='churn'){
        rows.sort((a,b)=>(b.closed-b.opened)-(a.closed-a.opened));
        const mx=Math.max(...rows.map(o=>Math.max(o.opened,o.closed)),1);
        const pick=S.prPick||rows[0].raw;
        const z=rows.find(o=>o.raw===pick)||rows[0];
        out.title=z.name+' · 3개월 동안';
        out.now=(z.closed-z.opened>0?'+':'')+(z.closed-z.opened).toLocaleString()+'곳';
        out.nowLabel='문 닫은 곳에서 새로 연 곳을 뺀 수';
        out.delta=z.closed>z.opened?'줄고 있어요':'늘고 있어요';
        out.deltaStyle='font-size:13px;font-weight:600;white-space:nowrap;color:'+(z.closed>z.opened?'var(--warn)':'var(--good)');
        out.pairs=rows.slice(0,14).map(o=>({
          label:o.name,
          openBar:'display:block;width:'+(o.opened/mx*100).toFixed(1)+'%;height:100%;background:var(--accent);opacity:.45;border-radius:3px',
          closeBar:'display:block;width:'+(o.closed/mx*100).toFixed(1)+'%;height:100%;background:var(--warn);opacity:.75;border-radius:3px',
          open:o.opened.toLocaleString(), close:o.closed.toLocaleString(),
          pick:()=>this.setState({prPick:o.raw}),
          style:'display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-radius:11px;cursor:pointer;transition:background .14s;'
            +(o.raw===z.raw?'background:var(--accent-3)':'')
        }));
        out.legend=[{label:'새로 연 곳',color:'var(--accent)',op:'.45'},{label:'문 닫은 곳',color:'var(--warn)',op:'.75'}];
        out.list=[]; out.listTitle='';
        out.note='서울 전체 3개월 기준이에요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 데이터가 구분하지 않아요.';
        return out;
      }
      // 프랜차이즈 산점도 — x 총 가게, y 프랜차이즈 수, 점 크기 비중
      rows.sort((a,b)=>b.fr_share-a.fr_share);
      const mxS=Math.max(...rows.map(o=>o.stores),1);
      const mxF=Math.max(...rows.map(o=>o.stores*o.fr_share/100),1);
      const top=rows[0];
      out.title='장사별 프랜차이즈 비중';
      out.now=top.name+' '+top.fr_share+'%';
      out.nowLabel='프랜차이즈 비중이 가장 높은 장사';
      out.dots=rows.map(o=>{
        const fr=o.stores*o.fr_share/100;
        return {
          cx:(8+o.stores/mxS*84).toFixed(1),
          cy:(92-fr/mxF*84).toFixed(1),
          r:(1.6+o.fr_share/100*4.2).toFixed(2),
          op:(0.28+0.5*o.fr_share/100).toFixed(2),
          name:o.name
        };
      });
      out.list=rows.slice(0,20).map(o=>({
        name:o.name, meta:o.stores.toLocaleString()+'곳',
        value:o.fr_share+'%',
        pick:()=>{}, style:'display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:11px;font-size:15px'
      }));
      out.listTitle='비중 높은 순';
      out.note='점 하나가 장사 한 가지예요. 오른쪽으로 갈수록 가게가 많고, 위로 갈수록 프랜차이즈가 많고, 점이 클수록 그 비중이 높아요. 프랜차이즈가 많은 자리는 개인 가게가 버티기 어려울 수 있어요.';
      return out;
    }

    // 소비 구성
    const IC=S.income;
    if(!IC){ out.note='소비 자료를 불러오는 중입니다.'; return out; }
    const gus=Object.keys(IC.gu||{});
    const pick=S.prPick|| gus[0];
    const spend=((IC.gu[pick]||{}).spend)||[];
    const mx=Math.max(...spend.map(o=>o.pct),1);
    out.title=pick+' · 가구가 돈을 쓰는 곳';
    out.now=spend.length? spend.slice().sort((a,b)=>b.pct-a.pct)[0].name : '—';
    out.nowLabel='가장 많이 쓰는 항목';
    out.hasChart=false;
    out.bars=spend.slice().sort((a,b)=>b.pct-a.pct).map(o=>({
      label:o.name, pct:o.pct.toFixed(1)+'%',
      bar:'display:block;width:'+(o.pct/mx*100).toFixed(1)+'%;height:100%;background:var(--accent);opacity:'+(0.35+0.65*(o.pct/mx)).toFixed(2)+';border-radius:3px'
    }));
    out.listTitle='자치구 '+gus.length+'곳';
    out.list=gus.map(g=>({
      name:g, meta:'', value:'',
      pick:()=>this.setState({prPick:g}),
      style:'display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:11px;cursor:pointer;font-size:15px;transition:background .14s;'
        +(g===pick?'background:var(--accent-3)':'')
    }));
    out.note=IC.income_note||'서울 열린데이터광장 가구 소비 자료예요.';
    return out;
  }
};
