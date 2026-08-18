import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const makeStore = () => {
  const limits = [];
  return {
    limits,
    async claimDue({ limit }) { limits.push(limit); return []; },
    async complete() {},
    async fail() {}
  };
};

{
  const store = makeStore();
  const worker = createScheduleWorker({
    store,
    registry,
    executeAgentTask: async () => ({ ok: true }),
    maxBatch: 12,
    maxConcurrency: 4
  });
  assert.deepEqual(worker.limits, { batch: 12, concurrency: 4 });
  await worker.runDue();
  await worker.runDue({ limit: 5 });
  await worker.runDue({ limit: 12 });
  assert.deepEqual(store.limits, [12, 5, 12]);
}

for (const [field, value] of [
  ['maxBatch', 0], ['maxBatch', 65], ['maxBatch', 1.5],
  ['maxConcurrency', 0], ['maxConcurrency', 9], ['maxConcurrency', 2.5]
]) {
  assert.throws(() => createScheduleWorker({
    store: makeStore(),
    registry,
    executeAgentTask: async () => ({ ok: true }),
    [field]: value
  }), new RegExp(`INVALID_SCHEDULE_WORKER:${field}`));
}

const worker = createScheduleWorker({
  store: makeStore(), registry, executeAgentTask: async () => ({ ok: true })
});
for (const value of [0, 65, -1, 2.2, Number.MAX_SAFE_INTEGER]) {
  await assert.rejects(() => worker.runDue({ limit: value }), /INVALID_SCHEDULE_WORKER:limit/);
}
console.log('schedule worker batch policy ok');
