'use strict';
(async()=>{
  const list=document.getElementById('privacy-status');
  const operator=document.getElementById('privacy-operator');
  if(!list)return;
  const item=text=>{const li=document.createElement('li');li.textContent=text;return li;};
  try{
    const response=await fetch('/api/config',{credentials:'same-origin',headers:{accept:'application/json'}});
    if(!response.ok)throw new Error('config unavailable');
    const config=await response.json();
    const customer=config.customerData||{};
    list.replaceChildren(
      item('이메일 리포트 발송: '+(config.reportEmailEnabled?'켜짐 · 동의 후 발송':'꺼짐')),
      item('설문·이메일 DB 저장: '+(customer.enabled?'켜짐 · 별도 동의 후 저장':'꺼짐')),
      item('익명 클릭 통계: '+(customer.enabled?'선택 동의 후 집계':'꺼짐'))
    );
    operator.textContent=customer.enabled
      ? '운영 주체: '+(customer.controller||'미표시')+' · 문의: '+(customer.contact||'미표시')+' · 보유 기간: '+(customer.retentionDays||0)+'일'
      : '고객정보 저장이 꺼져 있어 운영 주체·문의처·보유 기간을 수집 화면에 표시하지 않습니다.';
  }catch(error){
    list.replaceChildren(item('현재 설정을 불러오지 못했습니다. 분석 입력과 개인정보 저장은 별도 동의 흐름으로 구분됩니다.'));
    operator.textContent='';
  }
})();
