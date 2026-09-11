import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {logicSource} from './logic-source.js';

test('CSV export preserves UTF-8 BOM, quoting and spreadsheet formula protection',async()=>{
  let blob,clicked=false;
  const link={click(){clicked=true;},remove(){}};
  const context=vm.createContext({console,Blob,URL:{createObjectURL(v){blob=v;return 'blob:test';},revokeObjectURL(){}},
    setTimeout(fn){fn();},clearTimeout,window:{innerWidth:1200},
    document:{documentElement:{getAttribute(){return null;}},createElement(){return link;},body:{appendChild(){}}},
    DCLogic:class {setState(v){this.state={...this.state,...v};}}});
  vm.runInContext(logicSource(),context);
  const c=new (vm.runInContext('MysbizonLogic(DCLogic)',context))();
  const data=n=>JSON.parse(fs.readFileSync(new URL('../frontend/data/v3/'+n+'.json',import.meta.url),'utf8'));
  Object.assign(c.state,{zi:data('zone_industry'),zgu:data('zone_gu').gu,rp_sido:'서울',rp_gu:'마포구',rp_ind:'=TEST("quoted")'});
  c.reportView(c.rank()).csv();
  assert.equal(clicked,true);assert.match(link.download,/\.csv$/);
  const bytes=new Uint8Array(await blob.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);
  const csv=await blob.text();assert.ok(csv.includes("'=TEST"));assert.ok(csv.includes('""quoted""'));
});

test('print page retains report facts and invokes browser print',()=>{
  let prints=0;
  const context=vm.createContext({console,window:{print(){prints++;}},location:{href:''},
    DCLogic:class {setState(v){this.state={...this.state,...v};}}});
  vm.runInContext(fs.readFileSync(new URL('../frontend/report-logic.js',import.meta.url),'utf8'),context);
  const c=new (vm.runInContext('MysbizonLogic(DCLogic)',context))();
  c.state={d:{zone:'검증 상권',ind:'카페',bep:[{label:'본전',value:'1,523만원',tag:'가정'}],survey:[{label:'지역',value:'서울'}]}};
  const view=c.renderVals();assert.equal(view.bep[0].value,'1,523만원');
  view.print();assert.equal(prints,1);
});
