import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';
import { createPersonalMemoryServerRuntime } from '../lib/personal-memory-server-runtime.mjs';
import { PERSONAL_MEMORY_FILE_NAME } from '../lib/personal-memory-runtime.mjs';

const directory = await mkdtemp(join(tmpdir(), 'hafize-memory-production-'));
const authToken = 'memory-production-auth-token-1234567890';
const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: authToken,
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'memory-production-user',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 61).toString('base64'),
  HAFIZE_MEMORY_KEY_B64: Buffer.alloc(32, 73).toString('base64'),
  HAFIZE_MEMORY_STORAGE_DIR: directory
};

function input(method, pathname, { body = {}, search = '', authorized = true, approvalToken = '' } = {}) {
  const headers = authorized ? { authorization: `Bearer ${authToken}` } : {};
  if (approvalToken) headers[PERSONAL_MEMORY_APPROVAL_HTTP.header] = approvalToken;
  return {
    request: { body },
    method,
    pathname,
    url: new URL(`http://localhost${pathname}${search}`),
    headers
  };
}

async function approvedMutation(runtime, { command, method, pathname, body }) {
  const prepared = await runtime.handle(input('POST', PERSONAL_MEMORY_APPROVAL_HTTP.path, { body: { command } }));
  assert.equal(prepared.status, 200);
  assert.deepEqual(prepared.body.command, command);
  return runtime.handle(input(method, pathname, { body, approvalToken: prepared.body.approvalToken }));
}

try {
  const disabled = await createPersonalMemoryServerRuntime({
    env: {},
    readJson: async (request) => request.body
  });
  assert.equal(disabled.configured, false);
  assert.deepEqual(await disabled.handle(input('GET', '/api/memory')), { matched: false });

  const runtime = await createPersonalMemoryServerRuntime({
    env,
    readJson: async (request) => request.body
  });
  assert.equal(runtime.configured, true);

  let response = await runtime.handle(input('GET', '/api/memory', {
    search: '?query=tenis',
    authorized: false
  }));
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'AUTH_REQUIRED' });

  const writeBody = {
    kind: 'preference',
    content: 'Tenis oynamayı seviyorum',
    sourceType: 'user_statement',
    sensitivity: 'personal',
    explicitUserIntent: true
  };
  response = await approvedMutation(runtime, {
    command: { kind: 'write', body: writeBody },
    method: 'POST',
    pathname: '/api/memory',
    body: writeBody
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.record.content, 'Tenis oynamayı seviyorum');
  assert.equal('ownerId' in response.body.record, false);
  const memoryId = response.body.record.memoryId;
  assert.match(memoryId, /^memory_/);

  response = await runtime.handle(input('GET', '/api/memory', { search: '?query=Tenis&limit=5' }));
  assert.equal(response.status, 200);
  assert.equal(response.body.records.length, 1);
  assert.equal(response.body.records[0].memoryId, memoryId);
  assert.equal('ownerId' in response.body.records[0], false);

  const encrypted = await readFile(join(directory, PERSONAL_MEMORY_FILE_NAME), 'utf8');
  assert.equal(encrypted.includes('Tenis oynamayı seviyorum'), false);
  assert.equal(encrypted.includes('memory-production-user'), false);
  assert.equal(encrypted.includes(authToken), false);

  const deleteBody = { exactMatch: true, explicitUserIntent: true };
  response = await approvedMutation(runtime, {
    command: { kind: 'delete-one', memoryId, body: deleteBody },
    method: 'DELETE',
    pathname: `/api/memory/${memoryId}`,
    body: deleteBody
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });

  response = await runtime.handle(input('GET', '/api/memory', { search: '?query=Tenis' }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.records, []);

  response = await runtime.handle(input('POST', '/api/memory', {
    body: {
      kind: 'preference',
      content: 'Sessizce yazılmamalı',
      sourceType: 'user_statement',
      sensitivity: 'personal',
      explicitUserIntent: false
    }
  }));
  assert.equal(response.status, 400);

  response = await runtime.handle(input('DELETE', '/api/memory', {
    body: { explicitUserIntent: true, confirmDeleteAll: false }
  }));
  assert.equal(response.status, 400);
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('personal memory production runtime tests passed');
