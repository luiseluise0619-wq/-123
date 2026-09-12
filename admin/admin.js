'use strict';
const el=id=>document.getElementById(id);
let token='',kind='surveys',before='',next=null,rows=[],lockTimer;
const labels={id:'제출 ID',createdAt:'제출 시각',email:'이메일',sido:'시·도',gu:'구',industry:'업종',stage:'창업 단계',age:'연령 구간',business:'사업자 상태',when:'창업 시기',need:'지원 관심',cost:'예산',privacyVersion:'동의 문구 버전',expiresAt:'삭제 예정일',day:'날짜',event:'버튼',device:'기기',count:'클릭 수'};
function lock({clearKey=true}={}){token='';rows=[];el('table').replaceChildren();el('workspace').hidden=true;el('login').hidden=false;el('logout').hidden=true;if(clearKey)el('key').value='';el('search').value='';clearTimeout(lockTimer);}
async function request(path,body={}){
  // 같은 URL의 Nginx Basic 인증도 Authorization 헤더를 쓴다. 2차 키까지
  // 그 헤더에 넣으면 브라우저가 기억한 1차 인증과 서로 덮어쓰므로 전용 헤더로 분리한다.
  const response=await fetch('api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Mysbizon-Admin-Key':token},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok){
    let message='요청을 처리하지 못했습니다.';
    try{const data=await response.json();if(data&&data.error)message=data.error;}catch{}
    if(response.status===401||(response.status===403&&message.includes('2차 관리자 키'))){lock({clearKey:false});message='2차 관리자 키가 맞지 않습니다.';}
    else if(response.status===429)message='입력 횟수가 많아 잠시 잠겼습니다. 60초 뒤 다시 시도해 주세요.';
    throw new Error(message+' ('+response.status+')');
  }
  return response;
}
function paint(){
  const table=el('table');table.replaceChildren();const keys=kind==='surveys'?Object.keys(labels).slice(0,14):['day','event','device','count'];
  const head=document.createElement('tr');for(const key of keys){const th=document.createElement('th');th.textContent=labels[key];head.append(th);}if(kind==='surveys'){const th=document.createElement('th');th.textContent='관리';head.append(th);}table.append(head);
  const query=el('search').value.toLocaleLowerCase();
  for(const row of rows.filter(r=>Object.values(r).some(v=>String(v).toLocaleLowerCase().includes(query)))){
    const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=row[key]??'';tr.append(td);}
    if(kind==='surveys'){const td=document.createElement('td'),button=document.createElement('button');button.textContent='삭제';button.onclick=()=>run(async()=>{if(!confirm('이 설문과 이메일을 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;await request('delete',{id:row.id});await load();});td.append(button);tr.append(td);}table.append(tr);
  }
  el('more').hidden=!next;el('description').textContent=kind==='surveys'?'최근 제출부터 100건씩 표시해요. 검색은 현재 페이지에 적용되고, CSV에는 검색 전 현재 페이지가 저장돼요.':'최근 30일의 버튼별 클릭 집계예요. 고유 고객 수가 아니며, 통계 동의한 방문자의 클릭만 포함해요.';
}
async function load(){const data=await(await request(kind==='surveys'?'list':'clicks',{before,reveal:el('reveal').checked})).json();rows=data.rows;next=data.next;paint();el('status').textContent=rows.length+'건을 불러왔어요.';}
async function run(fn){try{el('status').textContent='처리 중…';await fn();}catch(e){el('status').textContent=e.message;}}
el('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{token=el('key').value.trim();if(!/^[a-f0-9]{64}$/i.test(token))throw new Error('2차 관리자 키는 공백 없는 영문·숫자 64자리입니다.');await load();el('key').value='';el('login').hidden=true;el('workspace').hidden=false;el('logout').hidden=false;clearTimeout(lockTimer);lockTimer=setTimeout(()=>{lock();el('status').textContent='15분이 지나 잠겼어요.';},15*60000);});};
el('logout').onclick=lock;
for(const k of ['surveys','clicks'])el(k).onclick=()=>run(async()=>{kind=k;before='';el('surveys').setAttribute('aria-pressed',String(k==='surveys'));el('clicks').setAttribute('aria-pressed',String(k==='clicks'));await load();});
el('refresh').onclick=()=>run(load);el('reveal').onchange=()=>run(load);el('search').oninput=paint;
el('more').onclick=()=>run(async()=>{before=next||'';await load();});
el('export').onclick=()=>run(async()=>{if(el('reveal').checked&&!confirm('이메일 원문이 포함된 파일을 이 PC에 내려받을까요?'))return;const response=await request('export',{kind,before,reveal:el('reveal').checked}),url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download='mysbizon-'+kind+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('status').textContent='CSV를 내려받았어요. 다운로드한 개인정보 파일도 안전하게 보관해 주세요.';});
window.addEventListener('pagehide',lock);
