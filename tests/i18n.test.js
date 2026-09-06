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
  'analysis', 'screens', 'chat', 'charts', 'carousel', 'sim', 'market', 'views'];

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

function koreanIn(v, acc, d) {
  if (d > 6 || acc.length > 40) return acc;
  if (typeof v === 'string') {
    // 스타일 문자열은 한글이 없어 걸리지 않는다
    if (/[가-힣]/.test(v)) acc.push(v);
    return acc;
  }
  if (Array.isArray(v)) { v.forEach(x => koreanIn(x, acc, d + 1)); return acc; }
  if (v && typeof v === 'object' && v.constructor === Object) {
    for (const k in v) koreanIn(v[k], acc, d + 1);
    return acc;
  }
  return acc;
}

test('영어 화면 값에 번역 안 된 한국어가 남지 않는다', () => {
  const c = component('en');
  const left = koreanIn(c.renderVals(), [], 0)
    .filter(s => s !== '한국어');       // 언어 선택의 '한국어'는 일부러 한국어다
  assert.equal(left.length, 0, '남은 한국어: ' + left.slice(0, 5).join(' / '));
});

test('중국어 화면 값에는 고유명사(상권 이름)만 한글로 남는다', () => {
  const c = component('zh-CN');
  const left = koreanIn(c.renderVals(), [], 0).filter(s => s !== '한국어');
  // 자료를 안 읽은 상태라 상권 이름도 안 나온다 — 아무것도 남으면 안 된다
  assert.equal(left.length, 0, '남은 한국어: ' + left.slice(0, 5).join(' / '));
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
