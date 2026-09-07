import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W=Number(process.argv[2]||390);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:1200},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
const chip=p.locator('text=가로수길 옷 가게').first();
if(await chip.count()){ await chip.click().catch(()=>{}); await p.waitForTimeout(2000); }
const back=p.locator('text=목록으로').first();
if(await back.count()){ await back.click().catch(()=>{}); await p.waitForTimeout(1500); }
console.log('화면:', (await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,160))));
console.log(await p.evaluate(()=>{
  const res=[];
  for (const el of document.querySelectorAll('body *')) {
    if (getComputedStyle(el).textOverflow!=='ellipsis') continue;
    if (el.scrollWidth>el.clientWidth+1 && el.clientWidth>0) {
      const r=el.getBoundingClientRect();
      res.push(JSON.stringify((el.textContent||'').trim())+' 칸'+el.clientWidth+'→'+el.scrollWidth+' 화면안='+(r.left>=-1&&r.right<=window.innerWidth+1));
    }
  } return res.slice(0,8);
}));
await p.screenshot({path:'scratchpad/region'+W+'.png',fullPage:true});
await b.close();
