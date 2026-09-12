import fs from 'node:fs';
import {BUNDLE_SOURCES} from '../scripts/build-assets.mjs';

// Use the production bundle's declared order. Skip the DOM runtime because these
// tests exercise the view-model class in a small VM without React or a browser.
export function logicSource() {
  return BUNDLE_SOURCES.filter((src)=>src!=='dc-runtime.js')
    .map((src)=>fs.readFileSync(new URL('../frontend/'+src,import.meta.url),'utf8')).join('\n');
}
