import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const W=Number(process.argv[2]||390);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:W,height:1100},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
for (const sel of ['text=시작하기']) { const el=p.locator(sel).first(); if (await el.count()&&await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1500);} }
const go=async(txt)=>{ const t=p.locator(`text="${txt}"`).first(); if(await t.count()){ await t.click({timeout:2500}).catch(()=>{}); await p.waitForTimeout(1500);} };
await go('정밀분석');
const items=await p.locator('[role="button"]:visible').all();
for (const it of items){ const t=(await it.innerText().catch(()=>''))||''; if(/본전/.test(t)){ await it.click().catch(()=>{}); await p.waitForTimeout(1800); break; } }
console.log(await p.evaluate(()=>{
  const out=[];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;
    if (el.scrollWidth > el.clientWidth+1 && el.clientWidth>0) {
      out.push('잘림 '+(el.scrollWidth-el.clientWidth)+'px / 칸 '+el.clientWidth+'px : '+JSON.stringify((el.textContent||'').trim().slice(0,60))+' | ws='+getComputedStyle(el).whiteSpace);
    }
  }
  for (const el of document.querySelectorAll('body *')) {
    const t=(el.textContent||'').trim();
    if (t.startsWith('보증금·권리금·인테리어') && el.children.length<=1) {
      const cs=getComputedStyle(el), r=el.getBoundingClientRect();
      out.push('찾음 <'+el.tagName+'> w='+Math.round(r.width)+' scrollW='+el.scrollWidth+' clientW='+el.clientWidth+' ws='+cs.whiteSpace+' of='+cs.overflow+' te='+cs.textOverflow+' 자식='+el.children.length+' : '+JSON.stringify(t.slice(0,60)));
    }
  }
  // 떠 있는 버튼이 글자를 가리는지
  const fab=[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed'&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().width<200);
  for (const f of fab) { const r=f.getBoundingClientRect();
    out.push('떠 있는 것 '+JSON.stringify((f.innerText||'').trim().slice(0,20))+' ['+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+']');
    const under=document.elementsFromPoint(r.left+r.width/2, r.top+r.height/2).filter(e=>e!==f&&!f.contains(e));
    const txt=under.map(e=>(e.children.length===0?(e.textContent||'').trim():'')).filter(Boolean)[0];
    if (txt) out.push('   → 그 아래에 글자: '+JSON.stringify(txt.slice(0,50)));
  }
  return out.join('\n');
}));
await b.close();
