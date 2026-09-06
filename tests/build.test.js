// index.html 은 frontend/screens/*.html 을 모아 만든 결과물이고, 그대로 커밋한다.
// 조각만 고치고 다시 만들지 않으면 두 쪽이 어긋나 '고쳤는데 화면이 그대로'가 된다.
// 그 어긋남을 여기서 잡는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, ORDER } from '../scripts/build-html.mjs';

test('index.html 이 frontend/screens 조각들과 일치한다', () => {
  const committed = fs.readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.equal(
    build(), committed,
    'frontend/screens 를 고친 뒤 `npm run build:html` 을 실행하지 않았습니다.'
  );
});

test('조각 목록에 빠지거나 남는 파일이 없다', () => {
  const dir = new URL('../frontend/screens/', import.meta.url);
  const onDisk = fs.readdirSync(dir).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')).sort();
  assert.deepEqual(onDisk, [...ORDER].sort(),
    'frontend/screens 의 파일과 scripts/build-html.mjs 의 ORDER 가 다릅니다.');
});

test('화면 조각마다 sc-if / sc-for 태그 짝이 맞는다', () => {
  const dir = new URL('../frontend/screens/', import.meta.url);
  for (const name of ORDER) {
    if (name.startsWith('_')) continue;            // 껍데기는 짝이 파일을 넘나든다
    const src = fs.readFileSync(new URL(name + '.html', dir), 'utf8');
    const open = (src.match(/<sc-(?:if|for)\b/g) || []).length;
    const close = (src.match(/<\/sc-(?:if|for)>/g) || []).length;
    assert.equal(open, close, name + '.html 의 sc-if/sc-for 태그 짝이 맞지 않습니다.');
  }
});
