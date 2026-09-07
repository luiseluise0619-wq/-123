import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const W=Number(process.argv[2]||390);
const dir='scratchpad/deep'+W; fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기','[aria-label="닫기"]']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1500); break; } }
const go=async(txt)=>{ const t=p.locator(`text="${txt}"`).first(); if(await t.count()){ await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(2000);} };
const shot=async n=>{ await p.screenshot({path:dir+'/'+n+'.png',fullPage:true}); const h=await p.evaluate(()=>document.documentElement.scrollHeight); console.log(n,h); };
await go('상권분석'); await go('후보 찾기 →'); await shot('a-find');
await go('정밀분석'); await go('뜯어보기 →'); await shot('b-fine');
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
await go('정밀분석'); const items=await p.locator('[role="button"]:visible').all();
for (const it of items){ const t=(await it.innerText().catch(()=>''))||''; if(/본전/.test(t)){ await it.click().catch(()=>{}); await p.waitForTimeout(2000); break; } }
await shot('c-diag');
await b.close();
