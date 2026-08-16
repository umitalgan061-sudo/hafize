import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';

function spyStore() {
  const calls = { add: 0, read: 0, snapshot: 0, cancel: 0, reschedule: 0 };
  return {
    calls,
    async add(input) {
      calls.add += 1;
      return {
        scheduleId: 'schedule_1',
        ...input,
        status: 'scheduled',
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 1,
        retryDelayMs: input.retryDelayMs ?? 60_000,
        lastError: null,
        createdAt: '2026-08-16T20:00:00.000Z',
        updatedAt: null
      };
    },
    async read() { calls.read += 1; return null; },
    async snapshot() { calls.snapshot += 1; return { entries: [] }; },
    async cancel() { calls.cancel += 1; throw new Error('unused'); },
    async reschedule() { calls.reschedule += 1; throw new Error('unused'); }
  };
}

const store = spyStore();
let traces = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId() { traces += 1; return `trace-${traces}`; }
});
const principal = { authenticated: true, subject: 'owner-1' };

const invalidCreates = [
  undefined,
  null,
  [],
  {},
  { agentId: 'minimal-engineer', task: '', runAt: '2026-08-20T08:00:00Z' },
  { agentId: 'minimal-engineer', task: 'x', runAt: 'bad' },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-20T08:00:00Z', maxAttempts: 99 },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-20T08:00:00Z', retryDelayMs: 1 },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-20T08:00:00Z', ownerId: 'attacker' }
];
for (const input of invalidCreates) {
  assert.deepEqual(await commands.create({ principal, input }), { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
}
assert.equal(traces, 0, 'invalid input must fail before trace allocation');
assert.equal(store.calls.add, 0, 'invalid input must fail before persistence');

assert.deepEqual(
  await commands.create({
    principal,
    input: { agentId: 'missing', task: 'x', runAt: '2026-08-20T08:00:00Z' }
  }),
  { ok: false, error: 'INVALID_AGENT' }
);
assert.equal(traces, 0, 'invalid agent must fail before trace allocation');
assert.equal(store.calls.add, 0, 'invalid agent must fail before persistence');

for (const badPrincipal of [
  null,
  {},
  { authenticated: false, subject: 'owner-1' },
  { authenticated: true, subject: '' },
  { authenticated: true, subject: ' owner\nother ' },
  { authenticated: true, subject: 'x'.repeat(201) }
]) {
  assert.deepEqual(
    await commands.create({
      principal: badPrincipal,
      input: { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-20T08:00:00Z' }
    }),
    { ok: false, error: 'AUTH_REQUIRED' }
  );
}
assert.equal(traces, 0);
assert.equal(store.calls.add, 0);

const accepted = await commands.create({
  principal,
  input: { agentId: 'minimal-engineer', task: ' güvenli görev ', runAt: '2026-08-20T08:00:00Z', maxAttempts: 5 }
});
assert.equal(accepted.ok, true);
assert.equal(traces, 1);
assert.equal(store.calls.add, 1);

const brokenTrace = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => ''
});
assert.deepEqual(
  await brokenTrace.create({
    principal,
    input: { agentId: 'minimal-engineer', task: 'trace yok', runAt: '2026-08-20T08:00:00Z' }
  }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);
assert.equal(store.calls.add, 1, 'invalid trace must not reach persistence');

const throwingTrace = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId() { throw new Error('secret detail'); }
});
assert.deepEqual(
  await throwingTrace.create({
    principal,
    input: { agentId: 'minimal-engineer', task: 'trace hata', runAt: '2026-08-20T08:00:00Z' }
  }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);
assert.equal(store.calls.add, 1);

const failingStore = {
  async add() { throw new Error('database secret detail'); },
  async read() { throw new Error('database secret detail'); },
  async snapshot() { throw new Error('database secret detail'); },
  async cancel() { throw new Error('database secret detail'); },
  async reschedule() { throw new Error('database secret detail'); }
};
const failingCommands = createScheduleCommandBoundary({
  store: failingStore,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => 'trace-safe'
});
assert.deepEqual(
  await failingCommands.create({
    principal,
    input: { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-20T08:00:00Z' }
  }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);
assert.deepEqual(await failingCommands.list({ principal }), { ok: false, error: 'SCHEDULE_COMMAND_FAILED' });
assert.deepEqual(
  await failingCommands.cancel({ principal, scheduleId: 'schedule_1' }),
  { ok: false, error: 'SCHEDULE_COMMAND_FAILED' }
);

console.log('schedule command pre-side-effect tests passed');
