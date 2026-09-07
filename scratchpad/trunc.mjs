import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W = Number(process.argv[2]||390), LOC = process.argv[3]||'ko';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport:{width:W,height:900}, timezoneId:'Asia/Seoul', locale:'ko-KR' });
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
if (LOC!=='ko') await p.evaluate(l=>{ localStorage.setItem('mysbizon',JSON.stringify({locale:l})); }, LOC), await p.reload({waitUntil:'networkidle'}), await p.waitForTimeout(1200);
for (const sel of ['text=시작하기','[aria-label="닫기"]']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(250); break; } }
const seen=new Set(), out=[];
async function scan(tag){
  const r = await p.evaluate(()=>{
    const res=[];
    for (const el of document.querySelectorAll('body *')) {
      if (el.children.length) continue;
      const cs=getComputedStyle(el);
      if (cs.display==='none'||cs.visibility==='hidden') continue;
      if (cs.overflow==='visible' && cs.overflowX==='visible') continue;
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth>0) {
        const t=(el.textContent||'').trim();
        if (t && /[가-힣A-Za-z]/.test(t)) res.push(Math.round(el.scrollWidth-el.clientWidth)+'px 잘림: '+JSON.stringify(t.slice(0,60)));
      }
    }
    return [...new Set(res)];
  });
  r.forEach(x=>{ const k=tag+'|'+x; if(!seen.has(k)){seen.add(k); out.push(k);} });
}
async function walk(){
  const items = await p.locator('[role="button"]:visible, button:visible').all();
  for (let i=0;i<Math.min(items.length,60);i++){ try{ await items[i].click({timeout:1200}); await p.waitForTimeout(150); await scan('클릭'+i);}catch(e){} }
}
for (const nav of ['상권분석','정밀분석','통합시세','리포트']) {
  const t=p.locator(`text="${nav}"`).first();
  if (await t.count()){ await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(500); }
  await scan(nav); await walk();
  await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
}
console.log(W+'px '+LOC+' · 잘린 곳 '+out.length);
out.slice(0,40).forEach(x=>console.log('  '+x));
await b.close();
