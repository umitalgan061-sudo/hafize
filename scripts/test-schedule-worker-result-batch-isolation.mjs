import assert from 'node:assert/strict';
import { createScheduleWorker, SCHEDULE_EXECUTION_RESULT_INVALID } from '../lib/schedule-worker.mjs';

const registry = { agents: [{ id: 'minimal-engineer', name: 'Minimal Engineer' }] };
const now = () => new Date('2026-08-20T17:00:00.000Z');

function schedule(id, attempt = 1, maxAttempts = 2) {
  return {
    scheduleId: id,
    traceId: `trace-${id}`,
    agentId: 'minimal-engineer',
    task: `Görev ${id}`,
    attempts: attempt,
    maxAttempts,
    retryDelayMs: 60_000
  };
}

const claimed = [
  schedule('valid-success'),
  schedule('invalid-success-extra'),
  schedule('valid-failure'),
  schedule('invalid-reserved'),
  schedule('valid-lease'),
  schedule('invalid-array'),
  schedule('final-invalid', 2, 2),
  schedule('second-success')
];

const storeCalls = [];
const store = {
  async claimDue({ limit }) {
    assert.equal(limit, 8);
    storeCalls.push(['claimDue', limit]);
    return structuredClone(claimed);
  },
  async complete(scheduleId) {
    storeCalls.push(['complete', scheduleId]);
  },
  async fail(scheduleId, detail) {
    storeCalls.push(['fail', scheduleId, structuredClone(detail)]);
  },
  async defer(scheduleId, detail) {
    storeCalls.push(['defer', scheduleId, structuredClone(detail)]);
  }
};

let active = 0;
let maxActive = 0;
const executions = [];
const release = [];
function gate() {
  return new Promise((resolve) => release.push(resolve));
}

const worker = createScheduleWorker({
  store,
  registry,
  now,
  maxBatch: 8,
  maxConcurrency: 3,
  async executeAgentTask(input) {
    executions.push(input.scheduleId);
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (executions.length <= 3) await gate();
    active -= 1;

    switch (input.scheduleId) {
      case 'valid-success':
      case 'second-success':
        return { ok: true };
      case 'invalid-success-extra':
        return { ok: true, forged: true };
      case 'valid-failure':
        return { ok: false, error: 'UPSTREAM_TEMPORARY' };
      case 'invalid-reserved':
        return { ok: false, error: 'SCHEDULE_EXECUTION_STATE_UNCERTAIN' };
      case 'valid-lease':
        return { ok: false, error: 'SCHEDULE_LEASE_BUSY', retryAt: '2026-08-20T17:05:00.000Z' };
      case 'invalid-array':
        return [{ ok: true }];
      case 'final-invalid':
        return { ok: false, error: 'not normalized' };
      default:
        throw new Error('unexpected schedule');
    }
  }
});

const pending = worker.runDue();
for (let i = 0; i < 10 && release.length < 3; i += 1) await Promise.resolve();
assert.equal(release.length, 3, 'first concurrency wave started');
assert.equal(maxActive, 3, 'configured concurrency reached but not exceeded');
while (release.length) release.shift()();
const output = await pending;

assert.equal(output.claimed, 8);
assert.equal(output.uncertain, 0);
assert.equal(output.invalidResults, 4);
assert.deepEqual(output.limits, { batch: 8, concurrency: 3 });
assert.deepEqual(executions, claimed.map((entry) => entry.scheduleId));

const byId = new Map(output.results.map((result) => [result.scheduleId, result]));
assert.deepEqual(byId.get('valid-success'), { scheduleId: 'valid-success', ok: true });
assert.deepEqual(byId.get('second-success'), { scheduleId: 'second-success', ok: true });
assert.deepEqual(byId.get('valid-failure'), {
  scheduleId: 'valid-failure', ok: false, error: 'UPSTREAM_TEMPORARY', retryScheduled: true
});
assert.deepEqual(byId.get('valid-lease'), {
  scheduleId: 'valid-lease', ok: false, error: 'SCHEDULE_LEASE_BUSY', retryScheduled: true,
  retryAt: '2026-08-20T17:05:00.000Z', attemptRefunded: true
});

for (const id of ['invalid-success-extra', 'invalid-reserved', 'invalid-array']) {
  assert.deepEqual(byId.get(id), {
    scheduleId: id,
    ok: false,
    error: SCHEDULE_EXECUTION_RESULT_INVALID,
    retryScheduled: true,
    contractInvalid: true
  });
}
assert.deepEqual(byId.get('final-invalid'), {
  scheduleId: 'final-invalid',
  ok: false,
  error: SCHEDULE_EXECUTION_RESULT_INVALID,
  retryScheduled: false,
  contractInvalid: true
});

const completed = storeCalls.filter(([type]) => type === 'complete').map(([, id]) => id).sort();
assert.deepEqual(completed, ['second-success', 'valid-success']);

const deferred = storeCalls.filter(([type]) => type === 'defer');
assert.deepEqual(deferred, [[
  'defer',
  'valid-lease',
  { error: 'SCHEDULE_LEASE_BUSY', runAt: '2026-08-20T17:05:00.000Z' }
]]);

const failed = new Map(
  storeCalls
    .filter(([type]) => type === 'fail')
    .map(([, id, detail]) => [id, detail])
);
assert.deepEqual(failed.get('valid-failure'), {
  error: 'UPSTREAM_TEMPORARY', retryAt: '2026-08-20T17:01:00.000Z'
});
for (const id of ['invalid-success-extra', 'invalid-reserved', 'invalid-array']) {
  assert.deepEqual(failed.get(id), {
    error: SCHEDULE_EXECUTION_RESULT_INVALID,
    retryAt: '2026-08-20T17:01:00.000Z'
  });
}
assert.deepEqual(failed.get('final-invalid'), { error: SCHEDULE_EXECUTION_RESULT_INVALID });

for (const id of ['invalid-success-extra', 'invalid-reserved', 'invalid-array', 'final-invalid']) {
  assert.equal(deferred.some(([, deferredId]) => deferredId === id), false, `${id}: invalid output never refunds attempt`);
  assert.equal(completed.includes(id), false, `${id}: invalid output never completes`);
}

assert.equal(JSON.stringify(output).includes('forged'), false);
assert.equal(JSON.stringify(output).includes('not normalized'), false);
console.log('schedule worker mixed result isolation tests passed');
