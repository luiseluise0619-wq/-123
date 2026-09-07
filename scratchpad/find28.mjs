import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
const go=async(t)=>{const l=p.locator(`text="${t}"`).first(); if(await l.count()){await l.click({timeout:2500}).catch(()=>{});await p.waitForTimeout(1500);} };
await go('정밀분석'); await go('뜯어보기 →');
// '이 자리' 탭 찾기
for (const it of await p.locator('[role="button"]:visible').all()){ const t=((await it.innerText().catch(()=>''))||'').trim(); if(/이 자리/.test(t)){ await it.click().catch(()=>{}); await p.waitForTimeout(1600); break; } }
const r=await p.evaluate(()=>{
  const res=[];
  for (const el of document.querySelectorAll('body *')) {
    const cs=getComputedStyle(el);
    if (cs.textOverflow!=='ellipsis') continue;
    if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0 && el.clientWidth<80)
      res.push({t:(el.textContent||'').trim(), w:el.clientWidth, need:el.scrollWidth, y:Math.round(el.getBoundingClientRect().top), style:el.getAttribute('style')||''});
  }
  return res.slice(0,4);
});
console.log(JSON.stringify(r,null,1));
if(r.length) await p.screenshot({path:'scratchpad/cut28.png',clip:{x:0,y:Math.max(0,r[0].y-160),width:390,height:400}});
await b.close();
