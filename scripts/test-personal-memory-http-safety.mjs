import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi, PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';

const OWNER = `owner_${'s'.repeat(43)}`;
const APPROVAL = 'safety-approved';
const calls = [];
let body = {};
const runtime = {
  configured: true,
  authenticate(headers) {
    return headers?.authorization === 'Bearer ok' ? { ownerId: OWNER, authMode: 'bearer' } : null;
  },
  authorizeMutation() { return { ok: true }; },
  approval: {
    prepare(command) { return { approvalToken: APPROVAL, expiresAt: '2027-01-01T00:00:00.000Z', command }; },
    consume(command, { approvalToken }) {
      assert.equal(approvalToken, APPROVAL);
      return command;
    }
  },
  memory: {
    read(input) { calls.push(['read', input]); return { ok: true, records: [] }; },
    write(input) { calls.push(['write', input]); return Promise.resolve({ ok: true, record: input }); },
    remove(input) { calls.push(['remove', input]); return Promise.resolve({ ok: true, deleted: 1 }); },
    exportOwner(input) { calls.push(['export', input]); return { ok: true, records: [] }; },
    deleteOwner(input) { calls.push(['deleteOwner', input]); return Promise.resolve({ ok: true, deleted: 0 }); }
  }
};
const api = createPersonalMemoryHttpApi({ runtime, readJson: async () => body });
const request = {
  request: {},
  headers: { authorization: 'Bearer ok', [PERSONAL_MEMORY_APPROVAL_HTTP.header]: APPROVAL },
  url: new URL('http://localhost/api/memory?query=x')
};

body = {
  ownerId: 'attacker',
  kind: 'note',
  content: 'x',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
};
let response = await api.handle({ ...request, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

body = {
  kind: 'note',
  content: 'x',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true,
  token: 'do-not-accept'
};
response = await api.handle({ ...request, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

body = { exactMatch: true, explicitUserIntent: true, ownerId: 'attacker' };
response = await api.handle({ ...request, method: 'DELETE', pathname: '/api/memory/memory_12345678' });
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

body = { explicitUserIntent: true, confirmDeleteAll: false };
response = await api.handle({ ...request, method: 'DELETE', pathname: '/api/memory' });
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

body = { explicitUserIntent: true, extra: true };
response = await api.handle({ ...request, method: 'POST', pathname: '/api/memory/export' });
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

body = {
  kind: 'note',
  content: 'accepted',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
};
response = await api.handle({ ...request, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 200);
assert.equal(calls.length, 1);
assert.equal(calls[0][1].ownerId, OWNER);
assert.equal('ownerId' in response.body.record, false);
assert.equal('token' in response.body.record, false);

assert.throws(
  () => createPersonalMemoryHttpApi({ runtime: { configured: false, authenticate() {}, authorizeMutation() {} }, readJson: async () => ({}) }),
  /notConfigured/
);
assert.throws(() => createPersonalMemoryHttpApi({ runtime, readJson: null }), /readJson/);
console.log('personal memory HTTP safety tests passed');
