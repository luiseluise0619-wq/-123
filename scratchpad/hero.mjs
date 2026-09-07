import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W=Number(process.argv[2]||390);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
const t=p.locator('text="상권분석"').first(); await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(1500);
console.log(W, await p.evaluate(()=>{
  const h1=[...document.querySelectorAll('h1')].find(e=>e.offsetParent!==null);
  const card=h1&&h1.closest('div');
  const r=card?card.getBoundingClientRect():null;
  const first=[...document.querySelectorAll('body *')].filter(e=>!e.children.length&&(e.textContent||'').trim()&&e.getBoundingClientRect().height>0)
    .map(e=>({t:(e.textContent||'').trim().slice(0,20),y:Math.round(e.getBoundingClientRect().top)})).filter(o=>o.y>(r?r.bottom:0)).sort((a,b)=>a.y-b.y)[0];
  return '히어로 카드 '+(r?Math.round(r.top)+'~'+Math.round(r.bottom)+' (높이 '+Math.round(r.height)+'px)':'없음')+' · 그다음 글자: '+JSON.stringify(first);
}));
await b.close();
