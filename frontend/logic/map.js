'use strict';
// 카카오 지도는 지도 화면에 들어왔을 때만 받는다. 키는 서버 설정에서 오고 SDK
// 주소는 이 파일의 고정된 Kakao 도메인만 사용한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.map = {
  kakaoMapStatus(el,text){
    if(!el) return;
    el.replaceChildren();
    const msg=document.createElement('span');
    msg.textContent=text;
    Object.assign(msg.style,{padding:'14px 16px',color:'var(--ink3)',fontSize:'14px',lineHeight:'1.6'});
    el.appendChild(msg);
  },

  loadKakaoMapsSdk(key){
    if(globalThis.kakao?.maps?.Map) return Promise.resolve(globalThis.kakao.maps);
    if(globalThis.__mysbizonKakaoMapsPromise) return globalThis.__mysbizonKakaoMapsPromise;
    globalThis.__mysbizonKakaoMapsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.id='mysbizon-kakao-maps-sdk';
      script.async=true;
      script.src='https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey='+encodeURIComponent(key);
      script.referrerPolicy='strict-origin-when-cross-origin';
      script.onload=()=>{
        if(!globalThis.kakao?.maps?.load) return reject(new Error('Kakao Maps SDK unavailable'));
        globalThis.kakao.maps.load(()=>resolve(globalThis.kakao.maps));
      };
      script.onerror=()=>reject(new Error('Kakao Maps SDK failed to load'));
      document.head.appendChild(script);
    }).catch(error=>{
      globalThis.__mysbizonKakaoMapsPromise=null;
      throw error;
    });
    return globalThis.__mysbizonKakaoMapsPromise;
  },

  destroyKakaoMap(){
    if(this._kakaoResizeObserver){this._kakaoResizeObserver.disconnect();this._kakaoResizeObserver=null;}
    for(const overlay of this._kakaoOverlays||[]){try{overlay.setMap(null);}catch(e){}}
    this._kakaoOverlays=[];
    this._kakaoMap=null;
    this._kakaoContainer=null;
    this._kakaoBounds=null;
  },

  kakaoInfoCard(pin){
    const card=document.createElement('section');
    card.setAttribute('aria-label',this.t('map.summary',{zone:pin.name}));
    Object.assign(card.style,{
      width:'min(292px, calc(100vw - 56px))',padding:'15px 16px',borderRadius:'16px',
      border:'1px solid var(--line-strong)',background:'var(--card)',color:'var(--ink)',
      boxShadow:'0 14px 34px rgba(0,0,0,.22)',fontFamily:'inherit',lineHeight:'1.35',
      pointerEvents:'auto'
    });
    const title=document.createElement('strong');
    title.textContent=pin.name;
    Object.assign(title.style,{display:'block',fontSize:'16px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});
    const current=document.createElement('div');
    current.textContent=this.t('map.currentIndustry',{industry:pin.industry});
    Object.assign(current.style,{marginTop:'3px',fontSize:'12px',color:'var(--ink3)'});
    const metrics=document.createElement('div');
    Object.assign(metrics.style,{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'12px'});
    for(const [label,value] of [[this.t('map.monthlyPerStore'),pin.monthlyPer],[this.t('map.stores'),pin.stores]]){
      const cell=document.createElement('div');
      Object.assign(cell.style,{minWidth:'0',padding:'9px 10px',borderRadius:'10px',background:'var(--surface)'});
      const small=document.createElement('span');small.textContent=label;
      Object.assign(small.style,{display:'block',fontSize:'10.5px',color:'var(--ink3)'});
      const big=document.createElement('b');big.textContent=value;
      Object.assign(big.style,{display:'block',marginTop:'3px',fontSize:'13px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});
      cell.append(small,big);metrics.appendChild(cell);
    }
    card.append(title,current,metrics);
    if(pin.recommendations&&pin.recommendations.length){
      const heading=document.createElement('div');
      heading.textContent=this.t('map.recommendations');
      Object.assign(heading.style,{marginTop:'12px',fontSize:'11px',fontWeight:'700',color:'var(--ink2)'});
      const list=document.createElement('ol');
      Object.assign(list.style,{listStyle:'none',margin:'6px 0 0',padding:'0',display:'grid',gap:'4px'});
      for(const row of pin.recommendations){
        const item=document.createElement('li');
        Object.assign(item.style,{display:'flex',alignItems:'baseline',gap:'7px',fontSize:'12px'});
        const rank=document.createElement('b');rank.textContent=this.t('map.rank',{n:row.rank});
        Object.assign(rank.style,{flex:'none',color:'var(--accent-text)'});
        const name=document.createElement('span');name.textContent=row.name;
        Object.assign(name.style,{flex:'1',minWidth:'0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});
        const value=document.createElement('span');value.textContent=row.value;
        Object.assign(value.style,{flex:'none',color:'var(--ink2)'});
        item.append(rank,name,value);list.appendChild(item);
      }
      const basis=document.createElement('div');basis.textContent=this.t('map.recommendationBasis');
      Object.assign(basis.style,{marginTop:'7px',fontSize:'10px',color:'var(--ink3)'});
      card.append(heading,list,basis);
    }
    return card;
  },

  paintKakaoMap(){
    if(this.state.screen!=='map') {this.destroyKakaoMap();return;}
    const el=document.getElementById('kakao-map');
    if(!el) return;
    const key=String(this.state.kakaoMapKey||'');
    const pins=(this._kakaoPins||[]).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
    if(!key){this.destroyKakaoMap();this.kakaoMapStatus(el,this.t('map.unavailable'));return;}
    if(!pins.length){this.destroyKakaoMap();this.kakaoMapStatus(el,this.t('map.noPosition'));return;}
    this.loadKakaoMapsSdk(key).then(()=>{
      if(this.state.screen!=='map') return;
      const current=document.getElementById('kakao-map');
      if(!current) return;
      this.drawKakaoMap(current,pins);
    }).catch(()=>{
      const current=document.getElementById('kakao-map');
      if(current) this.kakaoMapStatus(current,this.t('map.failed'));
    });
  },

  drawKakaoMap(el,pins){
    this.destroyKakaoMap();
    el.replaceChildren();
    const K=globalThis.kakao?.maps;
    if(!K?.Map) return this.kakaoMapStatus(el,this.t('map.failed'));
    const first=pins.find(p=>p.on)||pins[0];
    const map=new K.Map(el,{center:new K.LatLng(first.lat,first.lng),level:4});
    const bounds=new K.LatLngBounds(), overlays=[];
    for(const p of pins){
      const position=new K.LatLng(p.lat,p.lng);
      bounds.extend(position);
      const button=document.createElement('button');
      button.type='button';
      button.textContent=String(p.n);
      button.title=p.name;
      button.setAttribute('aria-label',this.t('map.pick',{zone:p.name}));
      Object.assign(button.style,{
        width:p.on?'38px':'32px',height:p.on?'38px':'32px',borderRadius:'50%',
        border:'3px solid var(--card)',background:p.on?'var(--accent)':'var(--ink2)',
        color:p.on?'var(--on-accent)':'var(--card)',fontSize:'13px',fontWeight:'700',
        boxShadow:'0 5px 16px rgba(25,31,40,.24)',cursor:'pointer',padding:'0',
      });
      button.addEventListener('click',p.pick);
      const overlay=new K.CustomOverlay({map,position,content:button,xAnchor:.5,yAnchor:.5,zIndex:p.on?10:2});
      overlays.push(overlay);
      if(p.on){
        const info=new K.CustomOverlay({map,position,content:this.kakaoInfoCard(p),xAnchor:.5,yAnchor:1.22,zIndex:30});
        overlays.push(info);
      }
    }
    if(pins.length>1) map.setBounds(bounds,46,46,46,46);
    else map.setLevel(4);
    try{map.addControl(new K.ZoomControl(),K.ControlPosition.RIGHT);}catch(e){}
    this._kakaoMap=map;
    this._kakaoContainer=el;
    this._kakaoBounds=bounds;
    this._kakaoOverlays=overlays;
    if(typeof ResizeObserver!=='undefined'){
      this._kakaoResizeObserver=new ResizeObserver(()=>{
        if(this._kakaoMap&&document.body.contains(el)){
          this._kakaoMap.relayout();
          if(pins.length>1)this._kakaoMap.setBounds(bounds,46,46,46,46);
          else this._kakaoMap.setCenter(new K.LatLng(first.lat,first.lng));
        }
      });
      this._kakaoResizeObserver.observe(el);
    }
  },
};
