import assert from 'node:assert/strict';
import {
  createScheduleCommandBoundary,
  SCHEDULE_COMMAND_LIMITS
} from '../lib/schedule-command-boundary.mjs';

function createStore() {
  const added = [];
  return {
    added,
    async add(input) {
      added.push({ ...input });
      return {
        scheduleId: `schedule_${added.length}`,
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
    async read() { return null; },
    async snapshot() { return { entries: [] }; },
    async cancel() { throw new Error('unused'); }
  };
}

const registry = { agents: [{ id: 'minimal-engineer' }, { id: 'agency-code-reviewer' }] };
const principal = { authenticated: true, subject: 'owner-1' };
const store = createStore();
let traceNumber = 0;
const commands = createScheduleCommandBoundary({
  store,
  registry,
  createTraceId: () => `trace-${++traceNumber}`
});

assert.deepEqual(SCHEDULE_COMMAND_LIMITS, {
  maxTaskChars: 20_000,
  maxAgentIdChars: 120,
  maxSubjectChars: 200,
  maxScheduleIdChars: 120,
  minMaxAttempts: 1,
  maxMaxAttempts: 5
});

const valid = await commands.create({
  principal,
  input: {
    agentId: ' minimal-engineer ',
    task: '  Her sabah özet hazırla.  ',
    runAt: '2026-08-17T07:30:00+03:00',
    maxAttempts: 3,
    retryDelayMs: 120_000
  }
});
assert.equal(valid.ok, true);
assert.equal(valid.schedule.agentId, 'minimal-engineer');
assert.equal(valid.schedule.task, 'Her sabah özet hazırla.');
assert.equal(valid.schedule.maxAttempts, 3);
assert.equal(valid.schedule.retryDelayMs, 120_000);
assert.equal(store.added[0].ownerId, 'owner-1');
assert.equal(store.added[0].traceId, 'trace-1');

const withoutOptionals = await commands.create({
  principal,
  input: {
    agentId: 'agency-code-reviewer',
    task: 'PR risklerini incele.',
    runAt: '2026-08-18T10:00:00Z'
  }
});
assert.equal(withoutOptionals.ok, true);
assert.equal(Object.hasOwn(store.added[1], 'maxAttempts'), false);
assert.equal(Object.hasOwn(store.added[1], 'retryDelayMs'), false);

for (const maxAttempts of [0, 6, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
  assert.deepEqual(
    await commands.create({
      principal,
      input: {
        agentId: 'minimal-engineer',
        task: 'Geçersiz deneme sayısı.',
        runAt: '2026-08-19T08:00:00Z',
        maxAttempts
      }
    }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' },
    `maxAttempts must not be coerced: ${String(maxAttempts)}`
  );
}

for (const retryDelayMs of [999, 86_400_001, 1.5, '60000']) {
  assert.deepEqual(
    await commands.create({
      principal,
      input: {
        agentId: 'minimal-engineer',
        task: 'Geçersiz retry.',
        runAt: '2026-08-19T08:00:00Z',
        retryDelayMs
      }
    }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}

for (const task of ['', '   ', `x\u0000y`, 'x'.repeat(SCHEDULE_COMMAND_LIMITS.maxTaskChars + 1), null]) {
  assert.deepEqual(
    await commands.create({
      principal,
      input: { agentId: 'minimal-engineer', task, runAt: '2026-08-19T08:00:00Z' }
    }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}

for (const agentId of ['', 'missing-agent', `minimal-engineer\n`, 'x'.repeat(121)]) {
  const result = await commands.create({
    principal,
    input: { agentId, task: 'Ajan sınırı.', runAt: '2026-08-19T08:00:00Z' }
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, agentId === 'missing-agent' ? 'INVALID_AGENT' : 'INVALID_SCHEDULE_COMMAND');
}

for (const runAt of [
  '',
  '2026-08-19',
  '2026-08-19T08:00:00',
  'not-a-date',
  '2026-99-99T08:00:00Z',
  'x'.repeat(65)
]) {
  assert.deepEqual(
    await commands.create({
      principal,
      input: { agentId: 'minimal-engineer', task: 'Zaman sınırı.', runAt }
    }),
    { ok: false, error: 'INVALID_SCHEDULE_COMMAND' }
  );
}

for (const input of [
  null,
  [],
  {},
  { agentId: 'minimal-engineer', task: 'Eksik runAt.' },
  { agentId: 'minimal-engineer', task: 'Fazla alan.', runAt: '2026-08-19T08:00:00Z', token: 'secret' }
]) {
  assert.deepEqual(await commands.create({ principal, input }), { ok: false, error: 'INVALID_SCHEDULE_COMMAND' });
}

assert.equal(store.added.length, 2, 'only the two valid creates may reach the store');
assert.equal(traceNumber, 2, 'only valid create requests may allocate trace ids');

console.log('strict schedule create input tests passed');
