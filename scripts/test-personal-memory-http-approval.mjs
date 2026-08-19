import assert from 'node:assert/strict';
import { createPersonalMemoryHttpApi } from '../lib/personal-memory-http-api.mjs';
import { createPersonalMemoryWriteApprovalService } from '../lib/personal-memory-write-approval.mjs';

const ownerId = 'owner_http_test';
let clock = 1_700_000_000_000;
let nonce = 0;
const writeApproval = createPersonalMemoryWriteApprovalService({
  memoryKeyBase64: Buffer.alloc(32, 11).toString('base64'),
  now: () => clock,
  ttlMs: 2_000,
  randomBytesImpl: () => Buffer.alloc(18, ++nonce)
});
const writes = [];
const runtime = {
  configured: true,
  authenticate: () => ({ ownerId, authMode: 'session' }),
  authorizeMutation: () => ({ ok: true }),
  writeApproval,
  memory: {
    read: () => ({ ok: true, records: [] }),
    exportOwner: () => ({ ok: true, records: [] }),
    deleteOwner: async () => ({ ok: true, deleted: 0 }),
    remove: async () => ({ ok: true, deleted: 0 }),
    write: async (command) => {
      writes.push(command);
      return { ok: true, record: { memoryId: 'memory_12345678', ...command } };
    }
  }
};
const api = createPersonalMemoryHttpApi({ runtime, readJson: async (request) => request.body });
const base = {
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_note',
  sensitivity: 'personal'
};
async function call(pathname, body, method = 'POST') {
  return api.handle({
    request: { body },
    method,
    pathname,
    url: new URL(`https://hafize.test${pathname}`),
    headers: { origin: 'https://hafize.test' }
  });
}

let result = await call('/api/memory', { ...base, explicitUserIntent: true });
assert.equal(result.status, 400);
assert.equal(result.body.error, 'MEMORY_WRITE_APPROVAL_REQUIRED');
assert.equal(writes.length, 0);

result = await call('/api/memory/approval', base);
assert.equal(result.status, 400);
assert.equal(result.body.error, 'MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT');

const approval = await call('/api/memory/approval', { ...base, explicitUserIntent: true });
assert.equal(approval.status, 200);
assert.equal(approval.body.ok, true);
assert.equal(typeof approval.body.approvalReceipt, 'string');
assert.equal(writes.length, 0);

result = await call('/api/memory', { ...base, approvalReceipt: approval.body.approvalReceipt });
assert.equal(result.status, 200);
assert.equal(result.body.ok, true);
assert.equal(writes.length, 1);
assert.deepEqual(writes[0], {
  ownerId,
  ...base,
  sourceRef: null,
  explicitUserIntent: true
});
assert.equal(Object.hasOwn(result.body.record, 'ownerId'), false);

result = await call('/api/memory', { ...base, approvalReceipt: approval.body.approvalReceipt });
assert.equal(result.status, 403);
assert.equal(result.body.error, 'MEMORY_WRITE_APPROVAL_INVALID');
assert.equal(writes.length, 1);

const retargetApproval = await call('/api/memory/approval', { ...base, explicitUserIntent: true });
result = await call('/api/memory', {
  ...base,
  content: 'Değiştirildi',
  approvalReceipt: retargetApproval.body.approvalReceipt
});
assert.equal(result.status, 403);
assert.equal(result.body.error, 'MEMORY_WRITE_APPROVAL_INVALID');
assert.equal(writes.length, 1);
result = await call('/api/memory', { ...base, approvalReceipt: retargetApproval.body.approvalReceipt });
assert.equal(result.status, 200);
assert.equal(writes.length, 2);

const expiringApproval = await call('/api/memory/approval', { ...base, explicitUserIntent: true });
clock += 2_000;
result = await call('/api/memory', { ...base, approvalReceipt: expiringApproval.body.approvalReceipt });
assert.equal(result.status, 403);
assert.equal(result.body.error, 'MEMORY_WRITE_APPROVAL_INVALID');
assert.equal(writes.length, 2);

runtime.authenticate = () => ({ ownerId: 'owner_other', authMode: 'session' });
const otherOwnerApproval = await call('/api/memory/approval', { ...base, explicitUserIntent: true });
runtime.authenticate = () => ({ ownerId, authMode: 'session' });
result = await call('/api/memory', { ...base, approvalReceipt: otherOwnerApproval.body.approvalReceipt });
assert.equal(result.status, 403);
assert.equal(writes.length, 2);

const deniedRuntime = { ...runtime, authorizeMutation: () => ({ ok: false, error: 'ORIGIN_REQUIRED' }) };
const deniedApi = createPersonalMemoryHttpApi({ runtime: deniedRuntime, readJson: async (request) => request.body });
result = await deniedApi.handle({
  request: { body: { ...base, explicitUserIntent: true } },
  method: 'POST',
  pathname: '/api/memory/approval',
  url: new URL('https://hafize.test/api/memory/approval'),
  headers: {}
});
assert.equal(result.status, 403);
assert.equal(result.body.error, 'ORIGIN_REQUIRED');

assert.throws(
  () => createPersonalMemoryHttpApi({ runtime: { ...runtime, writeApproval: null }, readJson: async () => ({}) }),
  /INVALID_MEMORY_HTTP_API:writeApproval/
);
console.log('personal memory HTTP approval tests passed');
