import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:300,height:900}, timezoneId:'Asia/Seoul', locale:'ko-KR' });
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>{
  let leaves=0, hidden=0, trunc=[];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue; leaves++;
    const cs=getComputedStyle(el);
    if (cs.textOverflow==='ellipsis'||cs.overflow!=='visible') hidden++;
    if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0) trunc.push([el.tagName,(el.textContent||'').trim().slice(0,40),el.scrollWidth,el.clientWidth]);
  }
  return {leaves,hidden,trunc:trunc.slice(0,10)};
}));
await b.close();
