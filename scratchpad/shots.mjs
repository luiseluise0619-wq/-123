import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const W=Number(process.argv[2]||390);
const dir='scratchpad/shots'+W; fs.mkdirSync(dir,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:900},timezoneId:'Asia/Seoul',locale:'ko-KR',deviceScaleFactor:1});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기','[aria-label="닫기"]']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1600); break; } }
const shot=async n=>{ const h=await p.evaluate(()=>document.documentElement.scrollHeight);
  await p.screenshot({path:dir+'/'+n+'.png',fullPage:true}); console.log(n,'높이',h); };
await shot('01-home');
for (const [nav,name] of [['상권분석','02-zone'],['정밀분석','03-fine'],['통합시세','04-market'],['리포트','05-report']]) {
  const t=p.locator(`text="${nav}"`).first();
  if (await t.count()){ await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(1800); }
  await shot(name);
}
await b.close();
