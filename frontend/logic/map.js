'use strict';
// 지도는 사용자가 고른 한 지점을 중심으로만 움직인다. 상권 통계는 가장 가까운
// 서울시 상권 중심에 연결하고, 주변 업체는 Kakao 장소 검색 결과를 별도로 표시한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.map = {
  kakaoMapStatus(el,text){
    if(!el) return;
    el.replaceChildren();
    const msg=document.createElement('span'); msg.textContent=text;
    Object.assign(msg.style,{padding:'16px',color:'var(--ink3)',fontSize:'14px',lineHeight:'1.6'});
    el.appendChild(msg);
  },

  loadKakaoMapsSdk(key){
    if(globalThis.kakao?.maps?.Map && globalThis.kakao?.maps?.services) return Promise.resolve(globalThis.kakao.maps);
    if(globalThis.__mysbizonKakaoMapsPromise) return globalThis.__mysbizonKakaoMapsPromise;
    globalThis.__mysbizonKakaoMapsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script'); script.id='mysbizon-kakao-maps-sdk'; script.async=true;
      script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey='+encodeURIComponent(key);
      script.referrerPolicy='strict-origin-when-cross-origin';
      script.onload=()=>{ if(!globalThis.kakao?.maps?.load) return reject(new Error('Kakao Maps SDK unavailable'));
        globalThis.kakao.maps.load(()=>resolve(globalThis.kakao.maps)); };
      script.onerror=()=>reject(new Error('Kakao Maps SDK failed to load'));
      document.head.appendChild(script);
    }).catch(error=>{ globalThis.__mysbizonKakaoMapsPromise=null; throw error; });
    return globalThis.__mysbizonKakaoMapsPromise;
  },

  mapDistance(a,b){
    if(!a||!b) return Infinity;
    const R=6371000, rad=n=>Number(n)*Math.PI/180;
    const p1=rad(a.lat),p2=rad(b.lat),dp=p2-p1,dl=rad(b.lng)-rad(a.lng);
    const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  },

  nearestZoneForPoint(lat,lng){
    const lls=this.state.smap&&this.state.smap.lls;
    if(!lls||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))) return null;
    const point={lat:Number(lat),lng:Number(lng)}; let best=null,distance=Infinity;
    for(const id of Object.keys(lls)){
      const ll=lls[id]; if(!Array.isArray(ll)||!Number.isFinite(Number(ll[0]))||!Number.isFinite(Number(ll[1]))) continue;
      const d=this.mapDistance(point,{lat:Number(ll[0]),lng:Number(ll[1])});
      if(d<distance){best=id;distance=d;}
    }
    return best?{id:best,distance}:null;
  },

  franchiseName(name){
    const value=String(name||'').replace(/\s/g,'').toLowerCase();
    const brands=[['스타벅스','스타벅스'],['메가커피','메가커피'],['메가엠지씨','메가커피'],
      ['컴포즈','컴포즈커피'],['빽다방','빽다방'],['이디야','이디야'],['투썸','투썸플레이스'],
      ['할리스','할리스'],['파스쿠찌','파스쿠찌'],['커피빈','커피빈'],['폴바셋','폴바셋'],
      ['파리바게뜨','파리바게뜨'],['뚜레쥬르','뚜레쥬르'],['배스킨라빈스','배스킨라빈스'],
      ['맥도날드','맥도날드'],['롯데리아','롯데리아'],['맘스터치','맘스터치'],
      ['교촌','교촌치킨'],['bhc','BHC'],['비비큐','BBQ'],['bbq','BBQ'],
      ['씨유','CU'],['cu','CU'],['gs25','GS25'],['세븐일레븐','세븐일레븐'],['이마트24','이마트24'],
      ['올리브영','올리브영'],['다이소','다이소']];
    const hit=brands.find(([needle])=>value.includes(needle)); return hit?hit[1]:'';
  },

  destroyKakaoMap(){
    if(this._kakaoResizeObserver){this._kakaoResizeObserver.disconnect();this._kakaoResizeObserver=null;}
    if(this._kakaoSelectionOverlay){try{this._kakaoSelectionOverlay.setMap(null);}catch(e){} this._kakaoSelectionOverlay=null;}
    for(const overlay of this._kakaoOverlays||[]){try{overlay.setMap(null);}catch(e){}}
    for(const marker of this._kakaoMarkers||[]){try{marker.setMap(null);}catch(e){}}
    this._kakaoOverlays=[];this._kakaoMarkers=[];this._kakaoMap=null;this._kakaoContainer=null;
    this._kakaoLayerSignature='';this._kakaoPointSignature='';
  },

  nearestZoneForIndustry(lat,lng,industry){
    return this.nearbyZonesForIndustry(lat,lng,industry,Infinity)[0]||null;
  },

  nearbyZonesForIndustry(lat,lng,industry,maxDistance=500){
    const zi=this.state.zi,lls=this.state.smap&&this.state.smap.lls;
    if(!zi||!lls||!Array.isArray(zi.inds)){
      const nearest=this.nearestZoneForPoint(lat,lng);
      return nearest&&nearest.distance<=maxDistance?[nearest]:[];
    }
    const indIndex=zi.inds.indexOf(industry),point={lat:Number(lat),lng:Number(lng)};
    if(indIndex<0){
      const nearest=this.nearestZoneForPoint(lat,lng);
      return nearest&&nearest.distance<=maxDistance?[nearest]:[];
    }
    const matches=[];
    for(const [id,zone] of Object.entries(zi.zones||{})){
      const ll=lls[id],row=(zone.rows||[]).find(row=>row[0]===indIndex&&row[1]>0&&row[2]>0);
      if(!row||!Array.isArray(ll)) continue;
      const d=this.mapDistance(point,{lat:Number(ll[0]),lng:Number(ll[1])});
      if(d<=maxDistance) matches.push({id,distance:d,stores:Number(row[1]),sales:Number(row[2]),name:zone.nm||id});
    }
    return matches.sort((a,b)=>a.distance-b.distance);
  },

  kakaoSelectedPin(){
    const wrap=document.createElement('div');wrap.setAttribute('aria-label',this.t('map.selectedPoint'));
    Object.assign(wrap.style,{display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',pointerEvents:'none'});
    const label=document.createElement('span');label.textContent=this.t('map.selectedPoint');
    Object.assign(label.style,{padding:'5px 9px',borderRadius:'999px',background:'var(--card)',color:'var(--ink)',border:'1px solid var(--line-strong)',boxShadow:'0 4px 14px rgba(0,0,0,.14)',fontSize:'12px',fontWeight:'700',whiteSpace:'nowrap'});
    const pin=document.createElement('span');
    Object.assign(pin.style,{display:'block',width:'30px',height:'30px',borderRadius:'50% 50% 50% 0',transform:'rotate(-45deg)',background:'var(--accent)',border:'4px solid white',boxShadow:'0 5px 15px rgba(0,0,0,.28)'});
    const dot=document.createElement('span');Object.assign(dot.style,{display:'block',width:'8px',height:'8px',borderRadius:'50%',background:'white',margin:'7px'});
    pin.appendChild(dot);wrap.append(label,pin);return wrap;
  },

  syncKakaoMapLayers(pointOverride){
    const K=globalThis.kakao&&globalThis.kakao.maps,map=this._kakaoMap;if(!K?.CustomOverlay||!map) return;
    const point=pointOverride||this.state.mapPoint,pointSig=point?Number(point.lat).toFixed(6)+','+Number(point.lng).toFixed(6):'';
    if(point){
      const pos=new K.LatLng(point.lat,point.lng);
      if(!this._kakaoSelectionOverlay) this._kakaoSelectionOverlay=new K.CustomOverlay({map,position:pos,content:this.kakaoSelectedPin(),xAnchor:.5,yAnchor:1.08,zIndex:20});
      else{this._kakaoSelectionOverlay.setPosition(pos);this._kakaoSelectionOverlay.setMap(map);}
      if(pointSig!==this._kakaoPointSignature){map.setCenter(pos);if(map.getLevel&&map.getLevel()>4) map.setLevel(4);}
    }else if(this._kakaoSelectionOverlay){this._kakaoSelectionOverlay.setMap(null);this._kakaoSelectionOverlay=null;}
    this._kakaoPointSignature=pointSig;
    const rows=this.state.showCompetitorPins?(this.state.competitors||[]).slice(0,40):[];
    const signature=(this.state.showCompetitorPins?'1:':'0:')+rows.map(row=>row.id+':'+(row.id===this.state.competitorFocus?'1':'0')).join(',');
    if(signature===this._kakaoLayerSignature) return;
    for(const overlay of this._kakaoOverlays||[]){try{overlay.setMap(null);}catch(e){}}this._kakaoOverlays=[];
    for(const row of rows){
      const marker=document.createElement('button');marker.type='button';marker.title=row.name;marker.setAttribute('aria-label',row.name);
      Object.assign(marker.style,{width:'24px',height:'24px',borderRadius:'50%',border:'2px solid var(--card)',background:row.franchise?'var(--accent)':'var(--ink2)',boxShadow:'0 3px 10px rgba(0,0,0,.22)',cursor:'pointer'});
      marker.addEventListener('click',e=>{e.stopPropagation();this.setState({competitorsOpen:true,competitorFocus:row.id});});
      this._kakaoOverlays.push(new K.CustomOverlay({map,position:new K.LatLng(row.lat,row.lng),content:marker,xAnchor:.5,yAnchor:.5,zIndex:4}));
    }
    this._kakaoLayerSignature=signature;
  },

  previewKakaoPoint(lat,lng){
    if(!this._kakaoMap) return;this._kakaoPointSignature='';
    this.syncKakaoMapLayers({lat:Number(lat),lng:Number(lng)});
  },

  mapGuFromText(value){
    const hit=String(value||'').match(/서울(?:특별시)?\s+([^\s]+구)(?:\s|$)/);
    return hit?hit[1]:'';
  },

  chooseMapPoint(lat,lng,label){
    this.previewKakaoPoint(lat,lng);
    const closest=this.nearestZoneForIndustry(lat,lng,this.state.ind),nearest=closest&&closest.distance<=500?closest:null;
    const address=String(label||'').trim(),gu=this.mapGuFromText(address);
    this.setState({mapPoint:{lat:Number(lat),lng:Number(lng)},mapAddress:address,
      mapGu:gu||'',
      sel:nearest?nearest.id:null,zoneId:nearest?nearest.id:null,mapZoneId:nearest?nearest.id:null,mapZoneDistance:closest?Math.round(closest.distance):null,
      competitors:null,competitorsLoading:true,competitorsOpen:false,showCompetitorPins:false,mapSearchMsg:''});
    this.resolveMapAddress(Number(lat),Number(lng)); this.fetchNearbyCompetitors(Number(lat),Number(lng));
  },

  changeMapIndustry(value){
    const industry=String(value||''),point=this.state.mapPoint;
    const closest=point?this.nearestZoneForIndustry(point.lat,point.lng,industry):null,nearest=closest&&closest.distance<=500?closest:null;
    this.setState({ind:industry,sel:nearest?nearest.id:null,zoneId:nearest?nearest.id:null,mapZoneId:nearest?nearest.id:null,mapZoneDistance:closest?Math.round(closest.distance):null,
      competitors:null,competitorsLoading:!!point,competitorsOpen:false,showCompetitorPins:false,mapSearchMsg:''});
    if(point) this.fetchNearbyCompetitors(point.lat,point.lng);
  },

  resolveMapAddress(lat,lng){
    const key=String(this.state.kakaoMapKey||''); if(!key) return;
    this.loadKakaoMapsSdk(key).then(K=>{
      const geocoder=new K.services.Geocoder();
      geocoder.coord2Address(lng,lat,(rows,status)=>{
        if(status!==K.services.Status.OK||!rows||!rows[0]) return;
        const row=rows[0],addressRow=row.road_address||row.address||{},addr=addressRow.address_name||'';
        const gu=addressRow.region_2depth_name||this.mapGuFromText(addr);
        if(addr&&this.state.mapPoint&&this.mapDistance(this.state.mapPoint,{lat,lng})<5) this.setState({mapAddress:addr,mapGu:gu||''});
      });
    }).catch(()=>{});
  },

  searchMapAddress(){
    const q=String(this.state.mapQ||'').trim(),key=String(this.state.kakaoMapKey||'');
    if(!q) return this.setState({mapSearchMsg:this.t('map.searchEmpty')});
    if(!key) return this.setState({mapSearchMsg:this.t('map.unavailable')});
    this.setState({mapSearching:true,mapSearchMsg:''});
    this.loadKakaoMapsSdk(key).then(K=>{
      new K.services.Places().keywordSearch(q,(rows,status)=>{
        if(status!==K.services.Status.OK||!rows||!rows.length){this.setState({mapSearching:false,mapSearchMsg:this.t('map.searchNone')});return;}
        const first=rows.find(row=>String(row.address_name||row.road_address_name||'').includes('서울'))||rows[0];
        this.setState({mapSearching:false,mapQ:first.place_name||q});
        this.chooseMapPoint(Number(first.y),Number(first.x),first.road_address_name||first.address_name||first.place_name);
      },{size:15});
    }).catch(()=>this.setState({mapSearching:false,mapSearchMsg:this.t('map.failed')}));
  },

  fetchNearbyCompetitors(lat,lng){
    const key=String(this.state.kakaoMapKey||''); if(!key){this.setState({competitorsLoading:false,competitors:[]});return;}
    const industry=this.state.ind;
    this.loadKakaoMapsSdk(key).then(K=>{
      const places=new K.services.Places(),rows=[];
      places.keywordSearch(this.indName(industry),(data,status,pagination)=>{
        if(status===K.services.Status.OK&&Array.isArray(data)) rows.push(...data);
        if(status===K.services.Status.OK&&pagination&&pagination.hasNextPage&&pagination.current<3){pagination.nextPage();return;}
        const seen=new Set();
        const normalized=rows.filter(row=>{if(!row||seen.has(row.id)) return false;seen.add(row.id);return true;}).map(row=>{
          const brand=this.franchiseName(row.place_name);
          return {id:String(row.id||''),name:String(row.place_name||''),category:String(row.category_name||''),
            address:String(row.road_address_name||row.address_name||''),phone:String(row.phone||''),
            distance:Number(row.distance)||Math.round(this.mapDistance({lat,lng},{lat:Number(row.y),lng:Number(row.x)})),
            lat:Number(row.y),lng:Number(row.x),franchise:!!brand,brand,placeUrl:String(row.place_url||'')};
        }).filter(row=>Number.isFinite(row.lat)&&Number.isFinite(row.lng)&&row.distance<=500).sort((a,b)=>a.distance-b.distance);
        if(this.state.ind===industry&&this.state.mapPoint&&this.mapDistance(this.state.mapPoint,{lat,lng})<5) this.setState({competitors:normalized,competitorsLoading:false});
      },{location:new K.LatLng(lat,lng),radius:500,size:15,sort:K.services.SortBy.DISTANCE});
    }).catch(()=>this.setState({competitors:[],competitorsLoading:false}));
  },

  paintKakaoMap(){
    if(this.state.screen!=='map'){this.destroyKakaoMap();return;}
    const el=document.getElementById('kakao-map'); if(!el) return;
    const key=String(this.state.kakaoMapKey||'');
    if(!key){this.destroyKakaoMap();this.kakaoMapStatus(el,this.t('map.unavailable'));return;}
    if(this._kakaoMap&&this._kakaoContainer){
      if(el!==this._kakaoContainer) el.replaceWith(this._kakaoContainer);
      this.syncKakaoMapLayers();
      requestAnimationFrame(()=>{if(this._kakaoMap&&document.body.contains(this._kakaoContainer)) this._kakaoMap.relayout();});
      return;
    }
    if(this._kakaoDrawPending) return;
    this._kakaoDrawPending=true;
    this.loadKakaoMapsSdk(key).then(()=>{if(this.state.screen==='map'&&!this._kakaoMap) this.drawKakaoMap(document.getElementById('kakao-map'));})
      .catch(()=>this.kakaoMapStatus(document.getElementById('kakao-map'),this.t('map.failed')))
      .finally(()=>{this._kakaoDrawPending=false;});
  },

  drawKakaoMap(el){
    if(!el) return; this.destroyKakaoMap();el.replaceChildren();
    const K=globalThis.kakao&&globalThis.kakao.maps; if(!K?.Map) return this.kakaoMapStatus(el,this.t('map.failed'));
    const point=this.state.mapPoint,center=point||{lat:37.5665,lng:126.9780};
    const map=new K.Map(el,{center:new K.LatLng(center.lat,center.lng),level:point?4:8}),markers=[];
    K.event.addListener(map,'click',event=>{const p=event.latLng;this.chooseMapPoint(p.getLat(),p.getLng(),'');});
    try{map.addControl(new K.ZoomControl(),K.ControlPosition.RIGHT);}catch(e){}
    this._kakaoMap=map;this._kakaoContainer=el;this._kakaoMarkers=markers;this._kakaoOverlays=[];
    this.syncKakaoMapLayers();
    if(typeof ResizeObserver!=='undefined'){
      this._kakaoResizeObserver=new ResizeObserver(()=>{if(this._kakaoMap&&document.body.contains(el)){map.relayout();const p=this.state.mapPoint||center;map.setCenter(new K.LatLng(p.lat,p.lng));}});
      this._kakaoResizeObserver.observe(el);
    }
  },

  buildMapView(base,sel,L,r,pickToggle,pickLabelOf){
    const S=this.state,point=S.mapPoint,hasPoint=!!point,comps=Array.isArray(S.competitors)?S.competitors:[];
    const mapZoneId=S.mapZoneId,hasZone=hasPoint&&!!mapZoneId&&!!sel&&sel.id===mapZoneId;
    const nearbyZones=hasPoint?this.nearbyZonesForIndustry(point.lat,point.lng,S.ind,500).slice(0,5).map(row=>({
      id:row.id,name:this.zoneLabelOf(row.name),distance:Math.round(row.distance)+'m',
      sales:this.won(row.sales/row.stores/3),active:row.id===mapZoneId,
      style:'width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;text-align:left;padding:11px 0;border-top:1px solid var(--line);background:transparent;cursor:pointer;color:var(--ink);'+(row.id===mapZoneId?'font-weight:700':'font-weight:500'),
      choose:()=>this.setState({sel:row.id,zoneId:row.id,mapZoneId:row.id,mapZoneDistance:Math.round(row.distance)})
    })):[];
    const fallback=(()=>{
      if(hasZone||!hasPoint||!S.mapGu||!S.zi||!S.zgu) return null;
      const indIndex=S.zi.inds.indexOf(S.ind);let stores=0,sales=0,zones=0;
      if(indIndex<0) return null;
      for(const [id,item] of Object.entries(S.zi.zones||{})){
        if(S.zgu[id]!==S.mapGu) continue;
        const row=(item.rows||[]).find(row=>row[0]===indIndex&&row[1]>0&&row[2]>0);
        if(!row) continue;stores+=Number(row[1]);sales+=Number(row[2]);zones++;
      }
      return stores&&sales?{gu:S.mapGu,value:this.won(sales/stores/3),stores,zones}:null;
    })();
    const franchise=comps.filter(o=>o.franchise),independent=comps.filter(o=>!o.franchise),brands={};
    franchise.forEach(o=>{const b=brands[o.brand]||(brands[o.brand]={count:0,distance:Infinity});b.count++;b.distance=Math.min(b.distance,Number(o.distance)||Infinity);});
    const brandRows=Object.entries(brands).sort((a,b)=>b[1].count-a[1].count).slice(0,5).map(([name,b])=>({name,
      value:b.count+this.t('common.place')+' · '+this.t('map.nearestDistance',{distance:Number.isFinite(b.distance)?Math.round(b.distance):'—'})}));
    const lp=hasZone&&S.zlp&&sel?S.zlp[sel.id]:null,loaded=Array.isArray(S.competitors),loading=!!S.competitorsLoading;
    const frRatio=loaded&&comps.length?Math.round(franchise.length/comps.length*100):null;
    const zone=hasZone&&sel&&S.zi&&S.zi.zones?S.zi.zones[sel.id]:null;
    const industries=((zone&&zone.rows)||[]).map(row=>({
      name:this.indName((S.zi.inds||[])[row[0]]||('업종 '+row[0])),
      stores:Number(row[1])||0,
      monthlyPer:Number(row[1])>0?Number(row[2])/Number(row[1])/3:0
    })).filter(row=>row.stores>0&&Number.isFinite(row.monthlyPer)&&row.monthlyPer>0);
    const stable=industries.filter(row=>row.stores>5).sort((a,b)=>b.monthlyPer-a.monthlyPer);
    const small=industries.filter(row=>row.stores<=5).sort((a,b)=>b.monthlyPer-a.monthlyPer);
    const recommendations=[...stable,...small].slice(0,3).map((row,index)=>({
      rank:this.t('map.rankLabel',{n:index+1}),name:row.name,value:this.won(row.monthlyPer),
      sample:row.stores+this.t('common.place')
    }));
    const demandStrong=lp&&Number(lp.tot)>=50000,compStrong=loaded&&comps.length>=15;
    const summary=!hasPoint?this.t('map.pickHint'):(!hasZone?this.t('map.noZoneNearby'):(demandStrong&&compStrong?this.t('map.summaryBoth')
      :(demandStrong?this.t('map.summaryDemand'):(compStrong?this.t('map.summaryCompetition'):this.t('map.summaryNeutral')))));
    const picked=sel&&(S.picks||[]).includes(sel.id);
    const metrics=hasZone&&sel?[
      {label:this.t('map.referenceSales'),value:this.won(sel.per/3),note:this.t('map.salesFormula',{stores:sel.stores.toLocaleString()})},
      {label:this.t('map.footTraffic'),value:lp?Math.round(lp.tot).toLocaleString()+this.t('common.people'):this.t('common.noData'),note:lp?this.t('map.dongBasis',{dong:this.placeName(lp.dong)}):''},
      {label:this.t('map.competitorCount'),value:loading?this.t('map.loadingShort'):(loaded?comps.length+this.t('common.place'):this.t('common.beforeLookup')),note:this.t('map.radiusBasis')},
      {label:this.t('map.franchise'),value:loaded?franchise.length+this.t('common.place'):this.t('common.beforeLookup'),note:''},
      {label:this.t('map.independent'),value:loaded?independent.length+this.t('common.place'):this.t('common.beforeLookup'),note:''},
      {label:this.t('map.franchiseRatio'),value:frRatio==null?this.t('common.beforeLookup'):frRatio+'%',note:this.t('map.brandEstimate')}
    ].map((metric,index)=>({...metric,
      valueStyle:index===0?this.ds('num'):this.ds('numSm')
    })):[];
    return {...base,map:{...(base.map||{}),loadingText:this.t('map.loading')},
      labels:{majorBrands:this.t('map.majorBrands'),detail:this.t('map.detail'),nearby:this.t('map.nearby'),
        nearbyTitle:this.t('map.nearbyTitle'),places:this.t('common.place'),radiusNote:this.t('map.radiusBasis'),
        loadingNearby:this.t('map.loadingNearby'),noNearby:this.t('map.noNearby'),
        recommendations:this.t('map.recommendations'),recommendationBasis:this.t('map.recommendationBasis'),
        overlapTitle:this.t('map.overlapTitle'),overlapNote:this.t('map.overlapNote'),regionReference:this.t('map.regionReference')},
      eyebrow:this.t('map.eyebrow'),target:this.t('map.title'),sub:this.t('map.sub'),
      indOptions:(S.zi?S.zi.inds:[]).map(n=>({raw:n,label:this.indName(n)})).sort((a,b)=>a.label.localeCompare(b.label,'ko')),
      indSel:S.ind,onIndSel:e=>this.changeMapIndustry(e.target.value),industryLabel:this.t('map.industryLabel'),
      query:S.mapQ||'',onQuery:e=>this.setState({mapQ:e.target.value,mapSearchMsg:''}),
      onSearchKey:e=>{if(e.key==='Enter'){e.preventDefault();this.searchMapAddress();}},search:()=>this.searchMapAddress(),
      searching:!!S.mapSearching,searchLabel:S.mapSearching?this.t('map.searching'):this.t('map.searchButton'),
      searchPlaceholder:this.t('map.searchPlaceholder'),searchMsg:S.mapSearchMsg||'',hasSearchMsg:!!S.mapSearchMsg,
      hasPoint,hasZone,showResult:hasZone,noZone:hasPoint&&!hasZone,needsPoint:!hasPoint,address:S.mapAddress||this.t('map.addressResolving'),
      noZoneTitle:this.t('map.noZoneTitle'),zone:hasZone&&sel?this.zoneLabelOf(sel.name):'',industry:this.indName(S.ind),period:this.qtr(r.quarter),
      nearbyZones,hasNearbyZones:nearbyZones.length>1,
      fallback:fallback?{...fallback,note:this.t('map.fallbackFormula',{zones:fallback.zones,stores:fallback.stores})}:null,hasFallback:!!fallback,
      metrics:metrics.slice(0,3),detailMetrics:metrics.slice(3),summary,
      brands:brandRows,hasBrands:brandRows.length>0,recommendations,hasRecommendations:recommendations.length>0,
      detail:()=>this.setState({screen:'fineDetail'}),togglePick:sel?pickToggle(sel):()=>{},
      openCompetitors:()=>this.setState({competitorsOpen:!S.competitorsOpen}),competitorsOpen:!!S.competitorsOpen,
      competitorCount:comps.length,togglePins:()=>this.setState({showCompetitorPins:!S.showCompetitorPins}),
      pinToggleLabel:S.showCompetitorPins?this.t('map.hideCompetitorPins'):this.t('map.showCompetitorPins'),
      competitors:comps.map(row=>({...row,kind:row.franchise?this.t('map.franchise'):this.t('map.independent'),
        distanceLabel:Number.isFinite(row.distance)?Math.round(row.distance)+'m':'—',phoneLabel:row.phone||this.t('map.noPhone'),
        focus:row.id===S.competitorFocus,rowStyle:'padding:15px 0;border-top:1px solid var(--line);'+(row.id===S.competitorFocus?'background:var(--accent-3)':'')})),
      competitorLoading:loading,competitorEmpty:loaded&&!loading&&!comps.length,picked,
      pickState:picked?this.t('map.saved'):this.t('map.save')};
  }
};
