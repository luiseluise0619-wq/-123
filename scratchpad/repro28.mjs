import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1600);
const click=async(re)=>{ for (const it of await p.locator('[role="button"]:visible, button:visible').all()){
  const t=((await it.innerText().catch(()=>''))||'').trim(); if(re.test(t)){ await it.click({timeout:2000}).catch(()=>{}); await p.waitForTimeout(1500); return t; } } return null; };
console.log('1', await click(/^상권분석$/));
console.log('2', await click(/훑어보기|자치구 훑기/));
await p.waitForTimeout(800);
console.log('화면:', (await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,300))));
// 상권 하나 고르기
const rows=await p.locator('[role="button"]:visible').all();
for (const r of rows){ const t=((await r.innerText().catch(()=>''))||'').trim(); if(/\d+곳/.test(t)&&t.length<60){ console.log('3 클릭:',JSON.stringify(t.slice(0,40))); await r.click().catch(()=>{}); await p.waitForTimeout(1800); break; } }
const scan=async(tag)=>console.log(tag, await p.evaluate(()=>{
  const res=[];
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).textOverflow!=='ellipsis') continue;
    if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0 && el.clientWidth<120) {
      const r=el.getBoundingClientRect();
      res.push(JSON.stringify((el.textContent||'').trim())+' 칸'+el.clientWidth+' 필요'+el.scrollWidth+' 화면안='+(r.left>=0&&r.right<=390&&r.width>0));
    }
  } return res.slice(0,6);
}));
await scan('스캔A');
await p.screenshot({path:'scratchpad/repro28.png',fullPage:true});
await b.close();
