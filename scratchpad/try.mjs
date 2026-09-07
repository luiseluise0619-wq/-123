import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:Number(process.argv[2]||390),height:1200},timezoneId:'Asia/Seoul',locale:'ko-KR'});
await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>localStorage.setItem('mysbizon.noticeSeen','1'));
await p.goto('http://localhost:3000/',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
await p.locator('text=가로수길 옷 가게').first().click().catch(()=>{}); await p.waitForTimeout(2000);
await p.locator('text=목록으로').first().click().catch(()=>{}); await p.waitForTimeout(1200);
const test=async(name,fn)=>{ const r=await p.evaluate(fn); console.log(name, JSON.stringify(r)); };
await test('지금', ()=>{ const s=[...document.querySelectorAll('span')].filter(e=>/^옷 가게$|^한식당$|^동네 의원$/.test((e.textContent||'').trim()));
  return s.map(e=>e.clientWidth+'/'+e.scrollWidth); });
const combo=async(label, nameFlex, barFlex)=>{
  const r=await p.evaluate(([nf,bf])=>{
    const rows=[...document.querySelectorAll('div')].filter(e=>/display: flex; align-items: center; gap: 14px; padding: 15px 0px/.test(e.getAttribute('style')||''));
    const out=[];
    for(const row of rows.slice(0,6)){
      const kids=[...row.children];
      const nm=kids[0], bar=kids[1];
      if(!nm||!bar) continue;
      nm.style.flex=nf; if(bf) bar.style.flex=bf;
      out.push(JSON.stringify((nm.textContent||'').trim())+' '+nm.clientWidth+'/'+nm.scrollWidth+' 막대'+bar.clientWidth);
    }
    return out;
  },[nameFlex,barFlex]);
  console.log(label, r.join(' | '));
};
await combo('(a) 이름 1 1 auto','1 1 auto',null);
await combo('(b) 이름 1 1 auto · 막대 0 1 96px','1 1 auto','0 1 96px');
await combo('(c) 이름 1 1 auto · 막대 0 1 72px','1 1 auto','0 1 72px');
await combo('(e) 이름 1 1 auto · 막대 0 4 140px','1 1 auto','0 4 140px');
await combo('(f) 이름 1 1 auto · 막대 0 8 140px','1 1 auto','0 8 140px');
await combo('(h) 이름 1 0 auto · 막대 0 1 140px','1 0 auto','0 1 140px');
await combo('(i) 이름 1 1 auto · 막대 0 99 140px','1 1 auto','0 99 140px');
await combo('(h2) 다시 h','1 0 auto','0 1 140px');
console.log('가로 넘침:', await p.evaluate(()=>document.documentElement.scrollWidth+' vs '+document.documentElement.clientWidth));
// (a) 이름에 basis auto
await test('(a) flex:1 1 auto', ()=>{ const s=[...document.querySelectorAll('span')].filter(e=>/^옷 가게$|^한식당$|^동네 의원$/.test((e.textContent||'').trim()));
  s.forEach(e=>e.style.flex='1 1 auto'); return s.map(e=>e.clientWidth+'/'+e.scrollWidth); });
await test('(a) 막대', ()=>{ const bars=[...document.querySelectorAll('span')].filter(e=>/flex: 0 1 140px/.test(e.getAttribute('style')||'')); return bars.slice(0,3).map(e=>e.clientWidth); });
await p.screenshot({path:'scratchpad/try-a.png',clip:{x:0,y:400,width:390,height:420}});
await b.close();
