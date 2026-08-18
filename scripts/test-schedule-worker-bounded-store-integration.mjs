import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';
import { createTaskScheduleStore } from '../lib/task-schedule-store.mjs';

const now = () => new Date('2026-08-18T02:00:00.000Z');
const store = createTaskScheduleStore({ now });
const registry = { agents: [{ id: 'minimal-engineer' }] };
for (let index = 0; index < 12; index += 1) {
  store.add({
    traceId: `trace_${index + 1}`,
    agentId: 'minimal-engineer',
    task: `bounded task ${index + 1}`,
    runAt: '2026-08-18T01:00:00.000Z',
    maxAttempts: 1
  });
}

let active = 0;
let peak = 0;
const started = [];
const worker = createScheduleWorker({
  store,
  registry,
  async executeAgentTask({ scheduleId }) {
    started.push(scheduleId);
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 8));
    active -= 1;
    return { ok: true };
  }
});

const first = await worker.runDue();
assert.equal(first.claimed, 8);
assert.equal(peak, 2);
let snapshot = store.snapshot();
assert.equal(snapshot.entries.filter((item) => item.status === 'completed').length, 8);
assert.equal(snapshot.entries.filter((item) => item.status === 'scheduled').length, 4);
assert.equal(snapshot.entries.filter((item) => item.status === 'running').length, 0);
assert.deepEqual(started, Array.from({ length: 8 }, (_, index) => `schedule_${index + 1}`));

peak = 0;
const second = await worker.runDue();
assert.equal(second.claimed, 4);
assert.equal(peak, 2);
snapshot = store.snapshot();
assert.equal(snapshot.entries.filter((item) => item.status === 'completed').length, 12);
assert.equal(snapshot.entries.filter((item) => item.status === 'running').length, 0);
assert.deepEqual(started, Array.from({ length: 12 }, (_, index) => `schedule_${index + 1}`));
console.log('schedule worker bounded store integration ok');
