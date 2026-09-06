// frontend/screens/*.html 조각을 모아 frontend/index.html 을 만든다.
//
// 왜 이렇게 하나
//   index.html 한 파일이 1,800줄이면 어느 화면을 고치는지 찾는 데만 시간이 든다.
//   화면 단위로 나눠 두면 '지도 화면'은 32-map.html 하나만 열면 된다.
//
// 왜 런타임 include 가 아니라 빌드인가
//   이 앱은 정적 파일을 그대로 서빙한다(빌드 단계 없음). 런타임에 조각을 가져오면
//   첫 화면이 느려지고 CSP·캐시 규칙까지 건드려야 한다. 그래서 만들어진 index.html 을
//   그대로 커밋한다 — 배포 방식은 하나도 바뀌지 않는다.
//
// 순서가 곧 화면 순서다. ORDER 를 고치면 index.html 안의 순서가 바뀐다.
//
//   node scripts/build-html.mjs          index.html 을 새로 만든다
//   node scripts/build-html.mjs --check  커밋된 index.html 과 다르면 실패(CI·테스트용)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DIR = path.join(ROOT, 'frontend', 'screens');
const OUT = path.join(ROOT, 'frontend', 'index.html');

// 화면이 그려지는 순서. 파일 이름 앞의 숫자와 같은 순서로 둔다.
export const ORDER = [
  '_shell-head',
  '00-data-error',
  '01-home',
  '02-overlay',
  '03-settings',
  '05-hub',
  '10-report',
  '20-price',
  '30-fine-intro',
  '31-fine-compare',
  '32-map',
  '33-fine-detail',
  '40-zone-compare',
  '41-region',
  '42-find',
  '43-diagnosis',
  '44-compare',
  '45-sim',
  '50-ai',
  '51-soon',
  '_shell-foot',
];

export function build() {
  const parts = ORDER.map((name) => {
    const file = path.join(DIR, name + '.html');
    if (!fs.existsSync(file)) throw new Error('조각이 없습니다: frontend/screens/' + name + '.html');
    return fs.readFileSync(file, 'utf8').replace(/\n+$/, '');
  });
  return parts.join('\n') + '\n';
}

function main() {
  const html = build();
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== html) {
      console.error('frontend/index.html 이 frontend/screens/ 와 다릅니다. `npm run build:html` 을 실행해 주세요.');
      process.exit(1);
    }
    console.log('index.html 이 조각들과 일치합니다.');
    return;
  }
  fs.writeFileSync(OUT, html);
  console.log('만들었습니다: frontend/index.html · 조각 ' + ORDER.length + '개 · ' + html.split('\n').length + '줄');
}

if (import.meta.url === 'file://' + process.argv[1]) main();
