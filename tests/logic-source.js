import fs from 'node:fs';

// Use the browser's source script order; a second hand-maintained module list drifts.
export function logicSource() {
  const head=fs.readFileSync(new URL('../frontend/screens/_shell-head.html',import.meta.url),'utf8');
  return [...head.matchAll(/<script src="\.\/((?:logic\/[^"?]+|app-logic)\.js)"/g)]
    .map(([,src])=>fs.readFileSync(new URL('../frontend/'+src,import.meta.url),'utf8')).join('\n');
}
