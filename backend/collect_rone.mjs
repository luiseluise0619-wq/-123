// R-ONE 임대료·공실률·임대가격지수 분기 스냅샷 수집기
import fs from 'node:fs/promises';
import path from 'node:path';

const key = String(process.env.RONE_API_KEY || '').trim();
if (!key) throw new Error('RONE_API_KEY가 없습니다.');
const out = path.resolve(process.argv[2] || 'frontend/data/v3/rone.json');
const types = {
  small: { label:'소규모 상가', rent:'T248223134698125', vacancy:'T241833134686576', rentIndex:'T241273134677393' },
  medium: { label:'중대형 상가', rent:'T244363134858603', vacancy:'T249633134845544', rentIndex:'T249863134832916' },
  collective: { label:'집합 상가', rent:'T244913134948657', vacancy:'T243283134931290', rentIndex:'T242433134965708' },
};
const metrics = { rent:'임대료', vacancy:'공실률', rentIndex:'임대가격지수' };
const region = process.env.RONE_REGION_CODE || '500002';
const now = new Date().getFullYear();
const params = (statblId) => new URLSearchParams({Type:'json',pIndex:'1',pSize:'400',STATBL_ID:statblId,DTACYCLE_CD:'QY',CLS_ID:region,ITM_ID:'100001',START_WRTTIME:`${now-3}01`,END_WRTTIME:`${now}04`});
const datasets = {};
for (const [type, def] of Object.entries(types)) {
  datasets[type] = { label:def.label, metrics:{} };
  for (const [metric, label] of Object.entries(metrics)) {
    const response = await fetch(`https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?KEY=${encodeURIComponent(key)}&${params(def[metric])}`);
    if (!response.ok) throw new Error(`R-ONE HTTP ${response.status}`);
    const json = await response.json();
    const rows = json?.SttsApiTblData?.[1]?.row || [];
    datasets[type].metrics[metric] = {
      label, statblId:def[metric], regionCode:region,
      series: rows.map(v => ({ quarter:String(v.WRTTIME_IDTFR_ID||''), period:String(v.WRTTIME_DESC||''), value:Number(v.DTA_VAL), unit:String(v.UI_NM||'') }))
        .filter(v => v.quarter && Number.isFinite(v.value)),
    };
  }
}
await fs.mkdir(path.dirname(out), {recursive:true});
await fs.writeFile(out, JSON.stringify({available:true, source:'한국부동산원 R-ONE', updated:new Date().toISOString(), regionCode:region, types:datasets}, null, 2)+'\n');
console.log(`R-ONE 스냅샷 저장: ${out}`);
