import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi } from '../lib/personal-memory-http-api.mjs';

function createHarness() {
  let readJsonCalls = 0;
  const writes = [];
  const removals = [];
  const exports = [];
  const deletes = [];

  const runtime = {
    configured: true,
    authenticate(headers) {
      if (headers?.cookie === 'session=ok') return { ownerId: 'owner-session', authMode: 'session' };
      if (headers?.authorization === 'Bearer service') return { ownerId: 'owner-service', authMode: 'bearer' };
      return null;
    },
    authorizeMutation({ headers, ownership }) {
      if (ownership?.authMode === 'bearer') return { ok: true };
      if (ownership?.authMode !== 'session') return { ok: false, error: 'AUTH_REQUIRED' };
      return headers?.origin === 'https://hafize.example'
        ? { ok: true }
        : { ok: false, error: 'ORIGIN_REQUIRED' };
    },
    memory: {
      read({ ownerId }) {
        return { ok: true, records: [{ ownerId, id: 'mem-1', text: 'test' }] };
      },
      async write(input) {
        writes.push(input);
        return { ok: true, record: { ...input, id: 'mem-2' } };
      },
      async remove(input) {
        removals.push(input);
        return { ok: true, removed: true };
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

const url = new URL('https://hafize.example/api/memory');

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
    request: { body: { text: 'new memory', explicitUserIntent: true } },
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
    request: { body: { text: 'new memory', explicitUserIntent: true } },
    method: 'POST',
    pathname: '/api/memory',
    url,
    headers: { cookie: 'session=ok', origin: 'https://hafize.example' }
  });
  assert.equal(response.status, 200);
  assert.equal(h.readJsonCalls, 1);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].ownerId, 'owner-session');
}

{
  const h = createHarness();
  const response = await h.api.handle({
    request: { body: { text: 'server memory', explicitUserIntent: true } },
    method: 'POST',
    pathname: '/api/memory',
    url,
    headers: { authorization: 'Bearer service' }
  });
  assert.equal(response.status, 200, 'server bearer flow must remain compatible without browser Origin');
  assert.equal(h.writes[0].ownerId, 'owner-service');
}

for (const scenario of [
  { method: 'POST', pathname: '/api/memory/export', body: { explicitUserIntent: true }, list: 'exports' },
  { method: 'DELETE', pathname: '/api/memory', body: { explicitUserIntent: true }, list: 'deletes' },
  { method: 'DELETE', pathname: '/api/memory/mem-1', body: { exactMatch: true, explicitUserIntent: true }, list: 'removals' }
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
