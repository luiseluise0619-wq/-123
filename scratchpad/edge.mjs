import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:390,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
const el0=p.locator('text=시작하기').first(); if(await el0.count()&&await el0.isVisible().catch(()=>false)){await el0.click().catch(()=>{});await p.waitForTimeout(1200);}
const go=async(t)=>{const l=p.locator(`text="${t}"`).first(); if(await l.count()){await l.click({timeout:2500}).catch(()=>{});await p.waitForTimeout(1500);} };
await go('상권분석'); await go('후보 찾기 →');
console.log(await p.evaluate(()=>{
  const out=[];
  const find=t=>[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&(e.textContent||'').trim()===t);
  for (const t of ['바꾸기','어디에서 창업하고 싶으세요?','서울 전체 · 카페','다른 후보도 볼까요?']) {
    const e=find(t); if(!e){out.push(t+' 못 찾음');continue;}
    const r=e.getBoundingClientRect();
    out.push(t+' : left='+Math.round(r.left)+' right='+Math.round(r.right)+' (창 '+window.innerWidth+')');
  }
  return out.join('\n');
}));
await p.screenshot({path:'scratchpad/find-top.png',clip:{x:0,y:80,width:390,height:220}});
await b.close();
