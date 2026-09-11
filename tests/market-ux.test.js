import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {logicSource} from './logic-source.js';

function app(){
  const context={DCLogic:class{setState(v){this.state={...this.state,...v};}},window:{innerWidth:1200},console,URL,
    document:{documentElement:{getAttribute(){return null;}}},setTimeout,clearTimeout};
  vm.createContext(context);vm.runInContext(logicSource()+';globalThis.Component=MysbizonLogic(DCLogic)',context);
  const c=new context.Component();
  const data=n=>JSON.parse(fs.readFileSync(new URL('../frontend/data/v3/'+n+'.json',import.meta.url),'utf8'));
  Object.assign(c.state,{zi:data('zone_industry'),zgu:data('zone_gu').gu,rentStats:data('rent'),salesHistory:data('sales_history'),
    sti:data('stores_by_industry'),income:data('income'),ind:'커피-음료'});
  return c;
}

test('market selectors update the selected subject and preserve industry across indicators',()=>{
  const c=app();c.marketPick('sales');
  let p=c.priceView();
  p.filters[0].change({target:{value:'1'}});
  p=c.priceView();
  const industry=c.state.prIndustry;
  assert.ok(p.title.includes(c.indName(industry)));
  assert.equal(c._charts['pr-sales-trend'].datasets[0].data.at(-1),c.state.salesHistory.ind[industry][c.state.salesHistory.quarters.at(-1)]);
  c.marketPick('churn');p=c.priceView();assert.ok(p.title.includes(c.indName(industry)));
  c.marketPick('fr');p=c.priceView();assert.equal(p.nowLabel,c.indName(industry));
  c.marketPick('spend');p=c.priceView();p.filters[0].change({target:{value:'2'}});
  p=c.priceView();assert.ok(p.title.includes(c.placeName(c.state.prGu)));
  c.marketPick('sales');c.marketPick('spend');assert.ok(c.priceView().title.includes(c.placeName(c.state.prGu)));
});

test('rent filters respect survey geography and do not invent a district average',()=>{
  const c=app();let p=c.priceView();
  p.filters[0].change({target:{value:'2'}});p=c.priceView();
  const zones=Object.values(c.state.rentStats.zones).filter(z=>z.gwon===c.state.prGwon);
  assert.equal(p.filters[1].options.length,zones.length);
  p.filters[1].change({target:{value:'1'}});p=c.priceView();
  assert.ok(p.title.includes(c.placeName(zones[1].nm)));
  assert.equal(c._charts['pr-trend'].datasets[0].data[0],zones[1].rent_trend[0]);
  c.marketPick('vacancy');assert.ok(c.priceView().title.includes(c.placeName(zones[1].nm)));
});

test('comparison can browse districts without a name and retain selections across districts',()=>{
  const c=app();c.state.screen='cmp';c.state.findGu='강남구';
  let box=c.renderVals().c.add;
  assert.ok(box.guOptions.length>20);
  const map=c.state.zgu;
  box.onGu({target:{value:'1'}});box=c.renderVals().c.add;
  const firstGu=c.state.cmpGu;
  assert.ok(box.browseRows.every(row=>map[row.id]===firstGu));
  const first=box.browseRows[0];first.add();first.add();assert.equal(c.state.picks.length,1);
  box=c.renderVals().c.add;box.onGu({target:{value:'2'}});box=c.renderVals().c.add;
  box.browseRows[0].add();
  assert.equal(c.renderVals().c.cols.length,2);
  assert.notEqual(map[c.state.picks[0]],map[c.state.picks[1]]);
  box=c.renderVals().c.add;
  const before=box.browseRows.length;
  if(box.hasMore){box.more();assert.ok(c.renderVals().c.add.browseRows.length>before);}
  box=c.renderVals().c.add;box.browseRows.find(r=>!r.disabled).add();
  assert.equal(c.state.picks.length,3);assert.ok(c.renderVals().c.add.browseRows.every(r=>r.disabled));
});

test('chart tooltip is immediate, readable in both themes and uses the horizontal category axis',()=>{
  const c=app();
  for(const [ink,bg] of [['#191F28','#FFFFFF'],['#F9FAFB','#111111']]){
    c.chartTheme=()=>({ink,bg,accent:'#087F6B'});
    const config=c.chartConfig({type:'hbar',unit:'%',labels:['A','B'],datasets:[{label:'Rate',data:[5,10]}]});
    assert.equal(config.options.interaction.axis,'y');
    assert.equal(config.options.interaction.intersect,false);
    assert.equal(config.options.plugins.tooltip.animation,false);
    assert.equal(config.options.plugins.tooltip.bodyColor,bg);
    assert.notEqual(config.options.plugins.tooltip.bodyColor,config.options.plugins.tooltip.backgroundColor);
    assert.equal(config.options.plugins.tooltip.callbacks.label({parsed:{x:10,y:1},dataset:{label:'Rate'}}),'Rate · 10%');
  }
  assert.equal(c.chartConfig({type:'doughnut',labels:['A'],datasets:[{data:[50]}]}).options.interaction.mode,'nearest');
});
