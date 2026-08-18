import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';
const require = createRequire(import.meta.url);
const ui = require('../public/schedule-scope-counts-ui.js');

const privateCanaries = Object.freeze([
  'owner_secret_alice',
  'trace_secret_1',
  'trace_secret_2',
  'task body must never reach counts UI',
  'provider stack must never reach counts UI'
]);

let commandCalls = 0;
const api = createScheduleHttpApi({
  authenticator: {
    authenticate() {
      return { ok: true, principal: { subject: 'owner_secret_alice' } };
    }
  },
  sessionAuthenticator: null,
  commands: {
    async list({ principal }) {
      commandCalls += 1;
      assert.equal(principal.subject, 'owner_secret_alice');
      return {
        ok: true,
        schedules: [
          {
            scheduleId: 'schedule_active',
            ownerId: 'owner_secret_alice',
            traceId: 'trace_secret_1',
            agentId: 'minimal-engineer',
            task: 'task body must never reach counts UI',
            runAt: '2026-08-19T10:00:00.000Z',
            status: 'scheduled',
            attempts: 0,
            maxAttempts: 2
          },
          {
            scheduleId: 'schedule_failed',
            ownerId: 'owner_secret_alice',
            traceId: 'trace_secret_2',
            agentId: 'minimal-engineer',
            task: 'second private task',
            runAt: '2026-08-18T10:00:00.000Z',
            status: 'failed',
            attempts: 2,
            maxAttempts: 2,
            lastError: 'provider stack must never reach counts UI'
          },
          {
            scheduleId: 'schedule_completed',
            ownerId: 'owner_secret_alice',
            agentId: 'minimal-engineer',
            task: 'third private task',
            runAt: '2026-08-17T10:00:00.000Z',
            status: 'completed',
            attempts: 1,
            maxAttempts: 2
          }
        ]
      };
    },
    create: async () => ({ ok: false }),
    reschedule: async () => ({ ok: false }),
    cancel: async () => ({ ok: false })
  },
  readJson: async () => ({}),
  listLimit: 100
});

let browserRequest = null;
const client = ui.createClient({
  fetchImpl: async (path, init) => {
    browserRequest = { path, init };
    const serverResult = await api.handle({
      request: { url: path },
      method: init.method,
      pathname: '/api/schedules',
      headers: {}
    });
    const wire = JSON.stringify(serverResult.body);
    for (const canary of privateCanaries) assert.equal(wire.includes(canary), false, `wire leaked ${canary}`);
    return {
      ok: serverResult.status >= 200 && serverResult.status < 300,
      status: serverResult.status,
      json: async () => JSON.parse(wire)
    };
  }
});

const result = await client.read();
assert.equal(commandCalls, 1);
assert.equal(browserRequest.path, '/api/schedules?view=counts');
assert.equal(browserRequest.init.method, 'GET');
assert.equal(browserRequest.init.credentials, 'same-origin');
assert.equal(browserRequest.init.cache, 'no-store');
assert.equal(result.ok, true);
assert.deepEqual(result.counts, { all: 3, active: 1, history: 2, failed: 1 });

const fakeNodes = new Map(ui.KEYS.map((key) => [key, {
  button: { dataset: {}, setAttribute(name, value) { this[name] = String(value); } },
  count: { textContent: '', hidden: true }
}]));
assert.equal(ui.renderCounts(fakeNodes, result.counts), true);
assert.equal(fakeNodes.get('all').count.textContent, '3');
assert.equal(fakeNodes.get('active').count.textContent, '1');
assert.equal(fakeNodes.get('history').count.textContent, '2');
assert.equal(fakeNodes.get('failed').count.textContent, '1');
for (const refs of fakeNodes.values()) {
  assert.equal(refs.count.hidden, false);
  assert.match(refs.button['aria-label'], /görev$/);
}

process.stdout.write('schedule scope counts end-to-end tests passed\n');
