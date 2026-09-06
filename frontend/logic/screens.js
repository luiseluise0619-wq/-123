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
    // 시·도 — ready 는 '이 서비스가 그 지역 상권 자료를 실제로 갖고 있는가'다.
    // 지금은 서울뿐이라 나머지는 눌러도 '아직 없어요'로 안내한다.
    const SIDO_ALL=[
      {v:'서울특별시',label:'서울',ready:true},{v:'부산광역시',label:'부산'},
      {v:'대구광역시',label:'대구'},{v:'인천광역시',label:'인천'},
      {v:'광주광역시',label:'광주'},{v:'대전광역시',label:'대전'},
      {v:'울산광역시',label:'울산'},{v:'세종특별자치시',label:'세종'},
      {v:'경기도',label:'경기'},{v:'강원특별자치도',label:'강원'},
      {v:'충청북도',label:'충북'},{v:'충청남도',label:'충남'},
      {v:'전북특별자치도',label:'전북'},{v:'전라남도',label:'전남'},
      {v:'경상북도',label:'경북'},{v:'경상남도',label:'경남'},
      {v:'제주특별자치도',label:'제주'}
    ];
    const homeSido=S.sido||'서울특별시';
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
          // 두 칸의 입력값(zq·iq)까지 채워야 화면과 상태가 어긋나지 않는다.
          // 인기 검색은 '누르면 바로 결과'다 — 채워 놓고 버튼을 또 누르게 하지 않는다.
          pick:()=>{
            this.setState({
              homeZoneName:z.name, zoneId:z.id,sel:z.id, zq:zl,
              homeInd:raw, ind:raw, iq:this.indName(raw),
              pickOpen:null, cursor:0
            });
            this.startZone();
          },
          style:'flex:none;font-size:13px;padding:8px 14px;border-radius:999px;background:var(--surface);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;transition:background .16s,color .16s'
        });
      });
    }

    return {
      badgeStyle:'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2);background:var(--surface);border-radius:999px;padding:7px 14px;margin:0 auto 26px;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .7s cubic-bezier(.22,.7,.25,1) .5s forwards'),
      heroEyebrow:this.t('home.eyebrow'),
      heroTitle:this.t('home.title'),
      heroSub:this.t('home.sub'),
      labLocation:this.t('home.location'),
      phLocationAny:this.t('home.locationAny'),
      labIndustry:this.t('home.industry'),
      phIndustry:this.t('home.industryHint'),
      labStart:this.t('home.start'),
      labPopular:this.t('home.popular'),
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

      // ── 시·도 ──────────────────────────────────────────────────
      // 자료가 있는 곳은 서울뿐이다(서울시 상권분석서비스 1,564곳).
      // 그렇다고 다른 시·도를 숨기면 '이 서비스는 서울만 되는구나'를 알 수 없다.
      // 그래서 전부 보여 주되, 누르면 '아직 없어요'라고 정직하게 말한다.
      sidoRow:'flex:none;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;'
        +'padding:0 0 12px;margin-bottom:12px;border-bottom:1px solid var(--line)',
      sidoChips:SIDO_ALL.map(o=>({
        label:o.label,
        pick:()=>this.setState({sido:o.v}),
        style:'flex:none;padding:8px 13px;border-radius:999px;font-size:13px;cursor:pointer;'
          +'white-space:nowrap;transition:background .14s,color .14s;'
          +(o.v===homeSido
            ? 'background:var(--accent);color:#FFFFFF;font-weight:600'
            : 'background:var(--surface);color:var(--ink2)'+(o.ready?'':';opacity:.6'))
      })),
      sidoReadyHome: homeSido==='서울특별시',
      sidoWaiting:   homeSido!=='서울특별시',
      sidoWaitText:this.t('sido.wait',{region:homeSido}),
      backToSeoulHome:()=>this.setState({sido:'서울특별시'}),
      // 패널은 높이가 묶여 있다(화면 밖으로 나가지 않게). 안쪽이 넘치면 여기서 스크롤된다
      // — 예전에는 패널이 overflow:hidden 이라 구 25개 중 첫 줄만 보이고 잘려 있었다.
      panelBodyStyle:'flex:1 1 auto;min-height:0;overflow-y:auto;padding-right:4px',
      allCardStyle:'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:12px;background:var(--surface);cursor:pointer;transition:background .14s'
        +(S.homeZoneName?'':';box-shadow:inset 0 0 0 1.5px var(--accent)'),
      pickAll:()=>this.setState({homeZoneName:null,zoneId:null,sel:null,zq:'',pickOpen:null}),
      // 구 25개를 세로 한 줄로 세우면 옆이 텅 빈다. ㄱㄴㄷ 순으로 여러 열에 깐다.
      guGridStyle:'display:grid;gap:4px;margin-top:14px;padding-top:14px;'
        +'border-top:1px solid var(--line);'
        +'grid-template-columns:repeat('+this.L(3,4,5)+',minmax(0,1fr))',
      // 스크롤은 패널 본문(panelBodyStyle) 한 곳에서만 한다.
      // 여기서 또 스크롤하면 상자 안 상자가 되어 어느 쪽이 움직이는지 알 수 없다.
      colsStyle:'margin-top:12px',
      zoneGridStyle:'display:grid;gap:4px;'
        +'grid-template-columns:repeat(auto-fill,minmax('+this.L(140,180,200)+'px,1fr))',
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

  // ── 지역비교 ───────────────────────────────────────────────────
  // 25개 구를 세로로 다 펼치지 않는다. 가로로 넘겨 보고, 고른 구가 아래 차트에 반영된다.
  zoneCompare(){
    const S=this.state, zi=S.zi, zgu=S.zgu;
    const empty={rows:[], cards:[], ind:'', lead:'', sub:'', note:this.dataNote('zc','',[]), maxPer:1,
      charts:[], hasCharts:false, rail:this.rail('zc',{per:4}), chartRail:this.rail('zcc',{per:1}),
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
        gu:o.gu, rank:String(i+1).padStart(2,'0'),
        per:this.won(perM),
        verdict:(diff>=10? '서울 중앙값보다 '+diff+'% 높아요'
               : (diff<=-10? '중앙값보다 '+Math.abs(diff)+'% 낮아요' : '중앙값과 비슷해요')),
        facts:facts,
        pick:()=>this.setState({zcGu:o.gu}),
        bar:'display:block;width:'+Math.max(o.per/maxPer*100,3).toFixed(1)+'%;height:100%;border-radius:3px;'
          +'background:var(--accent);opacity:'+(0.45+0.55*(o.per/maxPer)).toFixed(2),
        style:'min-width:0;padding:20px;border-radius:var(--r-lg);cursor:pointer;'
          +'transition:box-shadow .16s,transform .16s;'
          +(on?'background:var(--accent-3);border:1px solid var(--accent-2)'
              :'background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card)')
      };
    };

    // ── 차트 — 같은 숫자를 모양만 바꿔 반복하지 않는다. 넷은 서로 다른 질문이다. ──
    const C=[];
    const push=(id,opt)=>{ const c=this.chartCard(id,opt); if(c) C.push(c); };
    const q=this.qtr(zi.quarter);
    const byPer=list.slice(0,12);
    push('zc-per',{type:'hbar', title:'자치구별 예상 매출', sub:'가게 한 곳당 월매출 (추정) · 상위 12곳',
      unit:'원', period:q+' 기준', height:300,
      labels:byPer.map(o=>o.gu),
      datasets:[{label:'가게 한 곳당 월매출', data:byPer.map(o=>Math.round(o.per/3)),
        colors:byPer.map(o=>o.gu===picked?'on':'')}]});
    const byStore=list.slice().sort((a,b)=>b.stores-a.stores).slice(0,12);
    push('zc-store',{type:'hbar', title:'자치구별 경쟁 점포 수', sub:'같은 업종 점포가 많은 12곳',
      unit:'곳', period:q+' 기준', height:300,
      labels:byStore.map(o=>o.gu),
      datasets:[{label:'같은 업종 점포 수', data:byStore.map(o=>o.stores),
        colors:byStore.map(o=>o.gu===picked?'on':'')}]});
    const byPop=list.filter(o=>o.pop).sort((a,b)=>b.pop-a.pop).slice(0,12);
    push('zc-pop',{type:'hbar', title:'자치구별 유동인구', sub:'상권이 속한 행정동 하루 유동인구 합계',
      unit:'명', period:q+' 기준', height:300,
      labels:byPop.map(o=>o.gu),
      datasets:[{label:'하루 유동인구', data:byPop.map(o=>Math.round(o.pop)),
        colors:byPop.map(o=>o.gu===picked?'on':'')}]});
    const bySales=list.slice().sort((a,b)=>b.sales-a.sales).slice(0,12);
    push('zc-sales',{type:'hbar', title:'자치구별 소비 규모', sub:'최근 3개월 상권 소비 합계',
      unit:'원', period:q+' 기준', height:300,
      labels:bySales.map(o=>o.gu),
      datasets:[{label:'3개월 소비 규모', data:bySales.map(o=>o.sales),
        colors:bySales.map(o=>o.gu===picked?'on':'')}]});

    const allOpen=!!S.zcAll;
    return {
      ind:this.indName(S.ind),
      lead:this.tn('zc.lead',{ind:this.indName(S.ind), gu:this.placeName(top.gu)}),
      sub:'카드를 누르면 아래 차트에서 그 자치구가 강조돼요. 옆으로 넘겨 보세요.',
      picked:picked,
      medLine:'position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;'
        +'background:var(--ink3);opacity:.55;left:'+medPct.toFixed(1)+'%',
      medNote:'가운데 눈금이 서울 자치구 중앙값이에요',
      // 가로 슬라이드 — 25개를 세로로 펼치지 않는다
      rail:this.rail('zc',{per:4}),
      chartRail:this.rail('zcc',{per:1}),
      cards:list.map(card),
      charts:C, hasCharts:C.length>0,
      // 전체 목록은 눌렀을 때만
      allOpen:allOpen,
      allLabel:allOpen? '전체 목록 접기' : '전체 목록 보기 ('+list.length+'곳)',
      toggleAll:()=>this.setState({zcAll:!allOpen}),
      hasList:allOpen,
      rows:list.map((o,i)=>({
        rank:i+1, gu:o.gu,
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
          '자치구 안 상권들의 매출 합계를 같은 업종 점포 수 합계로 나눴어요. 원자료는 3개월 합계라 3으로 나눠 월 기준으로 적습니다.'],
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
          {label:'결제 1건당 추정 금액', value:unit? this.wonRaw(unit):'데이터 없음', tag:unit?'실제 집계':'정부 자료에 없어 점수에 넣지 않았습니다'}
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
      gu:this.placeName(gu), ind:this.indName(S.ind),
      guOptions:GU,
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
          +(i===0?'background:var(--accent-3);border:1px solid var(--accent-2)'
                 :'background:var(--bg);border:1px solid var(--line);box-shadow:var(--shadow-card)')
      })),
      // 나머지는 접어 둔다 — 71줄을 한 번에 던지지 않는다
      moreLabel: showAll? '접기' : ('나머지 '+Math.max(list.length-12,0)+'곳 더 보기'),
      hasMore: list.length>12,
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
      note:'금액은 가게 한 곳이 한 달에 파는 돈이에요. 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적은 아니에요. 자치구는 상권 좌표로 붙였고, 경계에서 250m 안쪽인 곳은 두 구를 함께 적었어요 — 강남역처럼 강남대로를 경계로 서쪽이 서초구인 곳이 그래요.'
    };
  },

  // 지역비교 — 자치구 25개를 고른 장사 기준으로 묶어 비교한다
  // ── 시세분석 ───────────────────────────────────────────────────
  // 왼쪽 세로 메뉴에서 하나를 고르면 오른쪽에 '핵심 수치 + 차트 2~4개 + 지역 비교'.
  // 여러 개를 동시에 켜 두면 무엇을 보는 화면인지 흐려진다(§16).
  priceView(){
    const S=this.state;
    // 시장동향에서 고른 지표가 우리 자료로 그릴 수 있는 것이면 그것을 따른다.
    // (환율·농산물처럼 아직 연결 안 된 지표는 여기 오지 않고 '준비 중' 카드가 뜬다.)
    const cat=(S.mkSel && PRICE_CATS.some(c=>c.k===S.mkSel)) ? S.mkSel : (S.prCat||'rent');
    const meta=PRICE_CATS.find(c=>c.k===cat)||PRICE_CATS[0];
    const R=S.rentStats, HI=S.salesHistory, ST=S.sti, IC=S.income;
    const out={
      cat, catLabel:meta.label, when:meta.when,
      // 메뉴 — 하나만 켜진다.
      // 데스크톱은 왼쪽 세로 목록, 모바일은 가로 칩 줄이다.
      // 모바일에서 6개를 세로로 쌓으면 그것만으로 한 화면이 차서 차트가 안 보였다.
      navStyle:this.L(
        'display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:2px 0 8px;min-width:0',
        this.ds('card')+';align-self:start;padding:10px;min-width:0',
        this.ds('card')+';align-self:start;padding:10px;min-width:0'),
      nav:PRICE_CATS.map(c=>({
        label:c.label, when:c.when, on:c.k===cat,
        pick:()=>this.setState({prCat:c.k, prPick:null}),
        style: this.bp()==='mobile'
          ? 'flex:none;display:block;padding:9px 15px;border-radius:999px;cursor:pointer;text-align:center;'
            +'font-size:14px;transition:background .14s,color .14s;'
            +(c.k===cat?'background:var(--accent-3);color:var(--accent);font-weight:700'
                       :'background:var(--surface);color:var(--ink2)')
          : 'display:block;padding:11px 13px;border-radius:var(--r-sm);cursor:pointer;'
            +'font-size:14.5px;transition:background .14s,color .14s;min-width:0;'
            +(c.k===cat?'background:var(--accent-3);color:var(--accent);font-weight:700':'color:var(--ink2)'),
        whenStyle:'display:block;font-size:10.5px;font-weight:600;margin-top:3px;white-space:nowrap;'
          +(c.k===cat?'color:var(--accent);opacity:.8':'color:var(--ink3)')
      })),
      title:'', now:'', nowLabel:'', delta:'', deltaStyle:'display:none',
      charts:[], hasCharts:false, note:'', missing:'', hasMissing:false,
      list:[], listTitle:'', hasList:false
    };
    const C=[];   // 이 카테고리의 차트들
    const push=(id,opt)=>{ const c=this.chartCard(id,opt); if(c) C.push(c); };

    // ── 임대료 · 공실률 (한국부동산원 임대동향조사) ────────────────
    if(cat==='rent'||cat==='vacancy'){
      if(!R||!Array.isArray(R.quarters)||!R.quarters.length||!R.zones){
        out.note='임대료 자료를 아직 불러오지 못했어요.'; return out;
      }
      const isRent=cat==='rent';
      const zones=Object.values(R.zones);
      const pickNm=S.prPick||(zones[0]&&zones[0].nm);
      const z=zones.find(o=>o.nm===pickNm)||zones[0];
      const trend=(z? (isRent? z.rent_trend : z.vacancy_trend) : [])||[];
      const qs=R.quarters, qLabel=q=>String(q).replace('년 ','.').replace('분기','Q');
      const val=isRent? (z&&z.rent) : (z&&z.vacancy);
      const first=trend[0], last=trend[trend.length-1];
      const d=(isFinite(first)&&isFinite(last))? last-first : null;

      out.title=this.placeName(z?z.nm:'')+' · '+this.t(isRent?'pr.rentUnit':'pr.vacancy');
      out.now=(val==null?'—':(isRent? this.manF(val,1) : val.toFixed(1)+'%'));
      out.nowLabel=qs[qs.length-1]+' 기준';
      if(d!=null){
        // 임차인에게 임대료 상승은 나쁜 값이다 — 부호가 아니라 뜻으로 색을 정한다
        const bad=isRent? d>0 : d>0;
        out.delta=(d>0?'▲ ':'▼ ')+(isRent? this.manF(Math.abs(d),1) : Math.abs(d).toFixed(1)+'%p')
          +' · '+this.t('pr.vs2y');
        out.deltaStyle='font-size:13.5px;font-weight:700;white-space:nowrap;color:'
          +(Math.abs(d)<0.05?'var(--ink3)':(bad?'var(--warn)':'var(--good)'));
      }
      // ① 이 상권의 추이
      push('pr-trend',{type:'line',
        title:this.t(isRent?'pr.trendRent':'pr.trendVac',{name:this.placeName(z?z.nm:'')}),
        sub:this.t(isRent?'pr.rentUnit':'pr.vacancy'),
        unit:isRent?'만원':'%', period:qs[0]+' ~ '+qs[qs.length-1], height:230,
        labels:qs.map(qLabel), datasets:[{label:this.placeName(z?z.nm:''), data:trend}]});
      // ② 상권별 비교 — 상위 12곳
      const rankBy=zones.slice().filter(o=>isFinite(isRent?o.rent:o.vacancy))
        .sort((a,b)=> (isRent? b.rent-a.rent : b.vacancy-a.vacancy)).slice(0,12);
      push('pr-zones',{type:'hbar', title:this.t(isRent?'pr.cmpRent':'pr.cmpVac'),
        sub:'높은 순 12곳', unit:isRent?'만원':'%', period:qs[qs.length-1]+' 기준', height:300,
        labels:rankBy.map(o=>this.placeName(o.nm)),
        datasets:[{label:this.t(isRent?'pr.rentUnit':'pr.vacancy'),
          data:rankBy.map(o=>isRent?o.rent:o.vacancy),
          colors:rankBy.map(o=>o.nm===(z&&z.nm)?'on':'')}]});
      // ③ 서울 전체 추이 — 이 상권이 흐름을 따라가는지 견준다
      if(R.seoul){
        const st=isRent?R.seoul.rent_trend:R.seoul.vacancy_trend;
        push('pr-seoul',{type:'line', title:this.t(isRent?'pr.seoulRent':'pr.seoulVac'),
          sub:'같은 기간 서울 평균', unit:isRent?'만원':'%',
          period:qs[0]+' ~ '+qs[qs.length-1], height:230,
          labels:qs.map(qLabel), datasets:[{label:'서울 평균', data:st}]});
      }
      // ④ 임대료를 볼 때 공실률도 같이 본다(반대도 마찬가지) — 서로 다른 질문
      if(z){
        const other=isRent? z.vacancy_trend : z.rent_trend;
        push('pr-other',{type:'line',
          title:this.t(isRent?'pr.trendVac':'pr.trendRent',{name:this.placeName(z.nm)}),
          sub:isRent?'임대료가 오를 때 빈 상가도 느는지':'공실이 늘 때 임대료가 내리는지',
          unit:isRent?'%':'만원', period:qs[0]+' ~ '+qs[qs.length-1], height:230,
          labels:qs.map(qLabel), datasets:[{label:this.placeName(z.nm), data:other||[]}]});
      }
      out.listTitle='상권 '+zones.length+'곳';
      out.list=zones.slice().sort((a,b)=>(isRent?b.rent-a.rent:b.vacancy-a.vacancy)).map(o=>({
        name:this.placeName(o.nm), meta:this.placeName(o.gwon||''),
        value:(isRent? this.manF(o.rent||0,1) : (o.vacancy||0).toFixed(1)+'%'),
        pick:()=>this.setState({prPick:o.nm}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(o.nm===(z&&z.nm)?'background:var(--accent-3)':'')}));
      out.note='한국부동산원 상업용부동산 임대동향조사(중대형 상가). '+R.unit
        +'. 이 조사의 상권 구획은 서울시 상권분석의 상권 1,564곳과 다른 지리라, 권역 수준의 참고값이에요.';
    }

    // ── 업종별 매출 추이 (서울 전체) ──────────────────────────────
    else if(cat==='sales'){
      if(!HI||!HI.ind){ out.note='매출 추이 자료를 아직 불러오지 못했어요.'; return out; }
      const inds=Object.keys(HI.ind);
      const pick=(S.prPick&&HI.ind[S.prPick])?S.prPick:(inds.indexOf(S.ind)>=0?S.ind:inds[0]);
      const qs=HI.quarters, series=qs.map(q=>HI.ind[pick][q]??null);
      const qLabel=q=>String(q).slice(0,4)+'.'+String(q).slice(4)+'Q';
      const cur=series.filter(v=>v!=null).slice(-1)[0];
      const prev=series.filter(v=>v!=null).slice(-5)[0];
      out.title=this.indName(pick)+' · 서울 전체 분기 매출';
      out.now=this.won(cur);
      out.nowLabel=this.qtr(qs[qs.length-1])+' 기준';
      if(cur&&prev){
        const g=Math.round((cur-prev)/prev*100);
        out.delta=(g>0?'▲ ':'▼ ')+Math.abs(g)+'% · 1년 전 대비';
        out.deltaStyle='font-size:13.5px;font-weight:700;white-space:nowrap;color:'
          +(Math.abs(g)<3?'var(--ink3)':(g>0?'var(--good)':'var(--warn)'));
      }
      push('pr-sales-trend',{type:'line', title:this.indName(pick)+' 매출 추이',
        sub:'서울 전체 분기 합계', unit:'원',
        period:this.qtr(qs[0])+' ~ '+this.qtr(qs[qs.length-1]), height:250,
        labels:qs.map(qLabel), datasets:[{label:this.indName(pick), data:series}]});
      // 최근 분기 업종 비교 — 다른 질문(어느 업종이 큰가)
      const lastQ=qs[qs.length-1];
      const top=inds.map(n=>({n, v:HI.ind[n][lastQ]})).filter(o=>isFinite(o.v))
        .sort((a,b)=>b.v-a.v).slice(0,12);
      push('pr-sales-rank',{type:'hbar', title:'업종별 매출 비교', sub:'최근 분기 상위 12개',
        unit:'원', period:this.qtr(lastQ)+' 기준', height:300,
        labels:top.map(o=>this.indName(o.n)),
        datasets:[{label:'분기 매출', data:top.map(o=>o.v),
          colors:top.map(o=>o.n===pick?'on':'')}]});
      // 성장률 — 또 다른 질문(어느 업종이 크고 있는가)
      const grow=inds.map(n=>{
        const a=HI.ind[n][qs[qs.length-5]], b=HI.ind[n][lastQ];
        return (isFinite(a)&&isFinite(b)&&a>0)? {n, g:(b-a)/a*100} : null;
      }).filter(Boolean).sort((a,b)=>b.g-a.g);
      const growShow=[...grow.slice(0,6), ...grow.slice(-6)];
      push('pr-sales-growth',{type:'hbar', title:'1년 새 매출이 는 업종 · 준 업종',
        sub:'위 6개는 늘고, 아래 6개는 줄었어요', unit:'%',
        period:this.qtr(qs[qs.length-5])+' → '+this.qtr(lastQ), height:320,
        labels:growShow.map(o=>this.indName(o.n)),
        datasets:[{label:'1년 증감', data:growShow.map(o=>Math.round(o.g*10)/10),
          colors:growShow.map(o=>o.g>=0?'on':'warn')}]});
      out.listTitle='업종 '+inds.length+'가지';
      out.list=inds.map(n=>({
        name:this.indName(n), meta:'',
        value:this.won(HI.ind[n][lastQ]),
        pick:()=>this.setState({prPick:n}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(n===pick?'background:var(--accent-3)':'')}));
      out.note='서울시 상권분석서비스 분기 매출을 업종별로 합친 값이에요. 상권 하나가 아니라 서울 전체 기준이에요.';
    }

    // ── 개·폐업 ────────────────────────────────────────────────────
    else if(cat==='churn'){
      if(!ST||!ST.ind){ out.note='개·폐업 자료를 아직 불러오지 못했어요.'; return out; }
      const rows=Object.keys(ST.ind).map(n=>({name:this.indName(n), raw:n, ...ST.ind[n]}))
        .filter(o=>isFinite(o.opened)&&isFinite(o.closed));
      const mine=rows.find(o=>o.raw===S.ind)||rows[0];
      out.title=mine.name+' · 3개월 동안';
      const net=mine.opened-mine.closed;
      out.now=(net>0?'+':'')+net.toLocaleString()+'곳';
      out.nowLabel='새로 연 곳 − 문 닫은 곳 · 서울 전체';
      out.delta=net>=0?'가게가 늘고 있어요':'가게가 줄고 있어요';
      out.deltaStyle='font-size:13.5px;font-weight:700;white-space:nowrap;color:'+(net>=0?'var(--good)':'var(--warn)');
      const byChurn=rows.slice().sort((a,b)=>(b.opened+b.closed)-(a.opened+a.closed)).slice(0,12);
      push('pr-churn',{type:'bar', title:'업종별 개업 · 폐업', sub:'움직임이 큰 12개 업종',
        unit:'곳', period:this.qtr(ST.quarter)+' · 3개월', height:280,
        labels:byChurn.map(o=>o.name),
        datasets:[{label:'새로 연 곳', data:byChurn.map(o=>o.opened)},
                  {label:'문 닫은 곳', data:byChurn.map(o=>o.closed)}]});
      const rate=rows.filter(o=>isFinite(o.close_rate)).sort((a,b)=>b.close_rate-a.close_rate).slice(0,12);
      push('pr-close-rate',{type:'hbar', title:'폐업률이 높은 업종', sub:'전체 점포 대비 폐업 비율',
        unit:'%', period:this.qtr(ST.quarter)+' 기준', height:300,
        labels:rate.map(o=>o.name),
        datasets:[{label:'폐업률', data:rate.map(o=>o.close_rate),
          colors:rate.map(o=>o.raw===mine.raw?'on':'warn')}]});
      const net12=rows.map(o=>({name:o.name, raw:o.raw, v:o.opened-o.closed}))
        .sort((a,b)=>b.v-a.v);
      const netShow=[...net12.slice(0,6), ...net12.slice(-6)];
      push('pr-net',{type:'hbar', title:'가게가 느는 업종 · 주는 업종', sub:'새로 연 곳 − 문 닫은 곳',
        unit:'곳', period:this.qtr(ST.quarter)+' · 3개월', height:320,
        labels:netShow.map(o=>o.name),
        datasets:[{label:'순증감', data:netShow.map(o=>o.v),
          colors:netShow.map(o=>o.v>=0?'on':'warn')}]});
      out.note='서울 전체 기준이라 상권을 바꿔도 변하지 않아요. 줄어드는 이유가 경쟁이 풀리는 것인지 장사가 어려워지는 것인지는 이 자료로 구분되지 않아요.';
    }

    // ── 프랜차이즈 비중 ────────────────────────────────────────────
    else if(cat==='fr'){
      if(!ST||!ST.ind){ out.note='프랜차이즈 자료를 아직 불러오지 못했어요.'; return out; }
      const rows=Object.keys(ST.ind).map(n=>({name:this.indName(n), raw:n, ...ST.ind[n]}))
        .filter(o=>isFinite(o.fr_share));
      const mine=rows.find(o=>o.raw===S.ind);
      const top=rows.slice().sort((a,b)=>b.fr_share-a.fr_share).slice(0,14);
      out.title='업종별 프랜차이즈 비중';
      out.now=mine? mine.fr_share+'%' : (top[0].fr_share+'%');
      out.nowLabel=mine? this.indName(mine.raw)+' 기준' : top[0].name+' 기준';
      push('pr-fr',{type:'hbar', title:'프랜차이즈 비중이 높은 업종', sub:'전체 점포 중 프랜차이즈 비율',
        unit:'%', period:this.qtr(ST.quarter)+' 기준', height:340,
        labels:top.map(o=>o.name),
        datasets:[{label:'프랜차이즈 비중', data:top.map(o=>o.fr_share),
          colors:top.map(o=>o.raw===S.ind?'on':'')}]});
      const big=rows.slice().sort((a,b)=>b.stores-a.stores).slice(0,12);
      push('pr-fr-stores',{type:'hbar', title:'점포 수가 많은 업종', sub:'프랜차이즈 비중과 함께 보면 경쟁 성격이 보여요',
        unit:'곳', period:this.qtr(ST.quarter)+' 기준', height:300,
        labels:big.map(o=>o.name),
        datasets:[{label:'전체 점포 수', data:big.map(o=>o.stores),
          colors:big.map(o=>o.raw===S.ind?'on':'')}]});
      out.note='서울 전체 기준이에요. 프랜차이즈 비중이 높은 업종은 개인 가게가 브랜드와 바로 부딪힌다는 뜻이에요.';
    }

    // ── 자치구 소비 구성 ───────────────────────────────────────────
    else {
      if(!IC||!IC.gu){ out.note='소비 자료를 아직 불러오지 못했어요.'; return out; }
      const gus=Object.keys(IC.gu);
      const pick=(S.prPick&&IC.gu[S.prPick])?S.prPick:(gus.indexOf(S.rp_gu)>=0?S.rp_gu:gus[0]);
      const spend=(IC.gu[pick]&&IC.gu[pick].spend)||[];
      const sorted=spend.slice().sort((a,b)=>b.pct-a.pct);
      out.title=pick+' · 가구가 돈을 쓰는 곳';
      out.now=sorted.length? sorted[0].name : '—';
      out.nowLabel=sorted.length? '가장 큰 항목 '+sorted[0].pct+'%' : '';
      push('pr-spend',{type:'doughnut', title:pick+' 소비 구성', sub:'가구 지출에서 차지하는 비율',
        unit:'%', period:this.qtr(IC.quarter)+' 기준', height:300,
        labels:sorted.map(o=>o.name), datasets:[{label:'비율', data:sorted.map(o=>o.pct)}]});
      // 같은 항목을 자치구끼리 견준다 — 다른 질문
      const key=sorted.length? sorted.find(o=>o.name==='음식')||sorted[0] : null;
      if(key){
        const cross=gus.map(g=>{
          const it=((IC.gu[g]||{}).spend||[]).find(x=>x.name===key.name);
          return it? {g, v:it.pct} : null;
        }).filter(Boolean).sort((a,b)=>b.v-a.v);
        push('pr-spend-gu',{type:'hbar', title:'자치구별 ‘'+key.name+'’ 지출 비중',
          sub:'같은 항목을 자치구끼리 견줘요', unit:'%', period:this.qtr(IC.quarter)+' 기준', height:340,
          labels:cross.map(o=>o.g), datasets:[{label:key.name+' 비중', data:cross.map(o=>o.v),
            colors:cross.map(o=>o.g===pick?'on':'')}]});
      }
      out.listTitle='자치구 '+gus.length+'곳';
      out.list=gus.map(g=>({
        name:g, meta:'',
        value:(((IC.gu[g]||{}).spend||[]).slice().sort((a,b)=>b.pct-a.pct)[0]||{}).name||'—',
        pick:()=>this.setState({prPick:g}),
        style:'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-sm);cursor:pointer;'
          +(g===pick?'background:var(--accent-3)':'')}));
      out.note=IC.income_note||'자치구 단위 가구 지출 구성이에요. 상권 하나의 값은 아니에요.';
    }

    out.charts=C; out.hasCharts=C.length>0;
    out.hasList=out.list.length>0;
    // 차트가 많으면 가로로 넘겨 본다
    // 한 화면에 차트 하나. 옆으로 넘겨 다음 질문으로 간다(§8·§21)
    out.rail=this.rail('price', {per:1});
    return out;
  }
};
