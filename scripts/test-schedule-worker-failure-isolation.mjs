import assert from 'node:assert/strict';
import { createScheduleWorker } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer' }] };
const claimed = Array.from({ length: 6 }, (_, index) => ({
  scheduleId: `schedule_${index + 1}`,
  traceId: `trace_${index + 1}`,
  agentId: index === 4 ? 'missing-agent' : 'minimal-engineer',
  task: `task ${index + 1}`,
  attempts: 1,
  maxAttempts: index === 2 ? 2 : 1,
  retryDelayMs: 1_000
}));
const completed = [];
const failed = [];
const store = {
  async claimDue({ limit }) { return claimed.slice(0, limit); },
  async complete(id) { completed.push(id); },
  async fail(id, input) { failed.push([id, input]); },
  async defer() { throw new Error('unexpected defer'); }
};
let active = 0;
let peak = 0;
const worker = createScheduleWorker({
  store,
  registry,
  now: () => new Date('2026-08-18T02:00:00.000Z'),
  maxConcurrency: 2,
  async executeAgentTask({ scheduleId }) {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    if (scheduleId === 'schedule_2') throw new Error('secret provider detail must not escape');
    if (scheduleId === 'schedule_3') return { ok: false, error: 'MODEL_PROVIDER_FAILED' };
    return { ok: true };
  }
});
const result = await worker.runDue({ limit: 6 });
assert.equal(peak, 2);
assert.deepEqual(completed, ['schedule_1', 'schedule_4', 'schedule_6']);
assert.equal(result.results.length, 6);
assert.deepEqual(result.results.map((item) => item.scheduleId), claimed.map((item) => item.scheduleId));
assert.deepEqual(result.results.map((item) => item.ok), [true, false, false, true, false, true]);
assert.equal(result.results[1].error, 'SCHEDULE_EXECUTION_FAILED');
assert.equal(result.results[2].error, 'MODEL_PROVIDER_FAILED');
assert.equal(result.results[4].error, 'SCHEDULE_AGENT_NOT_FOUND');
assert.equal(JSON.stringify(result).includes('secret provider detail'), false);
assert.equal(failed.some(([id, input]) => id === 'schedule_2' && input.error === 'SCHEDULE_EXECUTION_FAILED'), true);
assert.equal(failed.some(([id, input]) => id === 'schedule_3' && input.error === 'MODEL_PROVIDER_FAILED' && input.retryAt), true);
assert.equal(failed.some(([id, input]) => id === 'schedule_5' && input.error === 'SCHEDULE_AGENT_NOT_FOUND'), true);
console.log('schedule worker failure isolation ok');
