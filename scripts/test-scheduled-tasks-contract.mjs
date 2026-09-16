import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

const boundary = await readFile(new URL('../lib/schedule-command-boundary.mjs', import.meta.url), 'utf8');
const store = await readFile(new URL('../lib/task-schedule-store.mjs', import.meta.url), 'utf8');

// The HTTP surface is asserted by driving it, so a rename inside the handler
// cannot pass while the routing contract quietly changes.
const PRINCIPAL = { ownerId: 'owner-1' };
const AUTH_HEADERS = { authorization: 'Bearer test-token' };

function createApi({ authenticated = true } = {}) {
  const calls = [];
  const api = createScheduleHttpApi({
    authenticator: {
      authenticate: () => (authenticated ? { ok: true, principal: PRINCIPAL } : { ok: false })
    },
    commands: {
      list: async (args) => { calls.push(['list', args]); return { ok: true, schedules: [] }; },
      create: async (args) => { calls.push(['create', args]); return { ok: true, schedule: { id: 's-1' } }; },
      cancel: async (args) => { calls.push(['cancel', args]); return { ok: true, schedule: { id: args.scheduleId } }; }
    },
    readJson: async () => ({ agentId: 'daily', task: 'özet' })
  });
  return { api, calls };
}

{
  const { api, calls } = createApi();
  const listed = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: AUTH_HEADERS });
  assert.equal(listed.status, 200, 'GET /api/schedules lists schedules');
  assert.deepEqual(calls.at(-1), ['list', { principal: PRINCIPAL }]);

  const created = await api.handle({ method: 'POST', pathname: '/api/schedules', headers: AUTH_HEADERS, request: {} });
  assert.equal(created.status, 201, 'POST /api/schedules creates a schedule');
  assert.equal(calls.at(-1)[0], 'create');
  assert.deepEqual(calls.at(-1)[1].input, { agentId: 'daily', task: 'özet' });

  const cancelled = await api.handle({ method: 'DELETE', pathname: '/api/schedules/s-1', headers: AUTH_HEADERS });
  assert.equal(cancelled.status, 200, 'DELETE /api/schedules/:id cancels a schedule');
  assert.deepEqual(calls.at(-1), ['cancel', { principal: PRINCIPAL, scheduleId: 's-1' }]);

  // Lowercase verbs still route: the handler normalizes the method.
  const lowercase = await api.handle({ method: 'get', pathname: '/api/schedules', headers: AUTH_HEADERS });
  assert.equal(lowercase.status, 200);

  const notAllowed = await api.handle({ method: 'PUT', pathname: '/api/schedules', headers: AUTH_HEADERS });
  assert.equal(notAllowed.status, 405);
  assert.equal(notAllowed.headers.Allow, 'GET, POST');
  const notAllowedItem = await api.handle({ method: 'GET', pathname: '/api/schedules/s-1', headers: AUTH_HEADERS });
  assert.equal(notAllowedItem.status, 405);
  assert.equal(notAllowedItem.headers.Allow, 'DELETE');

  const unrelated = await api.handle({ method: 'GET', pathname: '/api/models', headers: AUTH_HEADERS });
  assert.equal(unrelated.matched, false, 'unrelated paths fall through to the rest of the server');
}

{
  const { api, calls } = createApi({ authenticated: false });
  const denied = await api.handle({ method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(denied.status, 401, 'anonymous callers are rejected');
  assert.equal(denied.headers['WWW-Authenticate'], 'Bearer');
  assert.equal(calls.length, 0, 'no command runs without a principal');
}

assert.match(boundary, /ownerId/);
assert.match(boundary, /INVALID_AGENT/);
assert.match(boundary, /containsPlaintextCredential/);
assert.match(boundary, /SCHEDULE_CAPACITY_REACHED/);
assert.match(boundary, /current\.ownerId !== ownerId/);
assert.match(store, /MAX_ATTEMPTS = 5/);
assert.match(store, /status: 'scheduled'/);
assert.match(store, /status = 'running'/);
assert.match(store, /status = 'completed'/);
assert.match(store, /status = 'failed'/);
assert.match(store, /status = 'cancelled'/);
assert.match(store, /toIso\(runAt/);

console.log('scheduled task API contract: ok');
