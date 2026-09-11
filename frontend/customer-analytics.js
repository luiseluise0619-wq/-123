'use strict';
// Only explicit, fixed event IDs are transmitted; never DOM text, URLs, email or field values.
(async()=>{
  const allowed=new Set(['nav.zone','nav.fine','nav.price','nav.report','comparison.add','market.filter','report.preview','report.csv','report.email','survey.save']);
  let config;try{config=await(await fetch('/api/config')).json();}catch{return;}
  if(!config.customerData?.enabled)return;
  const language=document.documentElement.lang||'ko';
  const words=language.startsWith('en')?['Usage statistics','Allow anonymous button click counts? No email or answers are included.','Allow','Decline','Save settings']:language.startsWith('zh')?['使用统计','允许匿名按钮点击统计？不包含邮箱或问卷答案。','允许','拒绝','保存设置']:['이용 통계 설정','익명 버튼 클릭 집계를 허용할까요? 이메일과 설문 답은 포함하지 않아요.','허용','거절','설정 저장'];
  let agreed=false,known=false;
  try{const saved=localStorage.getItem('mysbizon.analytics-consent');known=saved!==null;agreed=saved==='yes';}catch{}
  const open=document.createElement('button');open.className='analytics-settings';open.textContent=words[0];
  const panel=document.createElement('dialog');panel.className='analytics-dialog';const text=document.createElement('p');text.textContent=words[1];panel.append(text);
  for(const [label,value] of [[words[2],true],[words[3],false]]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{agreed=value;try{localStorage.setItem('mysbizon.analytics-consent',value?'yes':'no');}catch{}panel.close();};panel.append(button);}
  document.body.append(open,panel);open.onclick=()=>panel.showModal();
  // No blocking popup on entry. Visitors can opt in through the persistent settings button.
  if(!known)open.textContent=words[0]+' · '+(language.startsWith('ko')?'선택':'optional');
  let last=0;
  function record(event){
    const target=event.target.closest?.('[data-track]');if(!agreed||!target||target.disabled)return;
    if(target.tagName==='SELECT'&&event.type!=='change')return;
    const id=target.dataset.track;if(!allowed.has(id)||Date.now()-last<250)return;last=Date.now();
    const width=window.innerWidth,device=width<600?'mobile':width<1100?'tablet':'desktop';
    fetch('/api/customer-event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:id,device,agreed:true}),keepalive:true}).catch(()=>{});
  }
  document.addEventListener('click',record);document.addEventListener('change',record);
})();
