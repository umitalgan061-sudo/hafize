import assert from 'node:assert/strict';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const clock = { value: new Date('2026-09-16T06:00:00.000Z') };
const store = createTaskScheduleStore({ now: () => clock.value });
const registry = { agents: [{ id: 'hafize-general' }] };
for (let index = 0; index < 200; index += 1) {
  store.add({ traceId: `burst-${index}`, agentId: 'hafize-general', task: `burst task ${index}`, runAt: '2026-09-16T05:00:00Z', maxAttempts: 1 });
}
let started = 0;
let peak = 0;
let finished = 0;
const worker = createScheduleWorker({
  store,
  registry,
  maxBatch: 25,
  maxConcurrent: 5,
  maxBatchesPerTick: 8,
  executeAgentTask: async () => {
    started += 1; peak = Math.max(peak, started);
    await new Promise((resolve) => setTimeout(resolve, 1));
    started -= 1; finished += 1;
    return { ok: true };
  }
});
const result = await worker.runDue({ limit: 200 });
assert.equal(result.claimed, 200);
assert.equal(result.batches, 8);
assert.equal(result.results.length, 200);
assert.equal(finished, 200);
assert.ok(peak <= 5);
assert.equal(store.snapshot().entries.every((entry) => entry.status === 'completed'), true);
assert.equal(store.claimDue({ limit: 64 }).length, 0);

console.log('schedule worker burst tests passed');
