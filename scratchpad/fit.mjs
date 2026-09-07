import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1500);} }
const go=async(t)=>{ const l=p.locator(`text="${t}"`).first(); if(await l.count()){ await l.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(1500);} };
await go('정밀분석');
for (const it of await p.locator('[role="button"]:visible').all()){ const t=(await it.innerText().catch(()=>''))||''; if(/본전/.test(t)){ await it.click().catch(()=>{}); await p.waitForTimeout(1800); break; } }
const cands=['보증금·권리금·인테리어를 넣으면 회수기간도 계산해 드려요',
 '보증금·권리금·인테리어를 넣으면 회수기간도 나와요',
 '보증금·권리금·인테리어를 넣으면 회수기간이 나와요',
 '보증금·권리금·인테리어도 넣으면 회수기간이 나와요',
 '초기투자를 넣으면 회수기간도 계산해 드려요',
 '초기투자를 넣으면 회수기간도 나와요',
 '보증금·권리금·인테리어를 넣어 주세요',
 '하루 93건이 본전선인데, 이 매출이면 넘어요',
 '이 매출이면 인건비·임대료를 덮어요'];
console.log(await p.evaluate(cs=>{
  const el=[...document.querySelectorAll('body *')].find(e=>(e.textContent||'').trim().startsWith('보증금·권리금·인테리어')&&getComputedStyle(e).textOverflow==='ellipsis');
  const box=el.clientWidth;
  const probe=document.createElement('span');
  probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;'+
    ['font-size','font-weight','font-family','letter-spacing'].map(k=>k+':'+getComputedStyle(el)[k]).join(';');
  document.body.appendChild(probe);
  return '칸 '+box+'px\n'+cs.map(c=>{probe.textContent=c;return (probe.offsetWidth<=box?'  들어감 ':'  넘침  ')+String(probe.offsetWidth).padStart(4)+'px  '+c;}).join('\n');
}, cands));
await b.close();
