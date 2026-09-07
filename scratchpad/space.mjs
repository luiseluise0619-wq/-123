import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W=Number(process.argv[2]||390);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
const stat=async n=>{ const r=await p.evaluate(()=>{
  let bottom=0, first=null;
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    if (getComputedStyle(el).position==='fixed') continue;
    const t=(el.textContent||'').trim();
    const r=el.getBoundingClientRect();
    if (r.height>0 && r.width>0 && t) { bottom=Math.max(bottom, r.bottom+window.scrollY); }
  }
  return {bottom:Math.round(bottom), h:window.innerHeight, doc:document.documentElement.scrollHeight};
}); console.log(n, '마지막 글자 y='+r.bottom, '창 '+r.h, '문서 '+r.doc, '→ 빈 아래 '+Math.max(0,r.h-r.bottom)+'px'); };
await stat('홈');
for (const [nav,n] of [['상권분석','상권분석 허브'],['정밀분석','정밀분석 허브']]) {
  const t=p.locator(`text="${nav}"`).first(); if(await t.count()){await t.click({timeout:2500}).catch(()=>{});await p.waitForTimeout(1500);} 
  await stat(n);
}
await b.close();
