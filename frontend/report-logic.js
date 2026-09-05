'use strict';
globalThis.MysbizonLogic = function(DCLogic, React) {

class Component extends DCLogic {
  state = { d: null };

  componentDidMount(){
    // 본 화면이 '인쇄 미리보기'를 누를 때 써 둔 값을 읽는다. 없으면 지어내지 않는다.
    try{
      const raw=sessionStorage.getItem('mysbizon.report');
      sessionStorage.removeItem('mysbizon.report');
      if(raw) this.setState({d:JSON.parse(raw)});
    }catch(e){}
  }

  renderVals(){
    const d=this.state.d;
    const today=(()=>{ const t=new Date();
      return t.getFullYear()+'년 '+(t.getMonth()+1)+'월 '+t.getDate()+'일'; })();
    const UNKNOWN=[
      '건물별 임대료와 보증금 — 동네 단위로 공개되지 않아 직접 넣으신 값으로만 계산했습니다.',
      '권리금과 인테리어 비용 — 이 계산에 들어가지 않았습니다.',
      '건물 공실 여부와 층수 — 현재 연결한 자료에는 없습니다.',
      '가게별 매출 분포 — 현재 자료에 점포별 매출 분포가 없어 잘하는 가게와 못하는 가게를 나눠 볼 수 없습니다.'
    ];

    if(!d) return {
      back:()=>history.back(),print:()=>window.print(),filled:false, hasMoney:false, hasZones:false, hasSurvey:false,
      head:'값 없음', quarter:'—', today:today,
      score:'—', grade:'', bepLead:'',
      lead:'아직 담을 값이 없습니다.',
      leadSub:'리포트 화면에서 장사와 위치를 고르고 「인쇄 미리보기」를 누르면 이 자리에 값이 채워집니다. 값이 없는 상태에서는 아무것도 지어내지 않습니다.',
      parts:[], bep:[], money:[], zones:[], survey:[],
      unknown:UNKNOWN,
      footer:'값이 채워지면 이 자리에 출처를 적습니다. 지금은 계산된 값이 없어 출처를 적지 않습니다.'
    };

    const bar=(p,c)=>'display:block;width:'+Math.max(Math.min(p,100),2).toFixed(0)
      +'%;height:100%;border-radius:4px;background:'+(c||'var(--accent)')
      +';opacity:'+(0.42+0.58*Math.min(p,100)/100).toFixed(2);

    const ind=d.ind||'', zone=d.zone||'서울 전체', gu=d.gu||'';
    const P=d.parts||[], M=d.money||[], Z=d.zones||[], SV=d.survey||[];

    return {
      back:()=>history.back(),print:()=>window.print(),filled:true,
      hasMoney:M.length>0, hasZones:Z.length>0, hasSurvey:SV.length>0,
      head:(ind?ind+' · ':'')+zone+(gu?' · '+gu:''),
      quarter:d.quarter||'—', today:today,
      score:d.score!=null?Math.round(d.score):'—',
      grade:d.grade?d.grade+' · 100점 만점':'100점 만점',
      lead:d.lead||(zone+'에서 '+ind+' 분석 결과입니다.'),
      leadSub:'아래 숫자는 서울시가 공표한 카드 결제와 가게 수에서 계산했고, 임대료와 평수는 입력값 또는 기본 가정입니다. 값마다 어떻게 나왔는지 옆에 적었습니다.',
      bepLead:'「이만큼 팔면 본전」은 고정비를 매출로 덮는 지점입니다. 고정비나 원가율을 바꾸면 이 값이 달라집니다. 매출 가정은 예상 손익에 영향을 줍니다.',
      parts:P.map(p=>({label:p.label, value:p.value, bar:bar(p.pct)})),
      bep:d.bep||[],
      money:M.map(m=>({label:m.label, value:m.value, bar:bar(m.pct, m.warn?'var(--warn)':null)})),
      zones:Z, survey:SV,
      unknown:d.unknown||UNKNOWN,
      footer:'출처 · 서울시 상권분석서비스(매출·가게 수·손님 구성), 서울 열린데이터광장. 자치구는 상권 중심 좌표를 서울시 행정구역 경계와 대조해 계산했습니다. 「추정」은 손님이 쓴 돈을 가게 수로 나눈 값이라 어느 한 가게의 실적이 아닙니다. 「직접 입력」은 사용자가 넣은 값입니다. 이 스냅샷에는 동네별 매출 상위 15개 업종만 포함되므로, 목록에 없는 장사는 안 되는 것이 아니라 알 수 없는 것입니다.'
    };
  }
}

return Component;
};
