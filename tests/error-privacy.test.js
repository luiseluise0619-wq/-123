import test from 'node:test';
import assert from 'node:assert/strict';
import { safeError } from '../api/_err.js';

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
