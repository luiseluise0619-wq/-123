import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const LOC=process.argv[2]||'en';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(l=>localStorage.setItem('mysbizon',JSON.stringify({locale:l})),LOC);
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
const el0=p.locator('[aria-label], [role="button"]').filter({hasText:/시작|Start|开始/}).first();
if(await el0.count()){await el0.click().catch(()=>{});await p.waitForTimeout(1000);}
// 리포트 → 설문 진행
const nav=p.locator('header [role="button"], nav [role="button"]');
for (const it of await p.locator('[role="button"]:visible').all()){ const t=(await it.innerText().catch(()=>''))||''; if(/리포트|Report|报告/.test(t.trim())){ await it.click().catch(()=>{}); await p.waitForTimeout(1500); break; } }
async function cut(tag){
  const r=await p.evaluate(()=>{ const res=[];
    for (const el of document.querySelectorAll('body *')) {
      const cs=getComputedStyle(el); if(cs.textOverflow!=='ellipsis') continue;
      if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0) res.push((el.scrollWidth-el.clientWidth)+'px 넘침 (칸 '+el.clientWidth+') '+JSON.stringify((el.textContent||'').trim()));
    } return [...new Set(res)]; });
  r.forEach(x=>console.log(tag+' | '+x));
}
await cut('시·도');
// 첫 항목 눌러 다음 단계로 계속
for (let step=0; step<6; step++){
  const opts=await p.locator('.pick-opt:visible').all();
  if(!opts.length) break;
  await opts[Math.min(step===1?3:0,opts.length-1)].click().catch(()=>{});
  await p.waitForTimeout(700); await cut('단계'+(step+2));
}
await b.close();
