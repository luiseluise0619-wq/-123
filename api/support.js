// 정부·지자체 창업/소상공인 지원사업 공고 프록시.
//
// 왜 프록시인가
//   공공데이터포털 서비스키는 서버 전용이다. 브라우저에 두면 남이 우리 한도를 쓴다.
//   (DATA_GO_KR_KEY 와 같은 규칙 — CLAUDE.md §2)
//
// 무엇을 지키나 — 이 화면은 '돈'을 다루므로 다른 화면보다 더 조심한다
//   · **마감이 지난 공고는 내보내지 않는다.** 지난 공고를 띄우는 순간 신뢰가 끝난다.
//   · **자격을 판정하지 않는다.** "당신은 받을 수 있습니다"는 하지 않는다.
//     자격은 업력·매출·지역·연령·소상공인 여부로 복잡하고, 틀리면 책임 문제이며
//     법률 판단 영역이다(CLAUDE.md §17). 우리는 '조건에 해당할 수 있는 제도'까지만 보여준다.
//   · **원문 링크를 반드시 함께 준다.** 우리 요약이 틀릴 수 있으니 최종 확인은 원문에서 한다.
//   · 키가 없으면 configured:false 로 정직하게 비운다 — 예시 공고를 지어내지 않는다.
//
// 필요 환경변수
//   KSTARTUP_API_KEY K-Startup 전용 키(선택). 없으면 DATA_GO_KR_KEY 를 쓴다.
//   DATA_GO_KR_KEY   공공데이터포털 일반 서비스키. 이 API 활용신청은 별도로 필요하다.
//                    — 단, 창업지원사업 공고 서비스도 따로 '활용신청'을 해야 한다.
// 상류 주소는 코드의 공식 K-Startup endpoint로 고정한다. 환경변수로 임의 주소를
// 받으면 설정 실수만으로 서비스키를 엉뚱한 서버에 보낼 수 있다.
import { fetchT, encKey, ymdLocal, boundedJson } from './_http.js';
import { safeError } from './_err.js';

const KSTARTUP_API_URL = 'https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01';

function publicLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

// 우리 화면이 쓰는 모양. 여기 없는 건 화면에 안 쓴다.
const FIELDS = {
  title:    ['biz_pbanc_nm', 'intgSprtBizNm', 'pblancNm', 'bizPbancNm', 'title', '사업명', '공고명'],
  org:      ['pbanc_ntrp_nm', 'sprv_inst', 'jrsdInsttNm', 'excInsttNm', 'organName', '기관명', '주관기관'],
  deadline: ['pbanc_rcpt_end_dt', 'reqstEndDe', 'pbancRcptEndDt', 'endDate', '접수종료일', '마감일'],
  url:      ['detl_pg_url', 'detailPgUrl', 'pblancUrl', 'url', '상세페이지'],
  kind:     ['supt_biz_clsfc', 'sprtRealmNm', 'supportType', '지원분야'],
  region:   ['supt_regin', 'areaNm', 'region', '지역'],
  target:   ['aply_trgt_ctnt', 'aply_trgt', 'trgetNm', 'target', '지원대상'],
  // 카드에 '무엇을 얼마나 주는지'가 없으면 신청으로 이어지지 않는다.
  content:  ['pbanc_ctnt', 'bizIntrcn', 'sprtCn', 'pblancCn', 'bizCn', '지원내용', '사업개요'],
  amount:   ['sprtAmt', 'bdgtAmt', 'sportAmount', '지원금액', '지원규모'],
  start:    ['pbanc_rcpt_bgng_dt', 'reqstBeginDe', 'pbancRcptBgngDt', 'startDate', '접수시작일'],
};

function pickField(row, names) {
  for (const n of names) {
    const v = row && row[n];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

// "20260930" · "2026-09-30" · "2026.09.30" → Date. 못 읽으면 null(마감 없음으로 취급하지 않는다).
function parseDate(s) {
  const t = String(s || '').replace(/[^\d]/g, '');
  if (t.length !== 8) return null;
  const d = new Date(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8));
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(req, res) {
  const key = process.env.KSTARTUP_API_KEY || process.env.DATA_GO_KR_KEY;
  const base = KSTARTUP_API_URL;
  if (!key) {
    return res.status(200).json({
      ok: false, configured: false, items: [],
      // 사용자에게는 환경변수 이름 같은 개발자 메시지를 노출하지 않는다.
      // 운영자용 안내는 서버 로그로만 남긴다.
      error: '지원사업 정보를 준비 중이에요. 준비되면 이 자리에 신청 가능한 공고가 나타납니다.',
    });
  }

  try {
    // serviceKey 는 URLSearchParams 에 넣지 않는다 — Encoding 형태 키가 이중 인코딩돼 깨진다.
    const qs = new URLSearchParams({ page: '1', perPage: '200', returnType: 'json', 'cond[rcrt_prgs_yn::EQ]': 'Y' });
    const r = await fetchT(`${base}${base.includes('?') ? '&' : '?'}serviceKey=${encKey(key)}&${qs}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) throw new Error('Support upstream status ' + r.status);
    const j = await boundedJson(r, 2_000_000);
    // 기관마다 목록이 담기는 자리가 다르다. 흔한 자리를 훑는다.
    const rows = (j && (j.data || j.items || (j.response && j.response.body && j.response.body.items))) || [];
    const list = Array.isArray(rows) ? rows : (rows.item || []);
    if (!Array.isArray(list)) throw new Error('Invalid support item list');

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const items = [];
    let expired = 0, undated = 0;

    for (const row of list) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const deadline = parseDate(pickField(row, FIELDS.deadline));
      // 마감이 지났으면 버린다 — 이 화면에서 지난 공고는 틀린 정보다.
      if (deadline && deadline < today) { expired++; continue; }
      if (!deadline) undated++;      // 상시 모집일 수도, 필드를 못 읽은 것일 수도 있다. 세어서 알린다.
      const title = pickField(row, FIELDS.title);
      if (!title) continue;
      items.push({
        title,
        org: pickField(row, FIELDS.org),
        deadline: deadline ? ymdLocal(deadline) : null,
        url: publicLink(pickField(row, FIELDS.url)),
        kind: pickField(row, FIELDS.kind),
        region: pickField(row, FIELDS.region),
        target: pickField(row, FIELDS.target),
        content: pickField(row, FIELDS.content).slice(0, 300),
        amount: pickField(row, FIELDS.amount),
        start: (function () { const d = parseDate(pickField(row, FIELDS.start)); return d ? ymdLocal(d) : null; })(),
      });
    }
    // 마감 임박순. 마감 없는 것은 뒤로.
    items.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

    return res.status(200).json({
      ok: true, configured: true, items: items.slice(0, 120),
      total: list.length, expired, undated,
      note: '자격을 판정하지 않습니다. 조건에 해당할 수 있는 공고 목록이며 최종 확인은 원문에서 하세요.',
    });
  } catch (e) {
    // 사용자에게는 상황만. 원인은 로그에만(요청 URL 에 serviceKey 가 들어 있다).
    safeError('support',e,'조회 실패');
    return res.status(200).json({
      ok: false, configured: true, items: [],
      error: '공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
}
