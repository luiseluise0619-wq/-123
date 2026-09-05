import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function validateData(root){
  const names=['zone_industry','sales_by_industry','stores_by_industry','zone_gu','zone_border','seoul_map','zone_livepop','rent','sales_history','income'];
  const data={};for(const n of names){const filename=path.join(root,n+'.json');if(fs.statSync(filename).size>10*1024*1024)throw new Error(n+': file too large');data[n]=JSON.parse(fs.readFileSync(filename,'utf8'));}
  const fail=(name)=>{throw new Error('Invalid dataset: '+name);};
  const object=(v)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const zi=data.zone_industry;
  if(!Array.isArray(zi.inds)||!zi.inds.length||!zi.inds.every(x=>typeof x==='string')||!object(zi.zones)||!Object.keys(zi.zones).length||!/^[0-9]{4}[1-4]$/.test(zi.quarter))fail('zone_industry');
  for(const [id,z]of Object.entries(zi.zones)){
    if(!/^[0-9]+$/.test(id)||!z||typeof z.nm!=='string'||!Array.isArray(z.rows))fail('zone '+id);
    for(const r of z.rows)if(!Array.isArray(r)||r.length<4||!r.slice(0,4).every(x=>Number.isSafeInteger(x)&&x>=0)||r[0]>=zi.inds.length)fail('zone row '+id);
  }
  if(zi.n_zones!==Object.keys(zi.zones).length||zi.n_inds!==zi.inds.length)fail('zone counts');
  for(const n of ['sales_by_industry','stores_by_industry'])if(!object(data[n].ind)||data[n].quarter!==zi.quarter)fail(n+' quarter/ind');
  if(!object(data.zone_gu.gu)||!object(data.zone_border.border))fail('zone mapping');
  const map=data.seoul_map;if(!object(map.gus)||!object(map.pts))fail('map');
  for(const p of Object.values(map.pts))if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))fail('map coordinates');
  for(const g of Object.values(map.gus))if(typeof g.d!=='string'||! /^[MmLlHhVvCcSsQqTtAaZz0-9., eE+\-]+$/.test(g.d))fail('map geometry');
  if(!object(data.zone_livepop.zone))fail('livepop');
  for(const v of Object.values(data.zone_livepop.zone))if(!v||!Number.isFinite(v.tot)||v.tot<=0||!Array.isArray(v.age)||v.age.length!==6||!v.age.every(x=>Number.isFinite(x)&&x>=0))fail('livepop row');
  if(!Array.isArray(data.rent.quarters)||!object(data.rent.seoul)||!Array.isArray(data.rent.zones)||!Array.isArray(data.sales_history.quarters)||!object(data.sales_history.ind)||!object(data.income.gu))fail('supplementary data');
  function finite(value){if(typeof value==='number'&&!Number.isFinite(value))fail('non-finite number');if(value&&typeof value==='object')Object.values(value).forEach(finite);}finite(data);
  return {files:names.length,zones:zi.n_zones,industries:zi.inds.length,quarter:zi.quarter,updated:zi.updated};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateData(path.resolve(process.argv[2]||fileURLToPath(new URL('../frontend/data/v3',import.meta.url)))),null,2));
