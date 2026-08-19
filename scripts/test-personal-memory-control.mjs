import assert from 'node:assert/strict';
import { createPersonalMemoryControlRuntime } from '../lib/personal-memory-control-runtime.mjs';
import { createPersonalMemoryHttpApi } from '../lib/personal-memory-http-api.mjs';

const env = {
  HAFIZE_CONNECTOR_AUTH_TOKEN: 'x'.repeat(40),
  HAFIZE_CONNECTOR_AUTH_SUBJECT: 'user@example.com',
  HAFIZE_CONNECTOR_OWNER_KEY_B64: Buffer.alloc(32, 2).toString('base64'),
  HAFIZE_MEMORY_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
  HAFIZE_MEMORY_STORAGE_DIR: '/srv/hafize'
};
const calls = [];
const memory = {
  async open() { calls.push('open'); },
  read(input) { calls.push(['read', input]); return { ok: true, records: [{ ownerId: input.ownerId, id: 'memory_12345678', content: 'tenis' }] }; },
  async write(input) { calls.push(['write', input]); return { ok: true, record: { ownerId: input.ownerId, id: 'memory_12345678', content: input.content } }; },
  async remove(input) { calls.push(['remove', input]); return { ok: true, deleted: 1 }; },
  exportOwner(input) { calls.push(['export', input]); return { ok: true, records: [{ ownerId: input.ownerId, id: 'memory_12345678', content: 'tenis' }] }; },
  async deleteOwner(input) { calls.push(['deleteOwner', input]); return { ok: true, deleted: 2 }; }
};
let authOptions, ownerOptions, memoryOptions;
const runtime = await createPersonalMemoryControlRuntime({
  env,
  createAuthenticator(options) {
    authOptions = options;
    return { authenticate({ headers }) { return headers?.authorization === 'Bearer ok' ? { ok: true, principal: { authenticated: true, subject: 'user@example.com' } } : { ok: false }; } };
  },
  createOwnerResolver(options) { ownerOptions = options; return { resolve() { return { ownerId: 'owner_private' }; } }; },
  createMemoryRuntime(options) { memoryOptions = options; return memory; }
});
assert.equal(runtime.configured, true);
assert.equal(calls[0], 'open');
assert.equal(authOptions.token, env.HAFIZE_CONNECTOR_AUTH_TOKEN);
assert.equal(authOptions.subject, env.HAFIZE_CONNECTOR_AUTH_SUBJECT);
assert.deepEqual(ownerOptions.key, Buffer.alloc(32, 2));
assert.equal(memoryOptions.env, env);
assert.deepEqual(runtime.authenticate({ authorization: 'Bearer ok' }), { ownerId: 'owner_private', authMode: 'bearer' });
assert.equal(runtime.authenticate({}), null);

const disabled = await createPersonalMemoryControlRuntime({ env: {} });
assert.equal(disabled.configured, false);
for (const bad of [
  { HAFIZE_MEMORY_KEY_B64: env.HAFIZE_MEMORY_KEY_B64 },
  { ...env, HAFIZE_CONNECTOR_AUTH_TOKEN: '' },
  { ...env, HAFIZE_CONNECTOR_OWNER_KEY_B64: 'bad' }
]) await assert.rejects(() => createPersonalMemoryControlRuntime({
  env: bad,
  createAuthenticator: () => ({ authenticate() { return { ok: false }; } }),
  createOwnerResolver: () => ({ resolve() { return { ownerId: 'x' }; } }),
  createMemoryRuntime: () => memory
}), /INVALID_MEMORY_CONTROL_RUNTIME/);

let nextBody = {};
const api = createPersonalMemoryHttpApi({ runtime, readJson: async () => nextBody });
const base = { headers: { authorization: 'Bearer ok' }, request: {}, url: new URL('http://localhost/api/memory?query=spor&kinds=preference&limit=3') };
let response = await api.handle({ ...base, method: 'GET', pathname: '/api/memory' });
assert.equal(response.status, 200);
assert.equal('ownerId' in response.body.records[0], false);
assert.deepEqual(calls.at(-1)[1], { ownerId: 'owner_private', query: 'spor', kinds: ['preference'], limit: 3 });

nextBody = { explicitUserIntent: true };
response = await api.handle({ ...base, method: 'POST', pathname: '/api/memory/export' });
assert.equal(response.status, 200);
assert.equal('ownerId' in response.body.records[0], false);
assert.deepEqual(calls.at(-1)[1], { ownerId: 'owner_private', explicitUserIntent: true });

nextBody = { explicitUserIntent: true, confirmDeleteAll: true };
response = await api.handle({ ...base, method: 'DELETE', pathname: '/api/memory' });
assert.equal(response.status, 200);
assert.deepEqual(calls.at(-1)[1], { ownerId: 'owner_private', confirmOwnerId: 'owner_private', explicitUserIntent: true });

nextBody = { explicitUserIntent: true };
response = await api.handle({ ...base, method: 'DELETE', pathname: '/api/memory' });
assert.equal(response.status, 400);

const writeApproval = {
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_statement',
  sensitivity: 'personal',
  explicitUserIntent: true
};
nextBody = writeApproval;
response = await api.handle({ ...base, method: 'POST', pathname: '/api/memory/approval' });
assert.equal(response.status, 200);
assert.equal(response.body.ok, true);
assert.equal(typeof response.body.approvalReceipt, 'string');
assert.ok(response.body.approvalReceipt.length > 0);

const approvedWrite = {
  kind: writeApproval.kind,
  content: writeApproval.content,
  sourceType: writeApproval.sourceType,
  sensitivity: writeApproval.sensitivity,
  approvalReceipt: response.body.approvalReceipt
};
nextBody = approvedWrite;
response = await api.handle({ ...base, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 200);
assert.equal('ownerId' in response.body.record, false);
assert.equal(calls.at(-1)[1].ownerId, 'owner_private');
const writesAfterApproval = calls.filter((call) => Array.isArray(call) && call[0] === 'write').length;

nextBody = approvedWrite;
response = await api.handle({ ...base, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 403);
assert.equal(response.body.error, 'MEMORY_WRITE_APPROVAL_INVALID');
assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'write').length, writesAfterApproval);

nextBody = { kind: 'preference', content: 'sessiz yaz', sourceType: 'user_statement', sensitivity: 'personal' };
response = await api.handle({ ...base, method: 'POST', pathname: '/api/memory' });
assert.equal(response.status, 400);
assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'write').length, writesAfterApproval);

nextBody = { exactMatch: true, explicitUserIntent: true };
response = await api.handle({ ...base, method: 'DELETE', pathname: '/api/memory/memory_12345678' });
assert.equal(response.status, 200);
assert.deepEqual(calls.at(-1)[1], { ownerId: 'owner_private', memoryId: 'memory_12345678', exactMatch: true });

nextBody = { exactMatch: true };
response = await api.handle({ ...base, method: 'DELETE', pathname: '/api/memory/memory_12345678' });
assert.equal(response.status, 400);
response = await api.handle({ ...base, headers: {}, method: 'GET', pathname: '/api/memory' });
assert.equal(response.status, 401);
response = await api.handle({ ...base, method: 'PUT', pathname: '/api/memory' });
assert.equal(response.status, 405);
response = await api.handle({ ...base, method: 'GET', pathname: '/api/other' });
assert.equal(response.matched, false);
console.log('personal memory control tests passed');
