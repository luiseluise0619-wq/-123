// 통합시세 지표 프록시 — 환율·금리·물가·농축수산물·에너지.
//
// 왜 프록시인가
//   한국은행 ECOS·aT KAMIS·오피넷 인증키는 전부 서버 전용이다.
//   브라우저에 두면 남이 우리 한도를 쓴다(CLAUDE.md §2 — 다른 수집기와 같은 규칙).
//
// 무엇을 지키나
//   · 키가 없으면 configured:false 로 정직하게 비운다. 예시 숫자를 지어내지 않는다.
//     화면(logic/market.js)은 그 상태를 '데이터 준비 중'으로 그대로 보여준다.
//   · 상류가 죽으면 ok:false 로 돌려준다. 지난 값을 최신인 척 내보내지 않는다.
//   · 응답에 키를 절대 담지 않는다.
//
// 필요 환경변수 (있는 것만 동작한다 — 하나씩 늘려도 된다)
//   ECOS_KEY    한국은행 ECOS 인증키    → 환율 · 기준금리 · 소비자물가 · 생산자물가
//   KAMIS_KEY   aT KAMIS 인증키         → 농산물 · 축산물 · 수산물 (KAMIS_ID 도 함께 필요)
//   KAMIS_ID    aT KAMIS 요청자 ID
//   OPINET_KEY  한국석유공사 오피넷 키   → 휘발유 · 경유 · LPG
//
// ⚠ 아직 실제 응답으로 확인하지 못했다
//   이 작업 환경에서 위 세 곳으로 나가는 연결이 막혀 있다. 통계표 코드(ECOS 의
//   STAT_CODE/ITEM_CODE)와 품목 코드(KAMIS)는 문서에서 찾은 값이라 기관이 개편하면
//   달라질 수 있다. 키를 넣고 한 번 호출해 실제 응답으로 맞춰야 정확하다.
//   확인 전까지 화면은 '데이터 준비 중'으로 남는다 — 틀린 숫자보다 낫다.
import { fetchT, encKey } from './_http.js';
import { isAllowedOrigin, FORBIDDEN_MSG } from './_origin.js';
import { redact } from './_err.js';

// 지표 → 상류. logic/market.js 의 k 와 같은 이름을 쓴다(둘이 어긋나면 화면이 빈다).
const SERIES = {
  // 한국은행 ECOS — 통계표코드/주기/항목코드
  usdkrw:  { src:'ecos', stat:'731Y001', cycle:'D', item:'0000001', unit:'원',  label:'USD/KRW' },
  jpykrw:  { src:'ecos', stat:'731Y001', cycle:'D', item:'0000002', unit:'원',  label:'JPY/KRW(100엔)' },
  cnykrw:  { src:'ecos', stat:'731Y001', cycle:'D', item:'0000053', unit:'원',  label:'CNY/KRW' },
  eurkrw:  { src:'ecos', stat:'731Y001', cycle:'D', item:'0000003', unit:'원',  label:'EUR/KRW' },
  baserate:{ src:'ecos', stat:'722Y001', cycle:'M', item:'0101000', unit:'%',   label:'한국은행 기준금리' },
  cpi:     { src:'ecos', stat:'901Y009', cycle:'M', item:'0',       unit:'지수', label:'소비자물가지수' },
  ppi:     { src:'ecos', stat:'404Y014', cycle:'M', item:'*AA',     unit:'지수', label:'생산자물가지수' },
  // aT KAMIS — 부류코드/품목코드
  rice:    { src:'kamis', cat:'100', item:'111', unit:'원', label:'쌀' },
  cabbage: { src:'kamis', cat:'200', item:'211', unit:'원', label:'배추' },
  onion:   { src:'kamis', cat:'200', item:'245', unit:'원', label:'양파' },
  garlic:  { src:'kamis', cat:'200', item:'258', unit:'원', label:'마늘' },
  pepper:  { src:'kamis', cat:'200', item:'246', unit:'원', label:'건고추' },
  pork:    { src:'kamis', cat:'500', item:'514', unit:'원', label:'돼지고기' },
  beef:    { src:'kamis', cat:'500', item:'511', unit:'원', label:'소고기' },
  chicken: { src:'kamis', cat:'500', item:'515', unit:'원', label:'닭고기' },
  egg:     { src:'kamis', cat:'500', item:'516', unit:'원', label:'계란' },
  squid:   { src:'kamis', cat:'600', item:'613', unit:'원', label:'오징어' },
  mackerel:{ src:'kamis', cat:'600', item:'611', unit:'원', label:'고등어' },
  laver:   { src:'kamis', cat:'600', item:'615', unit:'원', label:'김' },
  // 오피넷
  gasoline:{ src:'opinet', prod:'B027', unit:'원', label:'휘발유' },
  diesel:  { src:'opinet', prod:'D047', unit:'원', label:'경유' },
  lpg:     { src:'opinet', prod:'K015', unit:'원', label:'자동차용 LPG' },
  oil:     { src:'opinet', prod:'DUBAI', unit:'달러', label:'두바이유' }
};

const KEY_OF = { ecos:'ECOS_KEY', kamis:'KAMIS_KEY', opinet:'OPINET_KEY' };

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  // 지표는 하루 단위로 움직인다 — 10분 캐시로 상류 호출을 아낀다
  res.setHeader('cache-control', code === 200 ? 'public, max-age=600' : 'no-store');
  res.end(JSON.stringify(body));
}

// ECOS: 최근 N 개 관측치
async function fromEcos(spec, points) {
  const key = process.env.ECOS_KEY;
  const end = new Date();
  const start = new Date(end);
  if (spec.cycle === 'D') start.setDate(start.getDate() - points * 2);
  else start.setMonth(start.getMonth() - points);
  const fmt = (d) => spec.cycle === 'D'
    ? `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encKey(key)}/json/kr/1/${points}`
    + `/${spec.stat}/${spec.cycle}/${fmt(start)}/${fmt(end)}/${spec.item}`;
  const r = await fetchT(url);
  if (!r.ok) throw new Error('upstream ' + r.status);
  const j = await r.json();
  const rows = j?.StatisticSearch?.row || [];
  return rows.map((x) => ({ t: String(x.TIME || ''), v: Number(x.DATA_VALUE) }))
    .filter((x) => x.t && Number.isFinite(x.v));
}

// KAMIS: 품목별 일별 도소매 가격
async function fromKamis(spec, points) {
  const key = process.env.KAMIS_KEY, id = process.env.KAMIS_ID;
  if (!id) throw new Error('KAMIS_ID missing');
  const end = new Date(), start = new Date(end);
  start.setDate(start.getDate() - points * 2);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const url = 'https://www.kamis.or.kr/service/price/xml.do?action=periodProductList'
    + `&p_productclscode=01&p_startday=${ymd(start)}&p_endday=${ymd(end)}`
    + `&p_itemcategorycode=${spec.cat}&p_itemcode=${spec.item}&p_productrankcode=04`
    + `&p_convert_kg_yn=N&p_cert_key=${encKey(key)}&p_cert_id=${encodeURIComponent(id)}&p_returntype=json`;
  const r = await fetchT(url);
  if (!r.ok) throw new Error('upstream ' + r.status);
  const j = await r.json();
  const rows = j?.data?.item || [];
  return rows.map((x) => ({ t: String(x.yyyy || '') + String(x.regday || '').replace(/\D/g, ''),
                            v: Number(String(x.price || '').replace(/[^\d.-]/g, '')) }))
    .filter((x) => x.t && Number.isFinite(x.v));
}

// 오피넷: 최근 주간 평균 판매가
async function fromOpinet(spec, points) {
  const key = process.env.OPINET_KEY;
  const url = `https://www.opinet.co.kr/api/avgRecentPrice.do?out=json&code=${encKey(key)}&prodcd=${spec.prod}`;
  const r = await fetchT(url);
  if (!r.ok) throw new Error('upstream ' + r.status);
  const j = await r.json();
  const rows = j?.RESULT?.OIL || [];
  return rows.map((x) => ({ t: String(x.DATE || ''), v: Number(x.PRICE) }))
    .filter((x) => x.t && Number.isFinite(x.v)).slice(-points);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET 만 지원합니다.' });
  if (!isAllowedOrigin(req, { allowMissing: true })) return json(res, 403, { ok: false, error: FORBIDDEN_MSG });

  const url = new URL(req.url, 'http://localhost');
  const k = String(url.searchParams.get('k') || '');
  const points = Math.min(Math.max(Number(url.searchParams.get('n')) || 60, 5), 400);
  const spec = SERIES[k];
  if (!spec) return json(res, 400, { ok: false, error: '알 수 없는 지표입니다.' });

  const envName = KEY_OF[spec.src];
  if (!process.env[envName]) {
    // 키가 없다 = 아직 연결 안 됨. 오류가 아니라 '준비 중'이다.
    return json(res, 200, { ok: false, configured: false, k, label: spec.label,
      message: '이 지표는 아직 연결되지 않았어요.' });
  }

  try {
    const series = spec.src === 'ecos' ? await fromEcos(spec, points)
      : spec.src === 'kamis' ? await fromKamis(spec, points)
      : await fromOpinet(spec, points);
    if (!series.length) {
      return json(res, 200, { ok: false, configured: true, k, label: spec.label,
        message: '상류에서 값을 받지 못했어요.' });
    }
    return json(res, 200, { ok: true, configured: true, k, label: spec.label,
      unit: spec.unit, series });
  } catch (e) {
    return json(res, 200, { ok: false, configured: true, k, label: spec.label,
      message: '지표를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', detail: redact(e) });
  }
}
