import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// 번역이 조용히 빠지는 걸 막는 시험.
//   · 세 언어 사전의 키가 똑같은가
//   · 자리표시자({0}·{name})가 번역본에서 사라지지 않았는가
//   · 로마자 표기가 서울시 공식 표기와 맞는가
//   · 실제 화면 값(view model)에 번역 안 된 한국어가 남지 않았는가

const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const j = rel => JSON.parse(read(rel));

const KO = j('../frontend/locales/ko.json');
const EN = j('../frontend/locales/en.json');
const ZH = j('../frontend/locales/zh-CN.json');

test('세 언어 사전의 키가 완전히 같다', () => {
  const keys = d => Object.keys(d).filter(k => k !== '@phrases').sort();
  assert.deepEqual(keys(EN), keys(KO), 'en 이 ko 와 다르다');
  assert.deepEqual(keys(ZH), keys(KO), 'zh-CN 이 ko 와 다르다');
});

test('자리표시자가 번역본에서 사라지지 않았다', () => {
  const holes = s => (String(s).match(/\{[a-z0-9]+\}/gi) || []).sort();
  for (const [name, dict] of [['en', EN], ['zh-CN', ZH]]) {
    for (const k of Object.keys(KO)) {
      assert.deepEqual(holes(dict[k]), holes(KO[k]),
        name + ' 의 ' + k + ' 에서 자리표시자가 어긋난다');
    }
    const phEn = dict['@phrases'] || {};
    for (const src of Object.keys(phEn)) {
      assert.deepEqual(holes(phEn[src]), holes(src),
        name + ' 문장 번역에서 자리표시자가 어긋난다: ' + src.slice(0, 40));
    }
  }
});

test('영어 문장 번역에 한글이 남아 있지 않다', () => {
  const ph = EN['@phrases'] || {};
  const bad = Object.entries(ph).filter(([, v]) => /[가-힣]/.test(v)).map(([k]) => k);
  assert.equal(bad.length, 0, '한글이 남은 영어 번역: ' + bad.slice(0, 3).join(' / '));
});

// ── 로마자 표기 ────────────────────────────────────────────────
function roman() {
  const ctx = { console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('../frontend/logic/roman.js'), ctx);
  const R = ctx.MysbizonParts.roman;
  return { word: k => R.romanizeWord.call(R, k), name: k => R.romanizeName.call(R, k) };
}

test('로마자 표기가 공식 표기와 맞는다', () => {
  const { name } = roman();
  const word = k => name(k);
  // 자음 동화가 걸리는 것들을 일부러 넣었다. 규칙이 빠지면 종로가 'Jongro' 로 나온다.
  const cases = [['성수', 'Seongsu'], ['역삼', 'Yeoksam'], ['강남', 'Gangnam'],
    ['종로', 'Jongno'], ['왕십리', 'Wangsimni'], ['압구정', 'Apgujeong'],
    ['잠실', 'Jamsil'], ['여의도', 'Yeouido'], ['을지로', 'Euljiro'],
    ['충무로', 'Chungmuro'], ['명동', 'Myeongdong'], ['신촌', 'Sinchon'],
    ['광화문', 'Gwanghwamun'], ['뚝섬', 'Ttukseom'], ['남대문', 'Namdaemun']];
  for (const [ko, want] of cases) assert.equal(word(ko), want, ko);
});

test('이름 뒤에 붙는 말은 영어 관행대로 적는다', () => {
  const { name } = roman();
  assert.equal(name('성수역'), 'Seongsu Stn.');
  assert.equal(name('역삼역 8번'), 'Yeoksam Stn. Exit 8');
  assert.equal(name('태릉시장'), 'Taereung Market');
  assert.equal(name('도곡2동'), 'Dogok 2-dong');
  assert.equal(name('테헤란로'), 'Teheran-ro');   // 표지판 표기 예외
});

// ── 실제 화면 값에 한국어가 남는지 ──────────────────────────────
const LOGIC_PARTS = ['const', 'i18n', 'theme', 'roman', 'util', 'design', 'rank',
  'analysis', 'screens', 'chat', 'charts', 'carousel', 'market', 'views'];

function component(locale) {
  const source = LOGIC_PARTS.map(n => read('../frontend/logic/' + n + '.js')).join('\n')
    + '\n' + read('../frontend/app-logic.js');
  const context = {
    DCLogic: class { setState(v) { this.state = { ...this.state, ...v }; } },
    window: { innerWidth: 1200 }, console, URL,
    document: { documentElement: { getAttribute() { return null; } } },
    setTimeout, clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(source + ';globalThis.Component=MysbizonLogic(DCLogic)', context);
  const c = new context.Component();
  c._dict = { ko: KO, en: EN, 'zh-CN': ZH };
  c.state.locale = locale;
  return c;
}

// 자료를 붙인 상태. 화면 문장은 대부분 자료에서 만들어지므로,
// 빈 상태만 훑으면 번역 구멍의 대부분을 못 본다(실제로 그렇게 오래 지나갔다).
function loaded(locale) {
  const c = component(locale);
  const zlp = j('../frontend/data/v3/zone_livepop.json').zone;
  Object.assign(c.state, {
    zi: j('../frontend/data/v3/zone_industry.json'),
    sbi: j('../frontend/data/v3/sales_by_industry.json'),
    sti: j('../frontend/data/v3/stores_by_industry.json'),
    zgu: j('../frontend/data/v3/zone_gu.json').gu,
    zbd: j('../frontend/data/v3/zone_border.json').border,
    smap: j('../frontend/data/v3/seoul_map.json'),
    zlp: Object.fromEntries(Object.entries(zlp || {}).filter(([, v]) =>
      v && Number.isFinite(v.tot) && v.tot > 0 && Array.isArray(v.age)
      && v.age.length === 6 && v.age.every(Number.isFinite))),
    rentStats: j('../frontend/data/v3/rent.json'),
    salesHistory: j('../frontend/data/v3/sales_history.json'),
    income: j('../frontend/data/v3/income.json'),
    zchg: j('../frontend/data/v3/zone_change.json'),
    zsim: j('../frontend/data/v3/zone_sim.json').zone
  });
  return c;
}

const SCREEN_KEYS = ['home', 'hubZone', 'zone', 'find', 'region', 'fineCmp', 'hubFine',
  'fineIntro', 'map', 'fineDetail', 'sim', 'diag', 'price', 'report'];

// 화면·상권·업종을 바꿔 가며 화면 값을 모은다.
function sweep(locale) {
  const seed = loaded(locale);
  const ids = Object.keys(seed.state.zi.zones || {});
  // 리포트 설문은 '지금 열린 질문' 하나만 그린다. 답을 안 채우면 1번 질문에서 멈춰
  // 뒤 질문들의 문구를 한 번도 못 본다 — 실제로 그렇게 영어 화면에 한국어가 남아 있었다.
  // 그래서 단계마다 한 번씩 세워 본다.
  const RP_STEPS = 10;
  const surveyAt = n => c => {
    Object.assign(c.state, {
      rp_sido: '서울', rp_gu: '마포구', rp_ind: '커피-음료',
      rp_stage: '아직 준비 중이에요 (예비창업자)', rp_age: '만 39세 이하',
      rp_biz: '아직 안 했어요', rp_when: '6개월 안', rp_need: '사업화 자금',
      rp_cost: '입력함', rp_email: 'a@b.com', rp_step: n
    });
  };
  const picks = [
    c => { },
    c => { c.state.sel = ids[0]; c.state.zoneId = ids[0]; c.state.picks = ids.slice(0, 3); },
    c => { c.state.sel = ids[5]; c.state.zoneId = ids[5]; c.state.picks = ids.slice(2, 5); c.state.ind = '한식음식점'; },
    ...Array.from({ length: RP_STEPS }, (_, n) => surveyAt(n)),
    // 매출 시나리오(적게·잘될 때)는 눌러야 문구가 바뀐다 — 기본값만 보면 두 문장을 못 본다
    c => { c.state.scen = '적게 팔릴 때'; },
    c => { c.state.scen = '잘될 때'; },
    // 지원사업 절은 공고가 와야 그려진다. 안 채우면 매칭 근거·마감 꼬리표·안내문을
    // 한 번도 못 본다 — 실제로 그래서 영어 화면에 '예비창업자 조건' 같은 게 한국어로 남았다.
    c => {
      Object.assign(c.state, {
        rp_sido: '서울', rp_gu: '마포구', rp_ind: '커피-음료',
        rp_stage: '아직 준비 중이에요 (예비창업자)', rp_age: '만 39세 이하',
        rp_biz: '아직 안 했어요', rp_when: '6개월 안', rp_need: '사업화 자금', rp_step: 9,
        spRest: true,
        sp: { ok: true, configured: true, undated: 1, expired: 2, items: [
          { title: '청년창업사관학교', org: '중소벤처기업부', amount: '최대 1억원',
            deadline: '2099-12-31', start: '2099-01-01', url: 'https://example.com',
            kind: '사업화', region: '전국', target: '만 39세 이하 예비창업자', content: '사업화 자금' },
          { title: '무관한 공고', org: '어딘가', amount: '', deadline: '', url: '' }
        ] }
      });
    },
    c => { Object.assign(c.state, { sp: { ok: false, configured: false, items: [] } }); },
    c => { Object.assign(c.state, { sp: { ok: false, configured: true, items: [] } }); },
    // 통합시세는 고른 지표 하나만 그린다 — 안 고르면 나머지 다섯 갈래의 문구를 못 본다.
    // 실제로 '자치구 20곳'·자료 출처 문단이 그렇게 한국어로 남아 있었다.
    ...['rent', 'vacancy', 'sales', 'spend', 'churn', 'fr'].map(k => c => { c.state.mkSel = k; })
  ];
  const found = new Set();
  for (const screen of SCREEN_KEYS) {
    for (const pick of picks) {
      const c = loaded(locale);
      c.state.screen = screen;
      pick(c);
      koreanIn(c.renderVals(), [], 0).forEach(s => found.add(s));
    }
  }
  // 도우미(AI 답변)는 물어봐야 생긴다. 안 물어보면 이 시험이 도우미를 한 번도 못 본다 —
  // 실제로 그래서 영어·중국어 화면에서 도우미만 한국어로 답하고 있었다.
  const ASK = ['어디가 좋아요?', '본전은 얼마예요?', '손님은 누가 와요?',
    '임대료 알려줘요', '폐업 많아요?', '이건 못 답하는 질문'];
  for (const q of ASK) {
    const c = loaded(locale);
    c.state.ind = '커피-음료';
    const r = c.rank();
    const sel = r ? r.list[0] : null;
    const ans = c.answer(q, r, sel);
    // 화면은 값을 그린 뒤 한 번 더 옮긴다(trDeep) — 시험도 같은 자리에서 잰다.
    koreanIn(c.trDeep(ans), [], 0).forEach(s => found.add(s));
  }
  return [...found];
}

// 값이 '평범한 객체'인가.
//   vm.createContext 로 만든 화면 값은 바깥 realm 의 Object 와 constructor 가 다르다.
//   그래서 `v.constructor === Object` 로 재면 전부 false 가 되어 한 겹만 훑고 끝났고,
//   이 시험이 오래 아무것도 못 잡은 채 통과했다. 이름으로 잰다.
function isPlainObject(v) {
  if (!v || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return p === null || (p.constructor && p.constructor.name === 'Object');
}

// 화면에 안 보이는 값 — select 의 value, 통계 원본 코드명 같은 '고르는 값'.
// 이것들은 한국어로 남아 있어야 옳다(옮기면 어느 항목과도 안 맞는다).
const MACHINE_KEY = k => k === 'v' || k === 'raw' || /Value$/.test(k);

function koreanIn(v, acc, d) {
  if (d > 9 || acc.length > 2000) return acc;
  if (typeof v === 'string') {
    // 스타일 문자열은 한글이 없어 걸리지 않는다
    if (/[가-힣]/.test(v)) acc.push(v);
    return acc;
  }
  if (Array.isArray(v)) { v.forEach(x => koreanIn(x, acc, d + 1)); return acc; }
  if (isPlainObject(v)) {
    for (const k in v) if (!MACHINE_KEY(k)) koreanIn(v[k], acc, d + 1);
    return acc;
  }
  return acc;
}

// 언어 선택의 '한국어'는 일부러 한국어로 둔다.
// 공고 제목·기관명·지원대상·금액은 기관이 올린 원문이라 옮기지 않는다(§1) —
// 아래 시험용 공고에 넣은 값들도 같은 이유로 세지 않는다.
const FIXTURE_KO = ['청년창업사관학교', '중소벤처기업부', '최대 1억원',
  '만 39세 이하 예비창업자', '무관한 공고', '어딘가', '사업화'];
const ON_PURPOSE = s => s === '한국어' || FIXTURE_KO.includes(s);

test('영어 화면 값에 번역 안 된 한국어가 남지 않는다 (자료 없는 상태)', () => {
  const left = koreanIn(component('en').renderVals(), [], 0).filter(s => !ON_PURPOSE(s));
  assert.equal(left.length, 0, '남은 한국어: ' + left.slice(0, 5).join(' / '));
});

test('영어 화면 값에 번역 안 된 한국어가 남지 않는다 (자료를 붙이고 화면을 훑어)', () => {
  const left = sweep('en').filter(s => !ON_PURPOSE(s));
  assert.equal(left.length, 0,
    left.length + '개 남음: ' + left.slice(0, 8).map(s => JSON.stringify(s.slice(0, 50))).join(' / '));
});

// 중국어는 상권·행정동 이름을 한글 그대로 둔다(§ logic/roman.js).
// 한자 표기를 우리가 만들어 내면 그건 지어낸 값이다.
// 그래서 '고유명사만 남았는가'를 잰다 — 이름을 지우고도 한글이 남으면 문장이 안 옮겨진 것이다.
function placeNames() {
  const seed = loaded('zh-CN');
  const names = new Set();
  // zoneLabelOf 는 '장충동족발거리(남소영길)' 를 '장충동족발거리 · 남소영길' 로 바꿔 보여준다.
  // 원본만 넣어 두면 그 변형이 '안 옮긴 문장'으로 잘못 잡힌다.
  const add = s => {
    if (!s || !/[가-힣]/.test(s)) return;
    s = String(s); names.add(s);
    const m = s.match(/^(.+?)\(([^()]+)\)$/);
    if (!m) return;
    const base = m[1].trim(), inner = m[2].trim();
    names.add(base); names.add(inner);
    names.add(base.indexOf(inner) >= 0 || inner.indexOf(base) >= 0 ? base : base + ' · ' + inner);
  };
  for (const z of Object.values(seed.state.zi.zones || {})) add(z && z.nm);
  for (const v of Object.values(seed.state.zlp || {})) add(v && v.dong);
  for (const g of Object.values(seed.state.zgu || {})) add(g);
  for (const b of Object.values(seed.state.zbd || {})) if (Array.isArray(b)) b.forEach(add);
  for (const z of Object.values((seed.state.rentStats || {}).zones || {})) { add(z && z.nm); add(z && z.gwon); }
  for (const g of Object.keys((seed.state.income || {}).gu || {})) add(g);
  return names;
}

test('중국어 화면 값에는 고유명사만 한글로 남는다', () => {
  const names = [...placeNames()].sort((a, b) => b.length - a.length);
  // 긴 이름부터 지운다 — '강남'이 '강남구'를 먼저 갉아먹지 않게.
  const strip = s => { for (const n of names) if (s.indexOf(n) >= 0) s = s.split(n).join(''); return s; };
  const left = sweep('zh-CN')
    .filter(s => !ON_PURPOSE(s))
    .filter(s => /[가-힣]/.test(strip(s)));
  assert.equal(left.length, 0,
    left.length + '개 남음: ' + left.slice(0, 8).map(s => JSON.stringify(s.slice(0, 50))).join(' / '));
});

// ── 화면 조각(screens/*.html)에 그대로 적힌 한국어 ────────────────
// 문구의 절반은 view model 이 아니라 마크업에 그대로 적혀 있고, 그건 trDom 이
// '원문 그대로' 사전에서 찾아 바꾼다. 위 화면 값 훑기로는 여기가 안 잡힌다 —
// 실제로 '나에게 맞는 지원사업'·'본전선' 같은 47개가 영어·중국어 화면에
// 한국어로 남아 있었다. trDom 과 같은 방식(trim 한 원문)으로 뽑아 대조한다.
function markupKorean() {
  const dir = new URL('../frontend/screens/', import.meta.url);
  const out = new Map();
  // 인쇄본도 같은 표(@phrases)로 옮긴다(report-i18n.js) — 여기 빠지면 PDF 만 한국어로 나간다.
  const files = [...fs.readdirSync(dir).filter(n => n.endsWith('.html')).sort(),
                 '../report-print.html'];
  for (const f of files) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<title>[\s\S]*?<\/title>/gi, '');
    // trDom 은 placeholder·aria-label·title 속성도 옮긴다
    for (const m of src.matchAll(/\s(?:aria-label|placeholder|title)="([^"{}]*[가-힣][^"{}]*)"/g)) {
      const t = m[1].trim(); if (t) out.set(t, out.get(t) || f);
    }
    // 태그 밖 글자. {{ }} 는 따로 그려지므로 그 자리에서 끊는다(DOM 텍스트 노드와 같은 모양).
    for (const seg of src.split(/<[^>]*>/))
      for (const piece of seg.split(/\{\{[^}]*\}\}/)) {
        const t = piece.trim();
        if (t && /[가-힣]/.test(t)) out.set(t, out.get(t) || f);
      }
  }
  return out;
}

test('화면 조각에 그대로 적힌 한국어가 세 언어 사전에 다 있다', () => {
  const all = markupKorean();
  assert.ok(all.size > 100, '조각에서 문구를 못 읽었다(' + all.size + '개)');
  const miss = [];
  for (const [text, file] of all) {
    for (const [name, dict] of [['en', EN], ['zh-CN', ZH]])
      if (!(dict['@phrases'] || {})[text]) miss.push(name + ' ' + file + ' :: ' + text.slice(0, 40));
  }
  assert.equal(miss.length, 0, miss.length + '개 빠짐: ' + miss.slice(0, 6).join(' / '));
});

test('한국어에서는 번역이 아무 일도 하지 않는다', () => {
  const c = component('ko');
  assert.equal(c.tr('서울 중앙값'), '서울 중앙값');
  const v = { a: '가게 수', b: ['상권', { c: '경쟁 점포' }] };
  assert.deepEqual(c.trDeep(v), v);
});

test('숫자가 든 문장은 자리표시자로 찾아 값을 되돌려 넣는다', () => {
  const c = component('en');
  assert.equal(c.tr('1,096곳'), '1,096 places');
  assert.equal(c.tr('중앙값보다 1,476곳 많아요'), '1,476 more than the median');
  // 표에 없는 문장은 건드리지 않는다
  assert.equal(c.tr('여기에 없는 문장입니다'), '여기에 없는 문장입니다');
});

test('조사는 앞 글자 받침을 보고 고른다', () => {
  const c = component('ko');
  assert.match(c.tn('zc.lead', { ind: '한식당', gu: '중구' }), /한식당은 중구가/);
  assert.match(c.tn('zc.lead', { ind: '카페', gu: '강남구' }), /카페는 강남구가/);
});

test('금액·분기 표기가 언어를 따른다', () => {
  const ko = component('ko'), en = component('en'), zh = component('zh-CN');
  assert.equal(ko.man(1000), '1,000만원');
  assert.equal(en.man(1000), 'KRW 10M');
  assert.equal(zh.man(1000), '1,000万韩元');
  assert.equal(ko.qtr('20261'), '2026년 1분기');
  assert.equal(en.qtr('20261'), 'Q1 2026');
  assert.equal(zh.qtr('20261'), '2026年1季度');
});

// ── 조사 ──────────────────────────────────────────────────────
// '{ind}이' 처럼 조사를 박아 두면 모음으로 끝나는 값에서 '카페이' 가 된다.
// 짝(`이(가)`)으로 적고 tn() 으로 불러야 한다. 실제로 여섯 곳이 그렇게 틀려 있었다.
test('사전 문구에 조사를 박아 두지 않았다', () => {
  // 금액(원·억)·자치구(구)처럼 끝 글자가 늘 같은 자리는 예외로 둔다.
  const OK = new Set([
    'cmp.diffPer:amt:으로',   // 금액은 늘 '원'·'억' 으로 끝난다
    'diag.fixed:amt:을',      // 〃
    'zc.lead:gu:가'           // 자치구는 늘 '구' 로 끝난다
  ]);
  // 짝으로 적은 것(`이(가)`)은 먼저 지운다 — 안 지우면 '이에요(예요)' 의 '이' 만 걸린다.
  const PAIR = /(이에요|예요|은|는|이|가|을|를|와|과)\([^)]+\)/g;
  // 뒤에 한글이 더 붙으면 조사가 아니다 — '{n}가지' 의 '가' 처럼.
  const JOSA = /\{(\w+)\}(이에요|예요|으로|와|과|이|가|은|는|을|를)(?![가-힣])/g;
  const bad = [];
  for (const [k, v] of Object.entries(KO)) {
    if (k === '@phrases') continue;
    for (const m of String(v).replace(PAIR, '§').matchAll(JOSA)) {
      if (!OK.has(k + ':' + m[1] + ':' + m[2])) bad.push(k + ' 의 {' + m[1] + '}' + m[2]);
    }
  }
  assert.deepEqual(bad, [], '조사를 짝으로 적고 tn() 으로 부를 것: ' + bad.join(' / '));
});

test('조사 짝은 따옴표를 건너뛰고 앞 글자를 본다', () => {
  const c = component('ko');
  assert.equal(c.tn('search.noZone', { q: '역삼' }), '‘역삼’과 맞는 동네가 없어요');
  assert.equal(c.tn('search.noZone', { q: '카페' }), '‘카페’와 맞는 동네가 없어요');
  assert.match(c.tn('sat.lead', { ind: '카페', v: '3.0', med: '2.0', word: '여유' }),
    /카페가 3.0개예요.*여유예요/);
  assert.match(c.tn('sat.lead', { ind: '치킨집', v: '3.0', med: '2.0', word: '과밀' }),
    /치킨집이 3.0개예요.*과밀이에요/);
  assert.match(c.tn('cmp.diffStore', { b: '대치2동주민센터', tie: '—' }), /주민센터예요/);
});

// ── 말투 ──────────────────────────────────────────────────────
// 화면 문구는 해요체로 통일한다. 한 문장 안에서 섞이던 곳이 여럿 있었다.
// 동의 문구만 예외 — 동의는 합니다체가 맞다.
test('화면 문구가 해요체로 통일돼 있다', () => {
  const ALLOW = /전달하는 데 동의합니다/;
  const formal = /(니다|니까)/;   // '줍니다·봅니다·오갑니다' 까지 잡는다
  const left = [...new Set(sweep('ko'))].filter(s => formal.test(s) && !ALLOW.test(s));
  assert.deepEqual(left, [], '합니다체가 남았다: ' + left.slice(0, 3).join(' / '));
});

// JSON 은 같은 키가 두 번 있어도 조용히 뒤엣것만 남긴다.
// 한국어 문구를 짧게 고치다 이미 있는 키와 겹치면 번역 하나가 소리 없이 사라진다.
test('사전에 같은 키가 두 번 나오지 않는다', () => {
  for (const name of ['ko', 'en', 'zh-CN']) {
    const raw = read('../frontend/locales/' + name + '.json');
    const dup = [];
    JSON.parse(raw, function () { return arguments[1]; });   // 형식 확인
    const seen = new Set(), inPhrases = new Set();
    // 최상위와 @phrases 를 따로 센다 — 두 곳에 같은 이름이 있는 건 문제가 아니다.
    let depth = 0, key = null;
    for (const m of raw.matchAll(/"((?:[^"\\]|\\.)*)"\s*:/g)) {
      const before = raw.slice(0, m.index);
      depth = (before.match(/(?<!\\)\{/g) || []).length - (before.match(/(?<!\\)\}/g) || []).length;
      key = m[1];
      const set = depth > 1 ? inPhrases : seen;
      if (set.has(key)) dup.push(name + ' 의 ' + key);
      set.add(key);
    }
    assert.deepEqual(dup, [], '사전에 겹치는 키: ' + dup.slice(0, 5).join(' / '));
  }
});
