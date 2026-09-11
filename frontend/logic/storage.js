'use strict';
// 브라우저 저장 상태의 허용 필드·복원·저장. 기기/탭 단위 저장 정책을 유지한다.
globalThis.MysbizonParts = globalThis.MysbizonParts || {};
globalThis.MysbizonParts.storage = {
  saveMyShop(id){
    const next = this.state.myShop===id ? null : id;
    this.setState({myShop:next});
    try{ if(next) localStorage.setItem('mysbizon.myShop', next); else localStorage.removeItem('mysbizon.myShop'); }catch(e){}
  },

  // 저장해 둔 설문 답을 '믿을 수 있는 값만' 골라 되살린다.
  // 이 목록이 곧 '설문이 기억하는 것'의 정의다.
  SURVEY_KEYS(){
    return ['ind','sel','zoneId','homeZoneName','area','rent','staffOv','etcOv','cogs','scen',
      'rp_sido','rp_gu','rp_ind','rp_stage','rp_age','rp_biz','rp_when','rp_need',
      'rp_cost','rp_email','rp_agree','rp_step'];
  },
  surveyRestore(saved){
    const restore={};
    if(!saved || typeof saved!=='object') return restore;
    for(const k of this.SURVEY_KEYS()){
      const v=saved[k];
      if(v===null||typeof v==='string'||typeof v==='number'||typeof v==='boolean') restore[k]=v;
    }
    // 어느 칸을 직접 넣었는지도 되살린다(리포트가 '기본 가정'과 구분해 적는다)
    if(saved.rp_touched && typeof saved.rp_touched==='object'){
      const t={};
      for(const k of ['rent','area','staffOv']) if(saved.rp_touched[k]===true) t[k]=true;
      restore.rp_touched=t;
    }
    if(Array.isArray(saved.picks)) restore.picks=saved.picks.filter(v=>typeof v==='string').slice(0,5);
    return restore;
  },
  // 새로고침을 대비해 담아 둔다. 값이 그대로면 쓰지 않는다.
  saveSurvey(){
    try{
      const S=this.state, out={};
      for(const k of this.SURVEY_KEYS()) out[k]=S[k]===undefined?null:S[k];
      out.rp_touched=S.rp_touched||{};
      out.picks=S.picks||[];
      const raw=JSON.stringify(out);
      if(raw===this._surveyRaw) return;
      this._surveyRaw=raw;
      sessionStorage.setItem('mysbizon.survey', raw);
    }catch(e){}
  },
};
