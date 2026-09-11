#!/usr/bin/env node
// SHA256SUMS.json 다시 만들기 — 배포 직전에 한 번 돌린다.
//
// 왜 있나
//   배포본이 중간에 바뀌지 않았는지 사람이 확인할 수 있게 하는 목록이다.
//   그런데 목록이 낡으면 '누가 손댔다'와 '그냥 오래됐다'를 구분할 수 없어
//   오히려 없느니만 못하다 — 그래서 배포마다 다시 만든다(RELEASE.md 1.10).
//
//   node scripts/make-sums.mjs         다시 만들어 저장
//   node scripts/make-sums.mjs --check 지금 트리와 맞는지만 본다(다르면 exit 1)
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FILE = path.join(ROOT, 'SHA256SUMS.json');
const check = process.argv.includes('--check');

const before = existsSync(FILE) ? JSON.parse(await readFile(FILE, 'utf8')) : {};
async function sources(dir = '') {
  const files = [];
  for (const entry of await readdir(path.join(ROOT, dir), {withFileTypes:true})) {
    if (['.git','node_modules','dist','__pycache__','scratchpad'].includes(entry.name)) continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sources(rel));
    else if (entry.isFile() && rel !== 'SHA256SUMS.json' && !/\.pyc$|\.log$/.test(rel)
      && (!entry.name.startsWith('.env') || entry.name === '.env.example')) files.push(rel);
  }
  return files;
}
const out = {}, gone = [];
for (const rel of (await sources()).sort()) {
  const abs = path.join(ROOT, rel);
  if (!existsSync(abs)) { gone.push(rel); continue; }   // 지워진 파일은 목록에서 뺀다
  out[rel] = createHash('sha256').update(await readFile(abs)).digest('hex');
}
for (const rel of Object.keys(before)) if (!Object.hasOwn(out, rel)) gone.push(rel);
const changed = Object.keys(out).filter(k => before[k] !== out[k]);

if (check) {
  if (!changed.length && !gone.length) { console.log('SHA256SUMS.json 이 지금 트리와 맞습니다.'); process.exit(0); }
  console.error('SHA256SUMS.json 이 낡았습니다 — 바뀐 파일 ' + changed.length + '개'
    + (gone.length ? ' · 없어진 파일 ' + gone.length + '개' : ''));
  console.error('  ' + [...changed, ...gone].slice(0, 8).join('\n  '));
  console.error('다시 만들려면: npm run sums');
  process.exit(1);
}
await writeFile(FILE, JSON.stringify(out, null, 2) + '\n');
console.log('SHA256SUMS.json 다시 만들었습니다 — ' + Object.keys(out).length + '개'
  + (changed.length ? ' (바뀐 파일 ' + changed.length + '개' : ' (변경 없음')
  + (gone.length ? ' · 없어진 파일 ' + gone.length + '개 제외)' : ')'));
