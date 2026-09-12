import test from 'node:test';
import assert from 'node:assert/strict';
import { safeError } from '../api/_err.js';
import fs from 'node:fs';

test('upstream errors never expose request PII or credentials in logs or responses', () => {
  const logs = [];
  const previous = console.error;
  console.error = (...values) => logs.push(values);
  try {
    const e = new Error('email=private@example.invalid api-key=private-secret request-body=private-survey');
    e.name = 'private@example.invalid';
    const response = safeError('report', e, '발송 실패');
    assert.equal(response, '발송 실패. 잠시 후 다시 시도해 주세요.');
    assert.deepEqual(logs, [['[report]', 'Error']]);
    const timeout = new Error('private response');
    timeout.name = 'TimeoutError';
    safeError('support', timeout, '조회 실패');
    assert.deepEqual(logs[1], ['[support]', 'TimeoutError']);
  } finally {
    console.error = previous;
  }
});

test('홈과 개인정보 안내가 실제 저장·로그 범위를 숨기지 않는다',()=>{
  const overlay=fs.readFileSync(new URL('../frontend/screens/02-overlay.html',import.meta.url),'utf8');
  const privacy=fs.readFileSync(new URL('../frontend/privacy.html',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../frontend/app-logic.js',import.meta.url),'utf8');
  assert.ok(!overlay.includes('그 밖에는 아무것도 수집하지 않아요'));
  assert.match(privacy,/브라우저 저장소/);
  assert.match(privacy,/접속 로그/);
  assert.match(privacy,/별도 동의/);
  assert.ok(!/if\(!seen.*notice:true/.test(app),'첫 방문 소개창이 검색을 자동으로 막으면 안 된다');
});
