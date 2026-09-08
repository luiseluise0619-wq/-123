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
    // 화면에서 고른 언어를 인쇄본도 따른다. 한국어면 아무 일도 하지 않는다.
    var I=globalThis.MysbizonReportI18n;
    // 사전은 나중에 온다. 이름을 끼워 만든 문장은 다시 그려야 옮겨진다.
    if(I) I.load().then(()=>{ if(this.forceUpdate) this.forceUpdate(); I.apply(); });
  }

  // 다시 그릴 때마다 한 번 더 훑는다 — 이미 옮긴 글자에는 한글이 없어 그냥 지나간다.
  componentDidUpdate(){
    var I=globalThis.MysbizonReportI18n;
    if(I) I.apply();
  }

  renderVals(){
    const d=this.state.d;
    // 인쇄본은 그린 뒤 DOM 을 훑어 옮기지만, 이름을 끼워 만드는 문장은 미리 옮겨야 한다.
    const I=globalThis.MysbizonReportI18n;
    const TR=s=>(I&&I.tr)? I.tr(s) : s;
    const today=(()=>{ const t=new Date();
      return t.getFullYear()+'년 '+(t.getMonth()+1)+'월 '+t.getDate()+'일'; })();
    // 이 리포트가 답하지 않는 것. 본전·비용은 여기서 다루지 않으므로 그 사실을 적는다.
    const UNKNOWN=[
      '신청 자격 — 이 리포트는 자격을 판정하지 않아요. 답하신 조건과 겹치는 공고를 모았을 뿐이라, 실제 신청 가능 여부는 공고 원문에서 확인해 주세요.',
      '손익의 정확도 — 매출은 이 자리에서 손님이 쓴 돈을 가게 수로 나눈 추정값이라 어느 한 가게의 실적이 아니에요. 세금과 대출 이자는 빼지 않았어요.',
      '건물별 임대료·보증금·권리금 — 동네 단위로 공개되지 않아 어느 화면에서도 답하지 못해요.',
      '마감일을 읽지 못한 공고 — 상시 모집일 수도, 표기가 다른 것일 수도 있어 그대로 두었어요.'
    ];

    if(!d) return {
      back:()=>history.back(),print:()=>window.print(),filled:false,
      hasSupport:false, hasBep:false, hasMoney:false, hasZones:false, hasSurvey:false,
      head:'값 없음', quarter:'—', today:today,
      lead:'아직 담을 값이 없어요.',
      leadSub:'리포트 화면에서 설문에 답한 뒤 「미리보기」를 누르면 이 자리에 값이 채워져요. 값이 없을 때는 아무것도 지어내지 않아요.',
      supportLead:'', support:[], bepLead:'', bep:[], money:[], zones:[], survey:[],
      unknown:UNKNOWN,
      footer:'값이 채워지면 이 자리에 출처를 적어요. 지금은 담긴 값이 없어 출처를 적지 않아요.'
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
      // 구 이름이 문장 안에 들어가면 통째로는 사전에서 못 찾는다 — 옮긴 뒤 이름을 끼운다
      headNote: d.zoneAutoGu
        ? TR('직접 고르신 상권이 아니라, {0}에서 이 업종 1위인 상권으로 계산했어요.')
            .split('{0}').join(d.zoneAutoGu)
        : TR('직접 고르신 상권이 아니라, 이 업종에서 1위인 상권으로 계산했어요.'),
      quarter:d.quarter||'—', today:today,
      // 공고가 하나도 없을 때 '모았습니다' 라고 적으면 없는 것을 약속하는 셈이다(§1).
      // 그때는 이 리포트가 실제로 담은 것(손익)을 제목으로 삼는다.
      lead: SP.length
        ? '받으실 수 있는 창업지원사업을 모았어요.'
        : '알려주신 조건으로 손익을 계산했어요.',
      leadSub: SP.length
        ? '아래는 답해 주신 조건과 겹치는 정부·지자체 공고예요. 자격을 판정한 목록이 아니라 겹치는 조건을 찾아 모은 것이라, 신청 가능 여부는 반드시 공고 원문에서 확인해 주세요.'
        : '창업지원사업 공고는 아직 연결되지 않아 이 리포트에 담지 못했어요. 연결되면 답해 주신 조건과 겹치는 공고가 이 자리에 함께 들어가요.',
      // 가장 큰 금액도 같이 적는다. 자격을 판정한 값이 아니라 '공고에 적힌' 금액이다(§1·§17).
      supportLead:'조건이 겹치는 순서로 적었어요. 「왜 걸렸나」는 답하신 내용 중 이 공고와 맞닿은 부분이에요.'
        +(d.supportMax? ' 아래 공고 중 가장 큰 금액: 「'+d.supportMax.title+'」 '+d.supportMax.amount+' (공고에 적힌 금액이에요).' : ''),
      support:SP.map(x=>({
        title:x.title||'',
        meta:[x.org, x.amount].filter(Boolean).join(' · '),
        hasMeta:!!(x.org||x.amount),
        period:x.period||'상시 모집',
        why:x.why||'—',
        url:x.url||'', hasUrl:!!x.url
      })),
      // 손익은 리포트 결과물에만 들어간다(화면에는 없다). 그래서 여기서만 그린다.
      bepLead:'「이만큼 팔면 본전」은 고정비를 매출로 덮는 지점이에요. 알려주신 가게 조건으로 계산했고, 비워 두신 값은 기본 가정을 썼어요. 줄마다 어느 쪽인지 적었어요.',
      bep:BP,
      money:M.map(m=>({label:m.label, value:m.value, bar:bar(m.pct, m.warn?'var(--warn)':null)})),
      zones:Z, survey:SV,
      unknown:d.unknown||UNKNOWN,
      // 공고를 못 담았으면 공고 출처를 적지 않는다 — 쓰지 않은 자료를 출처로 적으면 안 된다.
      footer: (SP.length
          ? '출처 · 공공데이터포털 창업지원사업 공고. '
          : '출처 · ')
        + '상권·업종 표기는 서울시 상권분석서비스와 서울 열린데이터광장 자료를 따라요.'
        + (SP.length ? ' 공고 내용은 기관이 올린 원문을 그대로 옮긴 것이고, 저희가 요약하거나 판정하지 않았어요.' : '')
    };
  }
}

return Component;
};
