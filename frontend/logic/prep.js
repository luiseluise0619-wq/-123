'use strict';
// 계약 전부터 오픈 직전까지만 다룬다. 체크리스트와 조언은 고른 업종·상권 자료에
// 연결하고, 인허가 내용은 공식 확인 링크를 함께 둔다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.prep = {
  prepView(){
    const S=this.state,ind=String(S.ind||''),prefix=ind+'::';
    const food=/음식점|커피|호프|치킨|분식|제과|패스트푸드|주점|반찬|일식|중식|양식|한식/.test(ind);
    const service=/미용|네일|피부|세탁|수리|강습|학원|의원|치과|한의원/.test(ind);
    const item=(id,labelKey,detailKey,source)=>{const storageId=prefix+id,checked=!!S.prepChecks[storageId];return {id,label:this.t(labelKey),detail:detailKey?this.t(detailKey):'',source:source||null,
      checked,checkText:checked?'✓':'',checkStyle:'width:24px;height:24px;border-radius:7px;border:1px solid var(--line-strong);color:var(--on-accent);font-weight:700;flex:none;cursor:pointer;background:'+(checked?'var(--accent)':'var(--card)'),
      toggle:()=>this.togglePrepCheck(storageId)};};
    const nts={label:this.t('prep.sourceNts'),url:'https://ems.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7777&mi=2444'};
    const foodSafety={label:this.t('prep.sourceFoodSafety'),url:'https://www.foodsafetykorea.go.kr/portal/board/boardDetail.do?bbs_no=bbs1021&menu_grp=MENU_NEW04&menu_no=3504'};
    const contract=[
      item('use','prep.itemUse','prep.itemUseDetail'),
      item('lease','prep.itemLease','prep.itemLeaseDetail'),
      item('premium','prep.itemPremium','prep.itemPremiumDetail'),
      item('power','prep.itemPower','prep.itemPowerDetail'),
      item('hvac','prep.itemHvac','prep.itemHvacDetail'),
      item('sign','prep.itemSign','prep.itemSignDetail'),
      item('parking','prep.itemParking','prep.itemParkingDetail')
    ];
    if(food) contract.splice(4,0,
      item('water','prep.itemWater','prep.itemWaterDetail'),
      item('exhaust','prep.itemExhaust','prep.itemExhaustDetail'),
      item('toilet','prep.itemToilet','prep.itemToiletDetail'));
    if(service) contract.push(item('noise','prep.itemNoise','prep.itemNoiseDetail'));
    const opening=[
      item('business','prep.itemBusiness','prep.itemBusinessDetail',nts),
      item('permit','prep.itemPermit','prep.itemPermitDetail'),
      ...(food?[item('hygiene','prep.itemHygiene','prep.itemHygieneDetail',foodSafety)]:[]),
      item('terminal','prep.itemTerminal','prep.itemTerminalDetail'),
      item('supplier','prep.itemSupplier','prep.itemSupplierDetail'),
      item('equipment','prep.itemEquipment','prep.itemEquipmentDetail'),
      item('menu','prep.itemMenu','prep.itemMenuDetail')
    ];
    const marketing=[
      item('naver','prep.itemNaver','prep.itemNaverDetail'),
      item('kakao','prep.itemKakao','prep.itemKakaoDetail'),
      item('walk','prep.itemWalk','prep.itemWalkDetail'),
      item('opening','prep.itemOpening','prep.itemOpeningDetail')
    ];
    const groups=[{title:this.t('prep.groupContract'),items:contract},{title:this.t('prep.groupOpening'),items:opening},{title:this.t('prep.groupMarketing'),items:marketing}];
    const all=groups.flatMap(g=>g.items),done=all.filter(o=>o.checked).length,pct=all.length?Math.round(done/all.length*100):0;

    let sel=null,rank=null;
    try{rank=this.rank();sel=rank&&rank.list.find(o=>o.id===S.sel);}catch(e){}
    const lp=sel&&S.zlp&&S.zlp[sel.id],comps=Array.isArray(S.competitors)?S.competitors:null;
    const advice=[];
    if(sel){
      advice.push({title:this.t('prep.adviceProfit'),basis:this.tn('prep.adviceProfitBasis',{sales:this.won(sel.per/3)}),
        action:this.t('prep.adviceProfitAction')});
    }
    if(lp){
      const ages=['10대','20대','30대','40대','50대','60대 이상'];let hi=0;lp.age.forEach((v,i)=>{if(v>lp.age[hi])hi=i;});
      advice.push({title:this.t('prep.adviceWalk'),basis:this.t('prep.adviceWalkBasis',{dong:this.placeName(lp.dong),people:this.nfmt(Math.round(lp.tot)),age:this.tr(ages[hi])}),
        action:this.t('prep.adviceWalkAction')});
    }
    if(comps){
      const fr=comps.filter(o=>o.franchise).length;
      advice.push({title:this.t(comps.length>=15?'prep.adviceCompete':'prep.adviceGap'),
        basis:this.t('prep.adviceCompetitorBasis',{total:this.nfmt(comps.length),fr:this.nfmt(fr)}),
        action:this.t(comps.length>=15?'prep.adviceCompeteAction':'prep.adviceGapAction')});
    }
    if(!advice.length) advice.push({title:this.t('prep.advicePick'),basis:this.t('prep.advicePickBasis'),action:this.t('prep.advicePickAction')});
    advice.push({title:this.t('prep.adviceListings'),basis:this.t('prep.adviceListingsBasis'),
      action:this.t('prep.adviceListingsAction')});

    return {eyebrow:this.t('prep.eyebrow'),title:this.t('prep.title',{ind:this.indName(ind)}),
      sub:this.t('prep.sub'),
      progress:this.t('prep.progress',{pct}),progressDetail:this.t('prep.progressDetail',{done,total:all.length}),
      progressBar:'display:block;width:'+pct+'%;height:100%;border-radius:999px;background:var(--accent);transition:width .2s',
      groups,advice:advice.slice(0,5),adviceTitle:this.t('prep.adviceTitle'),
      caution:this.t('prep.caution'),
      mapCta:this.t('prep.mapCta'),bepCta:this.t('prep.bepCta'),compareCta:this.t('prep.compareCta'),
      goMap:()=>this.setState({screen:'map'}),goCompare:()=>this.setState({screen:'sim'}),goBep:()=>this.setState({screen:'diag'}),
      hasPlace:!!sel,place:sel?this.zoneLabelOf(sel.name):this.t('prep.noPlace')};
  },

  togglePrepCheck(id){
    const checks={...(this.state.prepChecks||{}),[id]:!this.state.prepChecks[id]};
    this.setState({prepChecks:checks});
    try{localStorage.setItem('mysbizon.prepChecks.'+this.state.ind,JSON.stringify(checks));}catch(e){}
  }
};
