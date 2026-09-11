'use strict';
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
// 홈 검색·지역 선택과 전환.
globalThis.MysbizonParts.home = {
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
        empty=!list.length; emptyText=this.tn('search.noZone',{q:q});
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
    // 처음엔 아무 구도 골라져 있지 않다 — 기본값을 두면 첫 클릭이 곧 '두 번째 클릭'이 된다
    const guTab=S.guTab||'';
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
          style:'flex:none;font-size:13px;padding:11px 14px;border-radius:999px;background:var(--card);color:var(--ink2);cursor:pointer;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;transition:background .16s,color .16s'
        });
      });
    }

    return {
      badgeStyle:'display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2);background:var(--surface);border-radius:999px;padding:7px 14px;margin:0 auto 26px;'
        +(S.skip?'opacity:1':'opacity:0;animation:lateIn .7s cubic-bezier(.22,.7,.25,1) .5s forwards'),
      // 첫 줄은 표어가 아니라 '무엇을 근거로 말하는지'다.
      // 자료가 붙기 전에는 슬로건으로 두고, 붙으면 실제 개수·분기로 바꾼다.
      heroEyebrow:(S.zi && S.zi.n_zones)
        ? this.t('home.stamp',{n:S.zi.n_zones.toLocaleString(), q:this.qtr(S.zi.quarter)})
        : this.t('home.eyebrow'),
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
      pickerRow:'display:flex;background:var(--card);border-radius:20px;padding:6px;transition:box-shadow .22s;'
        +this.L('flex-direction:column;align-items:stretch;gap:4px;','align-items:center;gap:0;','align-items:center;gap:0;')
        +(open
          ? 'box-shadow:0 16px 40px rgba(0,0,0,.12)'
          : 'box-shadow:0 12px 32px rgba(0,0,0,.08)'),
      // 입력칸 자체는 22px 이지만 누르는 칸은 감싼 셀(indBtn·zoneBtn, onClick=openInd/openZone)이라
      // 44px 이 넘는다. 칸을 44px 로 키우면 초점 테두리가 위아래 라벨을 가로질러 그어진다(실제로 그랬다).
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
          return;
        }
        // 빈 칸에서 Backspace 면 앞 칸(업종)으로. 업종이 첫 칸이라 input[0] 이다.
        if(e.key==='Backspace' && !zq){
          e.preventDefault();
          this.setState({pickOpen:'ind'});
          const el=document.querySelectorAll('[data-search] input')[0];
          if(el) el.focus();
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
      },
      dividerStyle:this.L('flex:none;height:1px;margin:0 16px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)','flex:none;width:1px;height:26px;background:var(--line)'),
      indBtn:fieldBase+(open==='ind'?'background:rgba(0,0,0,.04)':''),
      zoneBtn:fieldBase+(open==='zone'?'background:rgba(0,0,0,.04)':''),
      // 값이 있을 때만 나오는 지우기. 메인 버튼과 12px 이상 떨어져 있고 클릭이 위로 전파되지 않는다.
      hasZone:!!(S.homeZoneName||S.homeGu), hasIndVal:hasInd,
      clearStyle:'flex:none;width:32px;height:32px;margin-left:8px;border-radius:50%;background:var(--surface);color:var(--ink3);'
        +'font-size:11px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .14s',
      clearZone:e=>{ e.stopPropagation(); this.setState({homeZoneName:null,homeGu:null,findGu:'',zoneId:null,sel:null,zq:'',pickOpen:null}); },
      clearInd:e=>{ e.stopPropagation(); this.setState({homeInd:null,iq:'',pickOpen:null}); },
      zoneHint:(S.homeZoneName||S.homeGu)?'':'· 몰라도 돼요',
      // 칸 순서는 업종(0) → 위치(1) 다. 번호를 바꾸면 각 칸의 onFocus 가 서로를
      // 부르며 무한히 돈다(실제로 그렇게 'Maximum call stack size exceeded' 가 났다).
      // 이미 그 칸에 커서가 있으면 다시 focus 하지 않는 것도 그래서다.
      openInd:()=>{ if(open!=='ind') this.setState({pickOpen:'ind'});
        const el=document.querySelectorAll('[data-search] input')[0];
        if(el && document.activeElement!==el) el.focus(); },
      openZone:()=>{ if(open!=='zone') this.setState({pickOpen:'zone'});
        const el=document.querySelectorAll('[data-search] input')[1];
        if(el && document.activeElement!==el) el.focus(); },
      pickOpen:!!open, indPanel:open==='ind', zonePanel:open==='zone',
      // 통째로 교체되는 목록은 위치 애니메이션 대신 짧은 페이드로 바꾼다
      indGridStyle:'display:grid;grid-template-columns:'+this.L('1fr','1fr 1fr','1fr 1fr')+';gap:8px;'
        +'animation:fadeIn .14s linear both',
      hotInds:[['커피-음료','☕'],['치킨전문점','🍗'],['편의점','🏪'],['미용실','💇'],['한식음식점','🍚'],['호프-간이주점','🍺']]
        .filter(([n])=>indsAll.indexOf(n)>=0)
        .map(([n,em])=>({label:em+' '+this.indName(n),
          pick:()=>this.setState({homeInd:n,ind:n,iq:this.indName(n),pickOpen:null}),
          style:'flex:none;font-size:13.5px;font-weight:500;padding:12px 15px;border-radius:999px;cursor:pointer;white-space:nowrap;min-height:44px;display:inline-flex;align-items:center;transition:background .14s,color .14s;'
            +(n===S.homeInd?'background:var(--accent);color:var(--on-accent)':'background:var(--surface);color:var(--ink2)')})),
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
      indEmptyText: pq? this.tn('search.noInd',{q:pq}) : '이 분류에 해당하는 장사가 없어요',
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
            ? 'background:var(--accent);color:var(--on-accent);font-weight:600'
            : 'background:var(--surface);color:var(--ink2)'+(o.ready?'':';opacity:.6'))
      })),
      sidoReadyHome: homeSido==='서울특별시',
      sidoWaiting:   homeSido!=='서울특별시',
      sidoWaitText:this.t('sido.wait',{region:this.placeName(homeSido)}),
      backToSeoulHome:()=>this.setState({sido:'서울특별시'}),
      // 패널은 높이가 묶여 있다(화면 밖으로 나가지 않게). 안쪽이 넘치면 여기서 스크롤된다
      // — 예전에는 패널이 overflow:hidden 이라 구 25개 중 첫 줄만 보이고 잘려 있었다.
      panelBodyStyle:'flex:1 1 auto;min-height:0;overflow-y:auto;padding-right:4px',
      allCardStyle:'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:12px;background:var(--surface);cursor:pointer;transition:background .14s'
        +((S.homeZoneName||S.homeGu)?'':';box-shadow:inset 0 0 0 1.5px var(--accent)'),
      pickAll:()=>this.setState({homeZoneName:null,homeGu:null,findGu:'',zoneId:null,sel:null,zq:'',pickOpen:null}),
      // 구 25개를 세로 한 줄로 세우면 옆이 텅 빈다. ㄱㄴㄷ 순으로 여러 열에 깐다.
      guGridStyle:'display:grid;gap:4px;margin-top:14px;padding-top:14px;'
        +'border-top:1px solid var(--line);'
        // 로마자 자치구 이름은 한글보다 길어 3칸이면 잘린다 — 영어만 칸을 줄인다.
        +'grid-template-columns:repeat('+(this.locale()==='en'? this.L(2,3,4) : this.L(3,4,5))+',minmax(0,1fr))',
      hasRecent:(S.recent||[]).length>0,
      recentChips:(S.recent||[]).map(nm=>zoneAll.find(z=>z.name===nm)).filter(Boolean).slice(0,4).map(z=>({
        name:this.zoneLabelOf(z.name), meta:guOf(z.id),
        pick:()=>this.setState({homeZoneName:z.name,zoneId:z.id,sel:z.id,zq:this.zoneLabelOf(z.name),pickOpen:null}),
        style:'flex:none;display:inline-flex;align-items:center;gap:7px;padding:12px 15px;border-radius:999px;background:var(--surface);cursor:pointer;white-space:nowrap;min-height:44px;transition:background .14s,color .14s'
      })),
      // ㄱㄴㄷ 순 — 행정 순서(종로구부터)는 사장님이 아는 순서가 아니라 찾기 어렵다
      // 한 번 누르면 고르고, 같은 구를 한 번 더 누르면 그 구로 정하고 창을 닫는다.
      // 상권까지 고르지 않아도 '이 구에서 찾아 줘'로 넘어갈 수 있어야 한다.
      guTabs:GU_LIST.slice().sort((a,b)=>a.localeCompare(b,'ko')).map(g=>({
        label:this.placeName(g),
        pick:()=> g===guTab
          ? this.setState({homeGu:g, homeZoneName:null, zoneId:null, sel:null,
                           findGu:g, zq:g, pickOpen:null})
          : this.setState({guTab:g}),
        style:'font-size:13.5px;font-weight:500;padding:10px 6px;border-radius:9px;cursor:pointer;'
          +'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;'
          +'transition:background .14s,color .14s;'
          +(g===guTab?'background:var(--accent-3);color:var(--accent-hover);font-weight:700'
                     :(g===S.homeGu?'color:var(--accent-text);font-weight:600':'color:var(--ink2)'))
      })),
      // 고른 구를 한 번 더 누르라고 알려 준다 — 두 번 눌러야 하는 걸 알 방법이 없다
      // 구 이름이 문장 안에 들어가면 통째로는 사전에서 못 찾는다 — 자리표시자 키로 둔다
      guHint: guTab? this.tn('find.guHint',{gu:this.placeName(guTab)})
                   : '구를 누르면 골라지고, 한 번 더 누르면 정해져요',
      pickEmpty: !!pq && (open==='zone'? zoneList.length===0 : indList.length===0),
      pickEmptyText: open==='zone'? this.tn('search.noZone',{q:pq}) : this.tn('search.noInd',{q:pq}),
      startDisabled:!!S.starting,
      starting:!!S.starting, notStarting:!S.starting,
      startStyle:this.L('flex:none;width:100%;margin-top:4px;','flex:none;','flex:none;')
        +'font-size:15px;font-weight:600;border:none;border-radius:14px;height:'+this.L('46px','48px','48px')+';'
        +this.L('','min-width:106px;','min-width:116px;')+'padding:0 '+this.L('18px','22px','26px')+';white-space:nowrap;'
        +'display:inline-flex;align-items:center;justify-content:center;'
        +'transition:transform .2s cubic-bezier(.2,0,0,1),background .18s,box-shadow .2s,filter .18s;'
        // 비활성이어도 브랜드 컬러 글자와 옅은 배경을 남겨 누를 수 있는 요소로 읽히게 한다
        +(hasInd
          ? 'cursor:'+(S.starting?'default':'pointer')+';background:var(--accent);color:var(--on-accent);box-shadow:0 6px 16px -6px rgba(0,0,0,.2)'
          : 'cursor:pointer;background:var(--accent-3);color:var(--accent-hover)'),
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

};
