import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
await p.locator('text="정밀분석"').first().click().catch(()=>{}); await p.waitForTimeout(1500);
console.log(await p.evaluate(()=>{
  const h=[...document.querySelectorAll('h1')].find(e=>e.offsetParent!==null);
  const cs=getComputedStyle(h);
  return {text:h.textContent.trim(), clientH:h.clientHeight, scrollH:h.scrollHeight, lh:cs.lineHeight, fs:cs.fontSize, of:cs.overflow};
}));
await b.close();
