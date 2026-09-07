import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{localStorage.setItem('mysbizon.theme',JSON.stringify({locale:'en'}));localStorage.setItem('mysbizon.noticeSeen','1');});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
const navC=['Market Analysis','Areas','Find areas','Locations','Deep Analysis','Deep dive','Details','Market Prices','Prices','Report'];
console.log(await p.evaluate(cs=>{
  const el=[...document.querySelectorAll('nav *')].find(e=>!e.children.length&&(e.textContent||'').trim()==='Market Analysis');
  const box=el.clientWidth; const probe=document.createElement('span');
  probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;'+['font-size','font-weight','font-family','letter-spacing'].map(k=>k+':'+getComputedStyle(el)[k]).join(';');
  document.body.appendChild(probe);
  return '메뉴 칸 '+box+'px\n'+cs.map(c=>{probe.textContent=c;return (probe.offsetWidth<=box?'  ok   ':'  넘침 ')+String(probe.offsetWidth).padStart(4)+'  '+c;}).join('\n');
}, navC));
// 본전 계산 근거 줄
const go=async(t)=>{const l=p.locator(`text="${t}"`).first(); if(await l.count()){await l.click({timeout:2500}).catch(()=>{});await p.waitForTimeout(1500);} };
await go('Deep Analysis');
for (const it of await p.locator('[role="button"]:visible').all()){ const t=((await it.innerText().catch(()=>''))||'').trim(); if(/Break-even|break-even|Payback/i.test(t)){ await it.click().catch(()=>{}); await p.waitForTimeout(1800); break; } }
const cands=['At this level of sales, staff and rent are covered','Sales here cover staff and rent',
 '93 orders a day is break-even, and this sales assumption clears it','Break-even is 93 orders a day — this clears it','Break-even: 93 orders a day, and this clears it',
 'Enter deposit, key money and fit-out to also get a payback period','Enter your upfront cost to see the payback period','Add upfront cost for a payback period',
 'You need 45 orders a day to break even','Break-even needs 45 orders a day'];
console.log(await p.evaluate(cs=>{
  const el=[...document.querySelectorAll('body *')].find(e=>getComputedStyle(e).textOverflow==='ellipsis'&&e.clientWidth>250&&e.clientWidth<380&&/covered|break-even|payback/i.test(e.textContent||''));
  if(!el) return '근거 줄 못 찾음';
  const box=el.clientWidth; const probe=document.createElement('span');
  probe.style.cssText='position:absolute;visibility:hidden;white-space:nowrap;'+['font-size','font-weight','font-family','letter-spacing'].map(k=>k+':'+getComputedStyle(el)[k]).join(';');
  document.body.appendChild(probe);
  return '근거 줄 칸 '+box+'px\n'+cs.map(c=>{probe.textContent=c;return (probe.offsetWidth<=box?'  ok   ':'  넘침 ')+String(probe.offsetWidth).padStart(4)+'  '+c;}).join('\n');
}, cands));
await b.close();
