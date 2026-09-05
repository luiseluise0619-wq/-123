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
//   DATA_GO_KR_KEY   공공데이터포털 서비스키(Decoding). 다른 수집기와 같은 키를 쓸 수 있다
//                    — 단, 창업지원사업 공고 서비스도 따로 '활용신청'을 해야 한다.
//   SUPPORT_API_URL  공고 목록 엔드포인트. 기관마다 경로가 달라 환경변수로 뺐다.
//                    승인 화면의 '요청주소'를 그대로 넣는다.
//
// ⚠ 응답 필드 매핑은 실제 응답으로 확인해야 한다
//   아래 pickField() 가 흔한 필드 이름들을 훑어 우리 모양으로 바꾼다.
//   키를 넣고 한 번 호출해 본 뒤, 실제 필드명을 FIELDS 에 추가하는 것이 정확하다.
import { fetchT, encKey, ymdLocal } from './_http.js';
import { redact } from './_err.js';

// 우리 화면이 쓰는 모양. 여기 없는 건 화면에 안 쓴다.
const FIELDS = {
  title:    ['intgSprtBizNm', 'pblancNm', 'bizPbancNm', 'title', '사업명', '공고명'],
  org:      ['jrsdInsttNm', 'excInsttNm', 'organName', '기관명', '주관기관'],
  deadline: ['reqstEndDe', 'pbancRcptEndDt', 'endDate', '접수종료일', '마감일'],
  url:      ['detailPgUrl', 'pblancUrl', 'url', '상세페이지'],
  kind:     ['sprtRealmNm', 'supportType', '지원분야'],
  region:   ['areaNm', 'region', '지역'],
  target:   ['trgetNm', 'target', '지원대상'],
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
  const key = process.env.DATA_GO_KR_KEY;
  const base = process.env.SUPPORT_API_URL;
  if (!key || !base) {
    return res.status(200).json({
      ok: false, configured: false, items: [],
      error: '지원사업 공고가 아직 연결되지 않았습니다. 공공데이터포털에서 창업지원사업 공고 서비스를 신청한 뒤 DATA_GO_KR_KEY 와 SUPPORT_API_URL 을 설정해 주세요.',
    });
  }

  try {
    // serviceKey 는 URLSearchParams 에 넣지 않는다 — Encoding 형태 키가 이중 인코딩돼 깨진다.
    const qs = new URLSearchParams({ page: '1', perPage: '200', returnType: 'JSON' });
    const r = await fetchT(`${base}${base.includes('?') ? '&' : '?'}serviceKey=${encKey(key)}&${qs}`, {
      headers: { Accept: 'application/json' },
    });
    const j = await r.json().catch(() => null);
    // 기관마다 목록이 담기는 자리가 다르다. 흔한 자리를 훑는다.
    const rows = (j && (j.data || j.items || (j.response && j.response.body && j.response.body.items))) || [];
    const list = Array.isArray(rows) ? rows : (rows.item || []);

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const items = [];
    let expired = 0, undated = 0;

    for (const row of list) {
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
        url: pickField(row, FIELDS.url),
        kind: pickField(row, FIELDS.kind),
        region: pickField(row, FIELDS.region),
        target: pickField(row, FIELDS.target),
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
    console.error('[support]', redact((e && e.stack) || e));
    return res.status(200).json({
      ok: false, configured: true, items: [],
      error: '공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    });
  }
}
