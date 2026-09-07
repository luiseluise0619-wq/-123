import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const LOC=process.argv[2]||'ko';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(l=>{localStorage.setItem('mysbizon.theme',JSON.stringify({locale:l})); localStorage.setItem('mysbizon.noticeSeen','1');},LOC);
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
const nb=await p.locator('nav [role="button"], nav span, nav div').all();
for (const it of nb){ const t=((await it.innerText().catch(()=>''))||'').trim(); if(/^(리포트|Report|报告)$/.test(t)){ await it.click({timeout:2000}).catch(()=>{}); break; } }
await p.waitForTimeout(1600);
console.log(LOC, '| 화면:', (await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,200))));
async function cut(tag){
  const r=await p.evaluate(()=>{ const res=[];
    for (const el of document.querySelectorAll('body *')) {
      const cs=getComputedStyle(el); if(cs.textOverflow!=='ellipsis') continue;
      if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0) res.push((el.scrollWidth-el.clientWidth)+'px 넘침 (칸 '+el.clientWidth+') '+JSON.stringify((el.textContent||'').trim()));
    } return [...new Set(res)]; });
  r.forEach(x=>console.log('  '+tag+' | '+x));
}
for (let step=0; step<8; step++){
  await cut('단계'+(step+1));
  const opts=await p.locator('.pick-opt:visible').all();
  if(!opts.length){ console.log('  단계'+(step+1)+' 항목 없음'); break; }
  await opts[Math.min(step===0?0:1,opts.length-1)].click().catch(()=>{});
  await p.waitForTimeout(800);
}
await b.close();
