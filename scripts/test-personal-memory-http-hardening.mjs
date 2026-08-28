import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi, PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';

const OWNER = `owner_${'h'.repeat(43)}`;
const APPROVAL = 'hardening-approved';
const calls = [];
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
    read(input) {
      calls.push(['read', input]);
      return { ok: true, records: [{ ownerId: input.ownerId, id: 'memory_12345678', content: 'tenis' }] };
    },
    async write(input) {
      calls.push(['write', input]);
      return { ok: false, error: 'SECRET_PATH:/srv/hafize/memory.json' };
    },
    async remove(input) {
      calls.push(['remove', input]);
      return { ok: true, deleted: 1 };
    },
    exportOwner(input) {
      calls.push(['export', input]);
      return { ok: true, records: [{ ownerId: input.ownerId, id: 'memory_12345678' }] };
    },
    async deleteOwner(input) {
      calls.push(['deleteOwner', input]);
      return { ok: true, deleted: 2 };
    }
  }
};
let body = {};
const api = createPersonalMemoryHttpApi({ runtime, readJson: async () => body });
const base = {
  request: {},
  headers: { authorization: 'Bearer ok', [PERSONAL_MEMORY_APPROVAL_HTTP.header]: APPROVAL },
  method: 'GET',
  pathname: '/api/memory'
};

async function get(search) {
  return api.handle({ ...base, url: new URL(`http://localhost/api/memory${search}`) });
}

let response = await get('?query=tenis&kinds=preference&limit=3');
assert.equal(response.status, 200);
assert.equal(calls.length, 1);
assert.deepEqual(calls[0][1], { ownerId: OWNER, query: 'tenis', kinds: ['preference'], limit: 3 });
assert.equal('ownerId' in response.body.records[0], false);

for (const search of [
  '?query=tenis&ownerId=attacker',
  '?query=tenis&limit=NaN',
  '?query=tenis&limit=21',
  '?query=tenis&query=other',
  '?query=tenis&kinds=preference,preference',
  '?query=tenis&kinds=unknown',
  ''
]) {
  const before = calls.length;
  response = await get(search);
  assert.equal(response.status, 400, search);
  assert.equal(calls.length, before, `storage called for invalid query ${search}`);
}

response = await api.handle({ ...base, headers: {}, url: new URL('http://localhost/api/memory?query=x') });
assert.equal(response.status, 401);
assert.equal(calls.length, 1);

body = {
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_statement',
  sensitivity: 'personal',
  explicitUserIntent: true
};
response = await api.handle({
  ...base,
  method: 'POST',
  request: {},
  url: new URL('http://localhost/api/memory')
});
assert.equal(response.status, 400);
assert.deepEqual(response.body, { error: 'MEMORY_OPERATION_FAILED' });
assert.equal(JSON.stringify(response).includes('/srv/hafize/memory.json'), false);
assert.equal(calls.at(-1)[0], 'write');
assert.equal(calls.at(-1)[1].ownerId, OWNER);

body = { explicitUserIntent: true, ownerId: 'attacker' };
const beforeExport = calls.length;
response = await api.handle({
  ...base,
  method: 'POST',
  pathname: '/api/memory/export',
  request: {},
  url: new URL('http://localhost/api/memory/export')
});
assert.equal(response.status, 400);
assert.equal(calls.length, beforeExport);

body = { exactMatch: true, explicitUserIntent: true };
response = await api.handle({
  ...base,
  method: 'DELETE',
  pathname: '/api/memory/memory_12345678',
  request: {},
  url: new URL('http://localhost/api/memory/memory_12345678')
});
assert.equal(response.status, 200);
assert.deepEqual(calls.at(-1)[1], { ownerId: OWNER, memoryId: 'memory_12345678', exactMatch: true });

console.log('personal memory HTTP hardening tests passed');
