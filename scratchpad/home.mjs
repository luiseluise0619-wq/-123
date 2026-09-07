import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR'});
p.on('console',m=>{ if(m.type()==='error') console.log('ERR',m.text().slice(0,150)); });
p.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,200)));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'});
for (const t of [500,1500,3000,5000]) {
  await p.waitForTimeout(t===500?500:t-(t===1500?500:t===3000?1500:3000));
  const txt=await p.evaluate(()=>document.body.innerText.replace(/\n+/g,' | ').slice(0,600));
  console.log('['+t+'ms]',txt);
}
await p.screenshot({path:'scratchpad/home-late.png',fullPage:true});
await b.close();
