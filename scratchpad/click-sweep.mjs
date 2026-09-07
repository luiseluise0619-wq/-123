import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const W = Number(process.argv[2] || 390);
const base = 'http://localhost:3000/';
const errs = [];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: W, height: 844 }, timezoneId: process.env.TZID || 'Asia/Seoul', locale: 'ko-KR' });
p.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/favicon|Failed to load resource/.test(t)) errs.push('CONSOLE ' + t.slice(0,200)); } });
p.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0,200)));
await p.goto(base, { waitUntil: 'networkidle' });
await p.waitForTimeout(1200);

// 첫 방문 소개창 닫기
for (const sel of ['text=시작하기','text=닫기','[aria-label="닫기"]']) {
  const el = p.locator(sel).first();
  if (await el.count() && await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(300); break; }
}

async function overflow(tag) {
  const r = await p.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push('PAGE scrollWidth ' + de.scrollWidth + ' > ' + de.clientWidth);
    for (const el of document.querySelectorAll('body *')) {
      let sc = false;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (c.overflowX === 'auto' || c.overflowX === 'scroll' || c.overflowX === 'hidden') { sc = true; break; }
        if (c.display === 'none') { sc = true; break; }
      }
      if (sc) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.right > window.innerWidth + 1.5 || r.left < -1.5) {
        const t = (el.innerText||'').trim().slice(0,40).replace(/\n/g,' ');
        out.push('OUT ' + el.tagName + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] ' + JSON.stringify(t));
      }
    }
    return out.slice(0, 12);
  });
  r.forEach(x => errs.push(tag + ' | ' + x));
}

async function clickAll(tag, limit = 80) {
  const items = await p.locator('[role="button"], button, [onclick]').all();
  const n = Math.min(items.length, limit);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    let label = '';
    try {
      if (!(await it.isVisible())) continue;
      label = ((await it.innerText().catch(()=>'')) || (await it.getAttribute('aria-label')) || '').trim().slice(0,24).replace(/\n/g,' ');
      await it.click({ timeout: 1500 });
      await p.waitForTimeout(180);
    } catch (e) { /* 사라진 요소 — 화면이 바뀐 것 */ }
  }
  await overflow(tag);
}

const NAV = ['상권분석','정밀분석','통합시세','리포트'];
for (const nav of NAV) {
  const t = p.locator(`text="${nav}"`).first();
  if (await t.count()) { await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(600); }
  await overflow(nav + ' 진입');
  await clickAll(nav);
  // 되돌아오기
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(900);
}
console.log('W=' + W + ' 이상 ' + errs.length + '건');
[...new Set(errs)].forEach(e => console.log('  ' + e));
await b.close();
