import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScheduleHttpApi } from '../lib/schedule-http-api.mjs';

let authenticated = 0;
let listed = 0;
const principal = Object.freeze({ subject: 'owner-a' });
const authenticator = Object.freeze({
  authenticate() {
    authenticated += 1;
    return { ok: true, principal };
  }
});
const commands = Object.freeze({
  async list({ principal: seen }) {
    listed += 1;
    assert.equal(seen, principal);
    return {
      ok: true,
      schedules: [
        {
          scheduleId: 'schedule_1', ownerId: 'owner-a', agentId: 'minimal-engineer', task: 'safe task',
          runAt: '2026-08-18T14:00:00.000Z', status: 'failed', attempts: 1, maxAttempts: 3,
          traceId: 'trace-private', lastError: 'provider-private-error', createdAt: '2026-08-18T13:00:00.000Z',
          updatedAt: '2026-08-18T13:30:00.000Z'
        },
        {
          scheduleId: 'schedule_2', ownerId: 'owner-a', agentId: 'minimal-engineer', task: 'active task',
          runAt: '2026-08-18T15:00:00.000Z', status: 'scheduled', attempts: 0, maxAttempts: 3,
          traceId: 'trace-active-private', createdAt: '2026-08-18T13:05:00.000Z', updatedAt: '2026-08-18T13:35:00.000Z'
        }
      ]
    };
  },
  async create() { throw new Error('unexpected create'); },
  async reschedule() { throw new Error('unexpected reschedule'); },
  async cancel() { throw new Error('unexpected cancel'); }
});
const api = createScheduleHttpApi({ authenticator, sessionAuthenticator: null, commands, readJson: async () => ({}), listLimit: 10 });

const invalidBefore = { authenticated, listed };
for (const url of [
  '/api/schedules?scope=%20failed',
  '/api/schedules?scope=failed%20',
  '/api/schedules?scope=failed%00',
  '/api/schedules?scope=__proto__',
  '/api/schedules?scope=constructor',
  '/api/schedules?scope=toString'
]) {
  const result = await api.handle({ request: { url }, method: 'GET', pathname: '/api/schedules', headers: {} });
  assert.equal(result.status, 400, url);
}
assert.equal(authenticated, invalidBefore.authenticated + 6, 'authentication stays before query execution');
assert.equal(listed, invalidBefore.listed, 'invalid scope must never execute list command');

const summary = await api.handle({
  request: { url: '/api/schedules?scope=failed&view=summary' },
  method: 'GET', pathname: '/api/schedules', headers: {}
});
assert.equal(summary.status, 200);
assert.equal(summary.body.schedules.length, 1);
const text = JSON.stringify(summary.body);
for (const forbidden of ['owner-a', 'trace-private', 'provider-private-error', 'lastError', 'traceId', 'ownerId']) {
  assert.equal(text.includes(forbidden), false, `summary leaked ${forbidden}`);
}

const source = await readFile(new URL('../lib/schedule-list-scope.mjs', import.meta.url), 'utf8');
for (const forbidden of [
  'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'Authorization',
  'child_process', 'exec(', 'spawn(', 'shell: true', 'shell=True', 'fetch(', 'http.request', 'https.request'
]) {
  assert.equal(source.includes(forbidden), false, `scope helper introduced forbidden surface: ${forbidden}`);
}
assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(SCHEDULE_LIST_SCOPES, value\)/);
assert.match(source, /new Set\(\['scheduled', 'running'\]\)/);
assert.match(source, /new Set\(\['completed', 'failed', 'cancelled'\]\)/);

const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

console.log('schedule list scope security tests passed');
