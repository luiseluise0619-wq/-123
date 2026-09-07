import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W = Number(process.argv[2] || 390), STEPS = Number(process.argv[3] || 250), SEED = Number(process.argv[4] || 7);
let s = SEED; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const errs = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: W, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
p.on('console', m => { if (m.type()==='error') { const t=m.text(); if (!/favicon|Failed to load resource|\{\{ p\.d \}\}|\{\{ s\.d \}\}/.test(t)) errs.push('CONSOLE '+t.slice(0,220)); } });
p.on('pageerror', e => errs.push('PAGEERROR '+String(e).slice(0,220)));
await p.goto('http://localhost:3000/', { waitUntil:'networkidle' }); await p.waitForTimeout(1200);
for (const sel of ['text=시작하기','[aria-label="닫기"]']) { const el=p.locator(sel).first(); if (await el.count() && await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(250); break; } }
let clicks=0;
for (let i=0;i<STEPS;i++) {
  const items = await p.locator('[role="button"]:visible, button:visible, select:visible, input:visible').all();
  if (!items.length) break;
  const it = items[Math.floor(rnd()*items.length)];
  try {
    const tag = await it.evaluate(e=>e.tagName);
    if (tag==='SELECT') { const opts = await it.locator('option').all(); if (opts.length>1) await it.selectOption({ index: Math.floor(rnd()*opts.length) }, {timeout:1200}); }
    else if (tag==='INPUT') { const ty = await it.getAttribute('type'); if (ty==='range') continue; await it.fill(String(Math.floor(rnd()*900)+1), {timeout:1200}); }
    else { await it.click({ timeout:1200 }); }
    clicks++;
  } catch(e){}
  await p.waitForTimeout(90);
  // 화면에 NaN/undefined 가 보이는지
  if (i % 3 === 0) {
    const cut = await p.evaluate(()=>{
      const res=[];
      for (const el of document.querySelectorAll('body *')) {
        const cs=getComputedStyle(el);
        if (cs.display==='none'||cs.visibility==='hidden') continue;
        const clamp = cs.webkitLineClamp && cs.webkitLineClamp!=='none';
        if (cs.textOverflow!=='ellipsis' && !clamp) continue;
        const cutW = el.scrollWidth>el.clientWidth+1 && el.clientWidth>0;
        const cutH = clamp && el.scrollHeight>el.clientHeight+1;
        if (cutW||cutH) { const t=(el.textContent||'').trim();
          if (t) res.push('CUT '+(cutW?(el.scrollWidth-el.clientWidth)+'px':'세로')+' (칸 '+el.clientWidth+'px) '+JSON.stringify(t.slice(0,70))); }
      }
      return [...new Set(res)];
    });
    cut.forEach(c=>errs.push(c));
  }
  if (i % 10 === 0) {
    const bad = await p.evaluate(()=>{ const t=document.body.innerText; const m=t.match(/NaN|undefined|\[object Object\]|Infinity|null원|{{/g); return m? [...new Set(m)] : []; });
    if (bad.length) errs.push('TEXT ' + bad.join(',') + ' @step' + i);
  }
}
const bad = await p.evaluate(()=>{ const t=document.body.innerText; const m=t.match(/NaN|undefined|\[object Object\]|Infinity|{{/g); return m? [...new Set(m)] : []; });
if (bad.length) errs.push('TEXT(final) '+bad.join(','));
console.log('W='+W+' seed='+SEED+' 클릭 '+clicks+' · 이상 '+errs.length+'건');
[...new Set(errs)].forEach(e=>console.log('  '+e));
await b.close();
