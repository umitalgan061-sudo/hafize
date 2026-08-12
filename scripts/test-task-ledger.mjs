import assert from 'node:assert/strict';
import { createTaskLedger } from '../lib/task-ledger.mjs';

let tick = 0;
const ledger = createTaskLedger({
  traceId: 'trace-test-1',
  maxEntries: 2,
  now: () => new Date(`2026-08-12T07:15:0${tick++}.000Z`)
});

const first = ledger.add({ agentId: 'hafize-general', action: 'Kullanıcı isteğini sınıflandır', status: 'running' });
assert.equal(first.taskId, 'task_1');
assert.equal(first.traceId, 'trace-test-1');
assert.equal(first.status, 'running');

const second = ledger.add({
  agentId: 'agency-code-reviewer',
  action: 'Dosyayı salt-okunur incele',
  status: 'planned',
  parentTaskId: first.taskId
});
assert.equal(second.parentTaskId, 'task_1');

const updated = ledger.update(second.taskId, { status: 'completed', detail: 'Blocker bulunmadı.' });
assert.equal(updated.status, 'completed');
assert.equal(updated.detail, 'Blocker bulunmadı.');
assert.ok(updated.updatedAt);

const snapshot = ledger.snapshot();
assert.equal(snapshot.traceId, 'trace-test-1');
assert.equal(snapshot.entries.length, 2);
assert.equal(ledger.read('task_2').status, 'completed');
assert.equal(ledger.read('missing'), null);

snapshot.entries[0].status = 'failed';
assert.equal(ledger.read('task_1').status, 'running', 'snapshots must not mutate internal ledger state');

assert.throws(
  () => ledger.add({ agentId: 'x', action: 'third' }),
  /TASK_LEDGER_FULL/
);
assert.throws(
  () => createTaskLedger({ traceId: '' }),
  /INVALID_TASK_LEDGER:traceId/
);
assert.throws(
  () => ledger.update('task_1', { status: 'unknown' }),
  /INVALID_TASK_LEDGER:status/
);
assert.equal(JSON.stringify(snapshot).includes('token'), false);
assert.equal(JSON.stringify(snapshot).includes('secret'), false);

console.log('Task ledger OK: bounded, trace-scoped, immutable snapshots and status validation');
