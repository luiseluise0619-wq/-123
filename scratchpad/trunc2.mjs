import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W=Number(process.argv[2]||390);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:1000},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1200);} }
const seen=new Set();
async function scan(){
  const r=await p.evaluate(()=>{
    const res=[];
    for (const el of document.querySelectorAll('body *')) {
      const cs=getComputedStyle(el);
      if (cs.display==='none'||cs.visibility==='hidden') continue;
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp!=='none';
      const ell = cs.textOverflow==='ellipsis';
      if (!ell && !clamp) continue;
      const cutW = el.scrollWidth>el.clientWidth+1 && el.clientWidth>0;
      const cutH = clamp && el.scrollHeight>el.clientHeight+1;
      if (cutW||cutH) {
        const t=(el.textContent||'').trim();
        if (t) res.push((cutW?(el.scrollWidth-el.clientWidth)+'px 가로':'세로')+' 잘림 (칸 '+el.clientWidth+'px) : '+JSON.stringify(t.slice(0,70)));
      }
    }
    return [...new Set(res)];
  });
  r.forEach(x=>seen.add(x));
}
async function walk(){
  const items=await p.locator('[role="button"]:visible, button:visible').all();
  for (let i=0;i<Math.min(items.length,70);i++){ try{ await items[i].click({timeout:1000}); await p.waitForTimeout(220); await scan(); }catch(e){} }
}
for (const nav of ['상권분석','정밀분석','통합시세','리포트']) {
  const t=p.locator(`text="${nav}"`).first();
  if (await t.count()){ await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(900); }
  await scan(); await walk();
  await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
}
console.log(W+'px · 잘린 곳 '+seen.size);
[...seen].forEach(x=>console.log('  '+x));
await b.close();
