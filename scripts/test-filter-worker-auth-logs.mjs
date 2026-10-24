import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run = (input) => {
  const result = spawnSync(process.execPath, ['scripts/filter-worker-auth-logs.mjs'], {
    input: input.map(x => JSON.stringify(x)).join('\n') + '\n',
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split('\n');
  return { events: lines.slice(0, -2).map(x => JSON.parse(x)), summary: JSON.parse(lines.at(-1)) };
};
const log = { message: ['studyweb.auth.login: storage_or_crypto_failure', 'password_verification', 'OperationError'] };
const sample = {
  outcome: 'ok',
  event: { request: { method: 'POST', url: 'https://example.invalid/api/v1/auth/login' }, response: { status: 503 } },
  logs: [log]
};
const single = run([sample]);
assert.equal(single.summary.validWorkerEvents, 1);
assert.equal(single.summary.httpResponses, 1);
assert.equal(single.summary.statusClasses['5xx'], 1);
assert.equal(single.summary.methods.POST, 1);
assert.equal(single.events.length, 1);
assert.equal(single.events[0].stage, 'password_verification');
assert.equal(single.events[0].errorType, 'OperationError');
assert.ok(!JSON.stringify(single).includes('example.invalid'));
const batch = run([[sample, { outcome: 'exceededCpu', logs: [] }]]);
assert.equal(batch.summary.arrayEnvelopeLines, 1);
assert.equal(batch.summary.validWorkerEvents, 2);
assert.equal(batch.summary.outcomes.exceededCpu, 1);
const unrelated = run([{ type: 'ready' }, { message: 'not-an-auth-event' }, 42]);
assert.equal(unrelated.summary.validWorkerEvents, 2);
assert.equal(unrelated.summary.primitiveJsonLines, 1);
assert.equal(unrelated.events.length, 0);
console.log('Authentication tail parser fixture checks passed');
