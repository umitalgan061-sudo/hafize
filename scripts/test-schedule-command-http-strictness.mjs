import assert from 'node:assert/strict';
import { createScheduleCommandBoundary } from '../lib/schedule-command-boundary.mjs';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

function makeRequestBody(value) {
  return { body: value };
}

const entries = [];
let nextId = 1;
const store = {
  async add(input) {
    const entry = {
      scheduleId: `schedule_${nextId++}`,
      ...input,
      status: 'scheduled',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 1,
      retryDelayMs: input.retryDelayMs ?? 60_000,
      lastError: null,
      createdAt: '2026-08-16T20:00:00.000Z',
      updatedAt: null
    };
    entries.push(entry);
    return { ...entry };
  },
  async snapshot() { return { entries: entries.map((entry) => ({ ...entry })) }; },
  async read(id) {
    const entry = entries.find((item) => item.scheduleId === id);
    return entry ? { ...entry } : null;
  },
  async cancel(id) {
    const entry = entries.find((item) => item.scheduleId === id);
    entry.status = 'cancelled';
    return { ...entry };
  },
  async reschedule(id, input) {
    const entry = entries.find((item) => item.scheduleId === id);
    if (input.runAt) entry.runAt = input.runAt;
    if (input.retryDelayMs) entry.retryDelayMs = input.retryDelayMs;
    return { ...entry };
  }
};
const commands = createScheduleCommandBoundary({
  store,
  registry: { agents: [{ id: 'minimal-engineer' }] },
  createTraceId: () => `trace-http-${nextId}`
});
const authenticator = {
  authenticate({ headers } = {}) {
    return headers?.cookie === 'session=valid'
      ? { ok: true, principal: { authenticated: true, subject: 'owner-http' } }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
let reads = 0;
const api = createScheduleHttpApi({
  authenticator,
  commands,
  async readJson(request) {
    reads += 1;
    return request?.body;
  }
});

async function handle(method, pathname, body, authenticated = true) {
  return api.handle({
    request: makeRequestBody(body),
    method,
    pathname,
    headers: authenticated ? { cookie: 'session=valid' } : {}
  });
}

let result = await handle('POST', '/api/schedules', {
  agentId: 'minimal-engineer',
  task: 'Saatlik rapor hazırla.',
  runAt: '2026-08-17T09:00:00Z',
  maxAttempts: 2,
  retryDelayMs: 10_000
});
assert.equal(result.status, 201);
assert.equal(result.body.ok, true);
assert.equal(result.body.schedule.maxAttempts, 2);
assert.equal(entries.length, 1);
assert.equal(reads, 1);

for (const body of [
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-17T09:00:00Z', maxAttempts: 0 },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-17T09:00:00Z', maxAttempts: 6 },
  { agentId: 'minimal-engineer', task: '', runAt: '2026-08-17T09:00:00Z' },
  { agentId: 'minimal-engineer', task: 'x', runAt: 'bad' },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-17T09:00:00Z', ownerId: 'other' },
  { agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-17T09:00:00Z', traceId: 'client-trace' }
]) {
  result = await handle('POST', '/api/schedules', body);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_COMMAND' });
}
assert.equal(entries.length, 1, 'invalid HTTP creates must not persist schedules');

result = await handle('POST', '/api/schedules', {
  agentId: 'missing', task: 'x', runAt: '2026-08-17T09:00:00Z'
});
assert.equal(result.status, 400);
assert.deepEqual(result.body, { error: 'INVALID_AGENT' });
assert.equal(entries.length, 1);

const readsBeforeUnauthorized = reads;
result = await handle('POST', '/api/schedules', {
  agentId: 'minimal-engineer', task: 'x', runAt: '2026-08-17T09:00:00Z'
}, false);
assert.equal(result.status, 401);
assert.deepEqual(result.body, { error: 'AUTH_REQUIRED' });
assert.equal(result.headers['WWW-Authenticate'], 'Bearer');
assert.equal(reads, readsBeforeUnauthorized, 'unauthenticated body must not be parsed');

result = await handle('PATCH', '/api/schedules/not-valid', { runAt: '2026-08-18T09:00:00Z' });
assert.equal(result.status, 400);
assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_COMMAND' });

result = await handle('PATCH', '/api/schedules/schedule_999', { runAt: '2026-08-18T09:00:00Z' });
assert.equal(result.status, 404);
assert.deepEqual(result.body, { error: 'SCHEDULE_NOT_FOUND' });

result = await handle('PATCH', '/api/schedules/schedule_1', { retryDelayMs: 500 });
assert.equal(result.status, 400);
assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_COMMAND' });

result = await handle('PATCH', '/api/schedules/schedule_1', {
  runAt: '2026-08-18T09:00:00Z', retryDelayMs: 5_000
});
assert.equal(result.status, 200);
assert.equal(result.body.ok, true);
assert.equal(result.body.schedule.runAt, '2026-08-18T09:00:00Z');

result = await handle('DELETE', '/api/schedules/bad', undefined);
assert.equal(result.status, 400);
assert.deepEqual(result.body, { error: 'INVALID_SCHEDULE_COMMAND' });

result = await handle('DELETE', '/api/schedules/schedule_1', undefined);
assert.equal(result.status, 200);
assert.equal(result.body.schedule.status, 'cancelled');

result = await handle('DELETE', '/api/schedules/schedule_1', undefined);
assert.equal(result.status, 409);
assert.deepEqual(result.body, { error: 'SCHEDULE_NOT_CANCELLABLE' });

result = await handle('PUT', '/api/schedules', {});
assert.equal(result.status, 405);
assert.equal(result.headers.Allow, 'GET, POST');

console.log('schedule HTTP strict command tests passed');
