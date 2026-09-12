import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {deploymentFiles} from '../scripts/deploy-files.mjs';

const read=(path)=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('MYSBIZON DESIGN GRAMMAR v1.0 tokens and core components are centralized',async()=>{
  const [shell,design,css,admin]=await Promise.all([
    read('frontend/screens/_shell-head.html'),read('frontend/logic/design.js'),
    read('frontend/company.css'),read('admin/admin.css')
  ]);
  for(const token of ['#32B99A','#299C83','#171A19','#707672','#F6F6F2','#FFFFFF','#E5E7E4','#D8963E','#D95B5B']){
    assert.match(shell,new RegExp(token,'i'),token);
  }
  for(const space of ['--space-1:4px','--space-2:8px','--space-3:12px','--space-4:16px','--space-6:24px','--space-8:32px','--space-12:48px','--space-18:72px'])assert.match(shell,new RegExp(space));
  assert.match(design,/font-size:40px/);assert.match(design,/line-height:44px/);
  assert.match(design,/background:var\(--card\);border:1px solid var\(--line\)/);
  assert.match(css,/main > section \+ section\{padding-top:72px/);
  assert.match(admin,/Wanted Sans Variable/);
});

test('Wanted Sans variable font is valid and included in deployment',async()=>{
  const font=await readFile(new URL('../frontend/fonts/WantedSansVariable.woff2',import.meta.url));
  assert.equal(font.subarray(0,4).toString('ascii'),'wOF2');
  assert.ok(font.length>100000);
  const files=await deploymentFiles(fileURLToPath(new URL('..',import.meta.url)));
  assert.ok(files.includes('frontend/fonts/WantedSansVariable.woff2'));
  assert.ok(files.includes('licenses/WantedSans-OFL.txt'));
});
