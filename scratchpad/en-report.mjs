import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1000},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{localStorage.setItem('mysbizon.theme',JSON.stringify({locale:'en'}));localStorage.setItem('mysbizon.noticeSeen','1');});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
for (const it of await p.locator('nav [role="button"], nav div').all()){ const t=((await it.innerText().catch(()=>''))||'').trim(); if(t==='Report'){ await it.click({timeout:2000}).catch(()=>{}); break; } }
await p.waitForTimeout(1500);
await p.locator('.pick-opt:visible').first().click().catch(()=>{}); await p.waitForTimeout(1200);
await p.screenshot({path:'scratchpad/en-report.png',fullPage:true});
