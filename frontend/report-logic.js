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
    // 이 리포트가 답하지 않는 것. 본전·비용은 여기서 다루지 않으므로 그 사실을 적는다.
    const UNKNOWN=[
      '신청 자격 — 이 리포트는 자격을 판정하지 않습니다. 답하신 조건과 겹치는 공고를 모았을 뿐이라, 실제 신청 가능 여부는 공고 원문에서 확인하셔야 합니다.',
      '손익의 정확도 — 매출은 이 자리에서 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아닙니다. 세금과 대출 이자는 빼지 않았습니다.',
      '건물별 임대료·보증금·권리금 — 동네 단위로 공개되지 않아 어느 화면에서도 답하지 못합니다.',
      '마감일을 읽지 못한 공고 — 상시 모집일 수도, 표기가 다른 것일 수도 있어 그대로 두었습니다.'
    ];

    if(!d) return {
      back:()=>history.back(),print:()=>window.print(),filled:false,
      hasSupport:false, hasBep:false, hasMoney:false, hasZones:false, hasSurvey:false,
      head:'값 없음', quarter:'—', today:today,
      lead:'아직 담을 값이 없습니다.',
      leadSub:'리포트 화면에서 설문에 답한 뒤 「미리보기」를 누르면 이 자리에 값이 채워집니다. 값이 없는 상태에서는 아무것도 지어내지 않습니다.',
      supportLead:'', support:[], bepLead:'', bep:[], money:[], zones:[], survey:[],
      unknown:UNKNOWN,
      footer:'값이 채워지면 이 자리에 출처를 적습니다. 지금은 담긴 값이 없어 출처를 적지 않습니다.'
    };

    const bar=(p,c)=>'display:block;width:'+Math.max(Math.min(p,100),2).toFixed(0)
      +'%;height:100%;border-radius:4px;background:'+(c||'var(--accent)')
      +';opacity:'+(0.42+0.58*Math.min(p,100)/100).toFixed(2);

    const ind=d.ind||'', zone=d.zone||'서울 전체', gu=d.gu||'';
    const SP=d.support||[], BP=d.bep||[], M=d.money||[], Z=d.zones||[], SV=d.survey||[];

    return {
      back:()=>history.back(),print:()=>window.print(),filled:true,
      hasSupport:SP.length>0, hasBep:BP.length>0, hasMoney:M.length>0,
      hasZones:Z.length>0, hasSurvey:SV.length>0,
      head:(ind?ind+' · ':'')+zone+(gu?' · '+gu:''),
      // 상권을 직접 고르지 않은 채 받은 리포트는 그렇다고 적는다.
      hasHeadNote:!!d.zoneAuto,
      headNote: d.zoneAutoGu
        ? '직접 고르신 상권이 아니라, '+d.zoneAutoGu+'에서 이 업종 1위인 상권으로 계산했습니다.'
        : '직접 고르신 상권이 아니라, 이 업종에서 1위인 상권으로 계산했습니다.',
      quarter:d.quarter||'—', today:today,
      lead:'받으실 수 있는 창업지원사업을 모았습니다.',
      leadSub:'아래는 답해 주신 조건과 겹치는 정부·지자체 공고입니다. 자격을 판정한 목록이 아니라 겹치는 조건을 찾아 모은 것이라, 신청 가능 여부는 반드시 공고 원문에서 확인해 주세요.',
      supportLead:'조건이 겹치는 순서로 적었습니다. 「왜 걸렸나」는 답하신 내용 중 이 공고와 맞닿은 부분입니다.',
      support:SP.map(x=>({
        title:x.title||'',
        meta:[x.org, x.amount].filter(Boolean).join(' · '),
        hasMeta:!!(x.org||x.amount),
        period:x.period||'상시 모집',
        why:x.why||'—',
        url:x.url||'', hasUrl:!!x.url
      })),
      // 손익은 리포트 결과물에만 들어간다(화면에는 없다). 그래서 여기서만 그린다.
      bepLead:'「이만큼 팔면 본전」은 고정비를 매출로 덮는 지점입니다. 알려주신 가게 조건으로 계산했고, 비워 두신 값은 기본 가정을 썼습니다. 줄마다 어느 쪽인지 적었습니다.',
      bep:BP,
      money:M.map(m=>({label:m.label, value:m.value, bar:bar(m.pct, m.warn?'var(--warn)':null)})),
      zones:Z, survey:SV,
      unknown:d.unknown||UNKNOWN,
      footer:'출처 · 공공데이터포털 창업지원사업 공고. 상권·업종 표기는 서울시 상권분석서비스와 서울 열린데이터광장 자료를 따릅니다. 공고 내용은 기관이 올린 원문을 그대로 옮긴 것이며 저희가 요약하거나 판정하지 않았습니다.'
    };
  }
}

return Component;
};
