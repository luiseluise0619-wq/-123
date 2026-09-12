'use strict';
// 정적 데이터·설정·지원사업 요청. 필수 데이터 오류와 선택 데이터 폴백을 구분한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.data = {
  loadData(url){return fetch(url,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw new Error('Data unavailable');return r;});},
  loadJson(url){
    const key=String(url||'').replace(/^\.\//,'');
    const embedded=globalThis.MysbizonBootstrap&&globalThis.MysbizonBootstrap.data&&globalThis.MysbizonBootstrap.data[key];
    return embedded!==undefined?Promise.resolve(embedded):this.loadData(url).then(r=>r.json());
  },
  // 지원사업 공고 — 리포트 화면에 처음 들어올 때 한 번만 부른다.
  // 키가 없으면 서버가 configured:false 로 답하고, 화면은 '아직 연결되지 않았습니다'를 띄운다.
  // 예시 공고를 지어내지 않는다(CLAUDE.md 데이터 정직성).
  loadSupport(){
    if(this._spLoading||this.state.sp) return;
    this._spLoading=true;
    fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',
      signal:AbortSignal.timeout(15000)})
      .then(r=>r.json())
      .then(j=>this.setState({sp:j}))
      .catch(()=>this.setState({sp:{ok:false,configured:true,items:[],
        error:'공고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}}))
      .finally(()=>{this._spLoading=false;});
  },

  // 최근 30일 개·폐업(지방행정인허가 → 상권 반경 500m). 수집 전이면 available:false 가 온다.
  // 정적 파일이지만 300KB 쯤 될 수 있어 첫 로드에 끼우지 않고 필요할 때 받는다.
  loadOpenings(){
    if(this._opLoading||this.state.op) return;
    this._opLoading=true;
    this.loadJson('data/v3/openings.json')
      .then(d=>{
        const ok = d && typeof d==='object' && !Array.isArray(d);
        const live = ok && d.available===true && d.zones && typeof d.zones==='object' && !Array.isArray(d.zones)
          && Number.isFinite(d.days) && Number.isFinite(d.radius_m);
        this.setState({op: live ? d : {available:false}});
      })
      .catch(()=>this.setState({op:{available:false}}))
      .finally(()=>{this._opLoading=false;});
  },

  loadInitialData(){
    Promise.all([
      // 모양이 깨진 파일은 파싱은 되지만 화면이 그 자리에서 터진다(util.dataShapeOk 주석 참고).
      // 상권 파일은 모든 화면의 뿌리라 모양이 다르면 통째로 '못 불러왔어요'로 떨어뜨리고,
      // 나머지는 '없는 것'과 같게 비워 둔다 — 화면은 그 자리만 정직하게 빠진다.
      this.loadJson('data/v3/zone_industry.json')
        .then(d=>{ if(!this.dataShapeOk('zi',d)) throw new Error('zone_industry: 모양이 다름'); return d; }),
      this.loadJson('data/v3/sales_by_industry.json')
        .then(d=>this.dataShapeOk('ind',d)?d:null).catch(()=>null),
      this.loadJson('data/v3/stores_by_industry.json')
        .then(d=>this.dataShapeOk('ind',d)?d:null).catch(()=>null),
      this.loadJson('data/v3/zone_gu.json').then(d=>this.dataShapeOk('gu',d)?d.gu:{}).catch(()=>({})),
      this.loadJson('data/v3/zone_border.json').then(d=>(d&&d.border)||{}).catch(()=>({})),
      this.loadJson('data/v3/seoul_map.json')
        .then(d=>this.dataShapeOk('map',d)?d:null).catch(()=>null),
      this.loadJson('data/v3/zone_livepop.json').then(d=>this.dataShapeOk('zone',d)?d.zone:{}).catch(()=>({})),
      this.loadJson('zone_rent.json').then(d=>(d&&d.available!==false&&d.zones)||null).catch(()=>null),
      this.loadJson('data/v3/rent.json').catch(()=>null),
      this.loadJson('data/v3/sales_history.json')
        .then(d=>this.dataShapeOk('hist',d)?d:null).catch(()=>null),
      this.loadJson('data/v3/income.json').catch(()=>null),
      // 상권 생존(평균 영업기간·상권변화 등급)과 닮은 상권. 둘 다 이미 수집해 둔 자료를
      // build_v3.py 가 화면에 필요한 만큼만 깎아 낸 것이다(각 10KB·12KB gzip).
      this.loadJson('data/v3/zone_change.json')
        .then(d=>(d&&typeof d==='object'&&!Array.isArray(d))?d:null).catch(()=>null),
      this.loadJson('data/v3/zone_sim.json').then(d=>this.dataShapeOk('zone',d)?d.zone:null).catch(()=>null)
    ]).then(([zi,sbi,sti,zgu,zbd,smap,zlp,zoneRent,rent,hist,income,zchg,zsim])=>this.setState({zi,sbi,sti,zgu,zbd,smap,zoneRent,zchg,zsim,zlp:Object.fromEntries(Object.entries(zlp||{}).filter(([,v])=>v&&Number.isFinite(v.tot)&&v.tot>0&&Array.isArray(v.age)&&v.age.length===6&&v.age.every(Number.isFinite))),rentStats:rent,salesHistory:hist,income}))
      .catch(()=>this.setState({err:'분석 자료를 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.'}));
  },
  loadConfig(){
    return this.loadData('/api/config').then(r=>r.json())
      .then(c=>{
        const key=String(c.kakaoMap?.javascriptKey||'');
        this.setState({
          reportEmailEnabled:!!c.reportEmailEnabled,
          customerData:c.customerData,
          kakaoMapKey:c.kakaoMap?.enabled&&/^[A-Za-z0-9_-]{16,128}$/.test(key)?key:'',
        });
      }).catch(()=>{});
  },

};
