import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기','[aria-label="닫기"]']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { console.log('닫음', sel); await el.click().catch(()=>{}); await p.waitForTimeout(600); break; } }
console.log(await p.evaluate(()=>{
  const out=[];
  for (const t of ['동네 찾아보기','인기 검색','어떤 장사를 생각하시나요?','이렇게 쓰세요']) {
    const el=[...document.querySelectorAll('body *')].find(e=>e.children.length===0 && (e.textContent||'').trim()===t);
    if(!el){out.push(t+' : 못 찾음');continue;}
    const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
    out.push(t+' : top='+Math.round(r.top)+' h='+Math.round(r.height)+' opacity='+cs.opacity+' vis='+cs.visibility+' transform='+cs.transform);
  }
  out.push('body scrollHeight='+document.body.scrollHeight+' de='+document.documentElement.scrollHeight+' innerH='+window.innerHeight);
  return out.join('\n');
}));
await p.screenshot({path:'scratchpad/home-after.png'});
await b.close();
