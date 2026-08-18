import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const base = {
  traceId: 'trace', agentId: 'minimal-engineer', task: 'task', attempts: 1, maxAttempts: 1, retryDelayMs: 60_000
};
let executed = 0;
const overflowStore = {
  async claimDue({ limit }) {
    return Array.from({ length: limit + 1 }, (_, index) => ({ ...base, scheduleId: `schedule_${index + 1}` }));
  },
  async complete() {},
  async fail() {}
};
const overflowWorker = createScheduleWorker({
  store: overflowStore,
  registry,
  executeAgentTask: async () => { executed += 1; return { ok: true }; },
  maxBatch: 3
});
await assert.rejects(() => overflowWorker.runDue(), /INVALID_SCHEDULE_WORKER:claim_limit_exceeded/);
assert.equal(executed, 0);

const malformedStore = {
  async claimDue() { return { scheduleId: 'not-an-array' }; },
  async complete() {},
  async fail() {}
};
const malformedWorker = createScheduleWorker({
  store: malformedStore,
  registry,
  executeAgentTask: async () => { executed += 1; return { ok: true }; }
});
await assert.rejects(() => malformedWorker.runDue(), /INVALID_SCHEDULE_WORKER:claimed/);
assert.equal(executed, 0);
console.log('schedule worker claim boundary ok');
