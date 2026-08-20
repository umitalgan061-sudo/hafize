import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/memory-ui.js');
const TOKEN = `mw1.${'a'.repeat(20)}.${'b'.repeat(43)}`;
const MEMORY_ID = `memory_${'m'.repeat(12)}`;

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; }
  };
}

{
  const calls = [];
  const client = api.createMemoryClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
      if (path === '/api/memory/approval/prepare') {
        return response(200, { approvalToken: TOKEN, expiresAt: '2027-01-01T00:00:00.000Z' });
      }
      return response(200, { ok: true, record: { memoryId: MEMORY_ID } });
    }
  });

  const result = await client.write({ kind: 'preference', content: '  Tenisi seviyorum  ' });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, '/api/memory/approval/prepare');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].body.command, {
    kind: 'write',
    body: {
      kind: 'preference',
      content: 'Tenisi seviyorum',
      sourceType: 'user_note',
      sensitivity: 'personal',
      explicitUserIntent: true
    }
  });
  assert.equal(calls[1].path, '/api/memory');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers['X-Hafize-Memory-Approval'], TOKEN);
  assert.deepEqual(calls[1].body, calls[0].body.command.body);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.equal(calls[1].options.cache, 'no-store');
}

{
  const calls = [];
  const client = api.createMemoryClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
      if (path === '/api/memory/approval/prepare') return response(403, { error: 'ORIGIN_REQUIRED' });
      throw new Error('execute must not be reached');
    }
  });
  const result = await client.write({ kind: 'note', content: 'Onaysız yazma yok' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(calls.length, 1, 'failed approval preparation blocks persistent write');
}

{
  const calls = [];
  const client = api.createMemoryClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
      if (path === '/api/memory/approval/prepare') return response(200, { approvalToken: 'invalid-token' });
      throw new Error('execute must not be reached');
    }
  });
  const result = await client.write({ kind: 'note', content: 'Token doğrulaması' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 502);
  assert.equal(result.payload.error, 'MEMORY_APPROVAL_INVALID');
  assert.equal(calls.length, 1, 'malformed approval token is never reflected into execute request');
}

{
  const calls = [];
  const client = api.createMemoryClient({
    fetchImpl: async (path, options) => {
      calls.push({ path, options, body: options.body ? JSON.parse(options.body) : null });
      if (path === '/api/memory/approval/prepare') return response(200, { approvalToken: TOKEN });
      return response(200, { ok: true, deleted: 1 });
    }
  });
  const result = await client.remove(MEMORY_ID);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body.command, {
    kind: 'delete-one',
    memoryId: MEMORY_ID,
    body: { exactMatch: true, explicitUserIntent: true }
  });
  assert.equal(calls[1].path, `/api/memory/${MEMORY_ID}`);
  assert.equal(calls[1].options.method, 'DELETE');
  assert.equal(calls[1].options.headers['X-Hafize-Memory-Approval'], TOKEN);
}

assert.throws(() => api.createMemoryClient({ fetchImpl: null }), /INVALID_MEMORY_CLIENT_FETCH/);

console.log('memory UI approval client tests passed');
