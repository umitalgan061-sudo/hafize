import assert from 'node:assert/strict';
import { createScheduleWorker, SCHEDULE_WORKER_LIMITS } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const claimed = Array.from({ length: 8 }, (_, index) => ({
  scheduleId: `schedule_${index + 1}`,
  traceId: `trace_${index + 1}`,
  agentId: 'minimal-engineer',
  task: `task ${index + 1}`,
  attempts: 1,
  maxAttempts: 1,
  retryDelayMs: 60_000
}));
let claimOptions = null;
let active = 0;
let peak = 0;
const completed = [];
const store = {
  async claimDue(options) {
    claimOptions = options;
    return claimed.slice(0, options.limit);
  },
  async complete(id) { completed.push(id); },
  async fail() { throw new Error('unexpected fail'); }
};
const worker = createScheduleWorker({
  store,
  registry,
  async executeAgentTask() {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 12));
    active -= 1;
    return { ok: true };
  }
});
const result = await worker.runDue();
assert.deepEqual(SCHEDULE_WORKER_LIMITS, {
  defaultMaxBatch: 8,
  defaultMaxConcurrency: 2,
  maxBatch: 64,
  maxConcurrency: 8
});
assert.deepEqual(worker.limits, { batch: 8, concurrency: 2 });
assert.deepEqual(claimOptions, { limit: 8 });
assert.equal(result.claimed, 8);
assert.deepEqual(result.limits, { batch: 8, concurrency: 2 });
assert.equal(peak, 2);
assert.deepEqual(completed, claimed.map((item) => item.scheduleId));
assert.deepEqual(result.results.map((item) => item.scheduleId), completed);
console.log('schedule worker bounded concurrency ok');
