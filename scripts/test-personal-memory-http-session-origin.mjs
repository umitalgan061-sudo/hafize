import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi, PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';

const SESSION_OWNER = `owner_${'s'.repeat(43)}`;
const SERVICE_OWNER = `owner_${'b'.repeat(43)}`;
const APPROVAL = 'session-origin-approved';
const MEMORY_ID = 'memory_12345678';
const WRITE_BODY = Object.freeze({
  kind: 'note',
  content: 'new memory',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
});

function createHarness() {
  let readJsonCalls = 0;
  const writes = [];
  const removals = [];
  const exports = [];
  const deletes = [];

  const runtime = {
    configured: true,
    authenticate(headers) {
      if (headers?.cookie === 'session=ok') return { ownerId: SESSION_OWNER, authMode: 'session' };
      if (headers?.authorization === 'Bearer service') return { ownerId: SERVICE_OWNER, authMode: 'bearer' };
      return null;
    },
    authorizeMutation({ headers, ownership }) {
      if (ownership?.authMode === 'bearer') return { ok: true };
      if (ownership?.authMode !== 'session') return { ok: false, error: 'AUTH_REQUIRED' };
      return headers?.origin === 'https://hafize.example'
        ? { ok: true }
        : { ok: false, error: 'ORIGIN_REQUIRED' };
    },
    approval: {
      prepare(command) { return { approvalToken: APPROVAL, expiresAt: '2027-01-01T00:00:00.000Z', command }; },
      consume(command, { approvalToken }) {
        assert.equal(approvalToken, APPROVAL);
        return command;
      }
    },
    memory: {
      read({ ownerId }) {
        return { ok: true, records: [{ ownerId, id: MEMORY_ID, text: 'test' }] };
      },
      async write(input) {
        writes.push(input);
        return { ok: true, record: { ...input, id: MEMORY_ID } };
      },
      async remove(input) {
        removals.push(input);
        return { ok: true, deleted: 1 };
      },
      exportOwner(input) {
        exports.push(input);
        return { ok: true, records: [] };
      },
      async deleteOwner(input) {
        deletes.push(input);
        return { ok: true, deleted: 1 };
      }
    }
  };

  const api = createPersonalMemoryHttpApi({
    runtime,
    async readJson(request) {
      readJsonCalls += 1;
      return request?.body || {};
    }
  });

  return {
    api,
    get readJsonCalls() { return readJsonCalls; },
    writes,
    removals,
    exports,
    deletes
  };
}

const url = new URL('https://hafize.example/api/memory?query=test');

{
  const h = createHarness();
  const response = await h.api.handle({
    method: 'GET',
    pathname: '/api/memory',
    url,
    headers: { cookie: 'session=ok' }
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.records[0].ownerId, undefined, 'owner id must remain redacted');
  assert.equal(h.readJsonCalls, 0);
}

for (const origin of [undefined, 'https://evil.example']) {
  const h = createHarness();
  const response = await h.api.handle({
    request: { body: WRITE_BODY },
    method: 'POST',
    pathname: '/api/memory',
    url,
    headers: { cookie: 'session=ok', ...(origin ? { origin } : {}) }
  });
  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: 'ORIGIN_REQUIRED' });
  assert.equal(h.readJsonCalls, 0, 'rejected session mutation must not consume request body');
  assert.equal(h.writes.length, 0);
}

{
  const h = createHarness();
  const response = await h.api.handle({
    request: { body: WRITE_BODY },
    method: 'POST',
    pathname: '/api/memory',
    url,
    headers: {
      cookie: 'session=ok',
      origin: 'https://hafize.example',
      [PERSONAL_MEMORY_APPROVAL_HTTP.header]: APPROVAL
    }
  });
  assert.equal(response.status, 200);
  assert.equal(h.readJsonCalls, 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].ownerId, SESSION_OWNER);
}

{
  const h = createHarness();
  const response = await h.api.handle({
    request: { body: { ...WRITE_BODY, content: 'server memory' } },
    method: 'POST',
    pathname: '/api/memory',
    url,
    headers: { authorization: 'Bearer service', [PERSONAL_MEMORY_APPROVAL_HTTP.header]: APPROVAL }
  });
  assert.equal(response.status, 200, 'server bearer flow remains Origin-independent but still requires approval');
  assert.equal(h.writes[0].ownerId, SERVICE_OWNER);
}

for (const scenario of [
  { method: 'POST', pathname: '/api/memory/export', body: { explicitUserIntent: true }, list: 'exports' },
  { method: 'DELETE', pathname: '/api/memory', body: { explicitUserIntent: true, confirmDeleteAll: true }, list: 'deletes' },
  { method: 'DELETE', pathname: `/api/memory/${MEMORY_ID}`, body: { exactMatch: true, explicitUserIntent: true }, list: 'removals' }
]) {
  const h = createHarness();
  const denied = await h.api.handle({
    request: { body: scenario.body },
    method: scenario.method,
    pathname: scenario.pathname,
    url: new URL(`https://hafize.example${scenario.pathname}`),
    headers: { cookie: 'session=ok', origin: 'https://evil.example' }
  });
  assert.equal(denied.status, 403, `${scenario.pathname} must reject cross-origin session mutation`);
  assert.equal(h.readJsonCalls, 0);
  assert.equal(h[scenario.list].length, 0);
}

{
  const h = createHarness();
  const response = await h.api.handle({
    method: 'GET',
    pathname: '/api/memory',
    url,
    headers: {}
  });
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'AUTH_REQUIRED' });
}

console.log('personal memory HTTP session origin tests passed');
