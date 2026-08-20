import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi, PERSONAL_MEMORY_APPROVAL_HTTP } from '../lib/personal-memory-http-api.mjs';

const OWNER = `owner_${'a'.repeat(43)}`;
const TOKEN = `mw1.${'a'.repeat(20)}.${'b'.repeat(43)}`;
const MEMORY_ID = `memory_${'m'.repeat(12)}`;

function requestBody(value) {
  return { value };
}

function makeRuntime({ consumeError = null } = {}) {
  const calls = { prepare: [], consume: [], write: [], remove: [], deleteOwner: [], exportOwner: [] };
  const runtime = {
    configured: true,
    authenticate() { return { ownerId: OWNER, authMode: 'session' }; },
    authorizeMutation() { return { ok: true }; },
    approval: {
      prepare(command, context) {
        calls.prepare.push({ command, context });
        return { approvalToken: TOKEN, expiresAt: '2027-01-01T00:00:00.000Z', command };
      },
      async consume(command, context) {
        calls.consume.push({ command, context });
        if (consumeError) {
          const error = new Error(consumeError);
          error.code = consumeError;
          throw error;
        }
        return command;
      }
    },
    memory: {
      read() { return { ok: true, records: [] }; },
      async write(input) { calls.write.push(input); return { ok: true, record: { ...input, memoryId: MEMORY_ID } }; },
      async remove(input) { calls.remove.push(input); return { ok: true, deleted: 1 }; },
      async deleteOwner(input) { calls.deleteOwner.push(input); return { ok: true, deleted: 2 }; },
      exportOwner(input) { calls.exportOwner.push(input); return { ok: true, records: [] }; }
    }
  };
  return { runtime, calls };
}

async function invoke(api, { method = 'POST', pathname = '/api/memory', body, token } = {}) {
  return api.handle({
    request: requestBody(body),
    method,
    pathname,
    url: new URL(`https://hafize.invalid${pathname}`),
    headers: { origin: 'https://hafize.invalid', ...(token ? { [PERSONAL_MEMORY_APPROVAL_HTTP.header]: token } : {}) }
  });
}

function createApi(runtime) {
  return createPersonalMemoryHttpApi({
    runtime,
    readJson: async (request) => request.value
  });
}

const writeBody = {
  kind: 'preference',
  content: 'Tenisi seviyorum',
  sourceType: 'user_note',
  sensitivity: 'personal',
  explicitUserIntent: true
};

{
  const { runtime, calls } = makeRuntime();
  const api = createApi(runtime);
  const command = { kind: 'write', body: writeBody };
  const response = await invoke(api, {
    pathname: PERSONAL_MEMORY_APPROVAL_HTTP.path,
    body: { command }
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.approvalToken, TOKEN);
  assert.deepEqual(calls.prepare, [{ command, context: { ownerId: OWNER } }]);
  assert.equal(calls.write.length, 0);
}

{
  const { runtime, calls } = makeRuntime();
  const api = createApi(runtime);
  const response = await invoke(api, { body: writeBody });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'MEMORY_APPROVAL_REQUIRED');
  assert.equal(calls.consume.length, 0);
  assert.equal(calls.write.length, 0, 'missing approval cannot reach persistent write');
}

{
  const { runtime, calls } = makeRuntime();
  const api = createApi(runtime);
  const response = await invoke(api, { body: writeBody, token: TOKEN });
  assert.equal(response.status, 200);
  assert.equal(calls.consume.length, 1);
  assert.deepEqual(calls.consume[0], {
    command: { kind: 'write', body: writeBody },
    context: { ownerId: OWNER, approvalToken: TOKEN }
  });
  assert.equal(calls.write.length, 1);
  assert.equal(calls.write[0].ownerId, OWNER);
  assert.equal(response.body.record.ownerId, undefined, 'owner id is never reflected to client');
}

{
  const { runtime, calls } = makeRuntime();
  const api = createApi(runtime);
  const body = { exactMatch: true, explicitUserIntent: true };
  const response = await invoke(api, {
    method: 'DELETE',
    pathname: `/api/memory/${MEMORY_ID}`,
    body,
    token: TOKEN
  });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.consume[0].command, { kind: 'delete-one', memoryId: MEMORY_ID, body });
  assert.deepEqual(calls.remove[0], { ownerId: OWNER, memoryId: MEMORY_ID, exactMatch: true });
}

{
  const { runtime, calls } = makeRuntime({ consumeError: 'MEMORY_APPROVAL_REPLAYED' });
  const api = createApi(runtime);
  const response = await invoke(api, { body: writeBody, token: TOKEN });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'MEMORY_APPROVAL_REPLAYED');
  assert.equal(calls.write.length, 0, 'replayed approval fails before persistence');
}

{
  const { runtime } = makeRuntime({ consumeError: 'MEMORY_APPROVAL_EXPIRED' });
  const api = createApi(runtime);
  const response = await invoke(api, { body: writeBody, token: TOKEN });
  assert.equal(response.status, 410);
  assert.equal(response.body.error, 'MEMORY_APPROVAL_EXPIRED');
}

{
  const { runtime, calls } = makeRuntime();
  runtime.authorizeMutation = () => ({ ok: false, error: 'ORIGIN_REQUIRED' });
  const api = createApi(runtime);
  const response = await invoke(api, {
    pathname: PERSONAL_MEMORY_APPROVAL_HTTP.path,
    body: { command: { kind: 'write', body: writeBody } }
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error, 'ORIGIN_REQUIRED');
  assert.equal(calls.prepare.length, 0, 'approval issuance itself is same-origin guarded');
}

{
  const { runtime } = makeRuntime();
  assert.throws(
    () => createPersonalMemoryHttpApi({ runtime: { ...runtime, approval: null }, readJson: async () => ({}) }),
    /INVALID_MEMORY_HTTP_API:approval/
  );
}

console.log('personal memory HTTP approval tests passed');
