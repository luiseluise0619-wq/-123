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
