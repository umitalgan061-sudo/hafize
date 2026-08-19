import assert from 'node:assert/strict';
import {
  createPersonalMemoryWriteApprovalService,
  PERSONAL_MEMORY_WRITE_APPROVAL_POLICY
} from '../lib/personal-memory-write-approval.mjs';

const KEY_A = Buffer.alloc(32, 7).toString('base64');
const KEY_B = Buffer.alloc(32, 8).toString('base64');
const BASE_WRITE = Object.freeze({
  ownerId: 'owner_123',
  kind: 'preference',
  content: 'Tenisi severim',
  sourceType: 'user_statement',
  sourceRef: null,
  sensitivity: 'personal'
});

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code && error?.message === code);
}

let clock = 1_700_000_000_000;
let nonceCounter = 0;
const service = createPersonalMemoryWriteApprovalService({
  memoryKeyBase64: KEY_A,
  now: () => clock,
  ttlMs: 2_000,
  randomBytesImpl: () => Buffer.alloc(18, ++nonceCounter)
});

const issued = service.issue(BASE_WRITE);
assert.equal(typeof issued.approvalReceipt, 'string');
assert.equal(issued.expiresAt, clock + 2_000);
assert.equal(service.consume({ approvalReceipt: issued.approvalReceipt, payload: BASE_WRITE }).ok, true);
expectCode(
  () => service.consume({ approvalReceipt: issued.approvalReceipt, payload: BASE_WRITE }),
  'MEMORY_WRITE_APPROVAL_REPLAYED'
);

const retarget = service.issue(BASE_WRITE);
expectCode(
  () => service.consume({ approvalReceipt: retarget.approvalReceipt, payload: { ...BASE_WRITE, content: 'Başka içerik' } }),
  'MEMORY_WRITE_APPROVAL_INVALID'
);
assert.equal(service.consume({ approvalReceipt: retarget.approvalReceipt, payload: BASE_WRITE }).ok, true);

const differentOwner = service.issue(BASE_WRITE);
expectCode(
  () => service.consume({ approvalReceipt: differentOwner.approvalReceipt, payload: { ...BASE_WRITE, ownerId: 'owner_456' } }),
  'MEMORY_WRITE_APPROVAL_INVALID'
);

const differentKind = service.issue(BASE_WRITE);
expectCode(
  () => service.consume({ approvalReceipt: differentKind.approvalReceipt, payload: { ...BASE_WRITE, kind: 'note' } }),
  'MEMORY_WRITE_APPROVAL_INVALID'
);

const expiring = service.issue(BASE_WRITE);
clock += 2_000;
expectCode(
  () => service.consume({ approvalReceipt: expiring.approvalReceipt, payload: BASE_WRITE }),
  'MEMORY_WRITE_APPROVAL_EXPIRED'
);

clock += 1;
const foreignService = createPersonalMemoryWriteApprovalService({
  memoryKeyBase64: KEY_B,
  now: () => clock,
  randomBytesImpl: () => Buffer.alloc(18, 31)
});
const ownReceipt = service.issue(BASE_WRITE);
expectCode(
  () => foreignService.consume({ approvalReceipt: ownReceipt.approvalReceipt, payload: BASE_WRITE }),
  'MEMORY_WRITE_APPROVAL_INVALID'
);

const tampered = ownReceipt.approvalReceipt.slice(0, -1)
  + (ownReceipt.approvalReceipt.endsWith('A') ? 'B' : 'A');
expectCode(() => service.consume({ approvalReceipt: tampered, payload: BASE_WRITE }), 'MEMORY_WRITE_APPROVAL_INVALID');
expectCode(() => service.consume({ approvalReceipt: 'not-a-receipt', payload: BASE_WRITE }), 'MEMORY_WRITE_APPROVAL_INVALID');
expectCode(() => service.consume({ approvalReceipt: '', payload: BASE_WRITE }), 'MEMORY_WRITE_APPROVAL_INVALID');

expectCode(
  () => createPersonalMemoryWriteApprovalService({ memoryKeyBase64: 'bad' }),
  'MEMORY_WRITE_APPROVAL_CONFIG_INVALID'
);
expectCode(
  () => createPersonalMemoryWriteApprovalService({ memoryKeyBase64: KEY_A, ttlMs: 999 }),
  'MEMORY_WRITE_APPROVAL_CONFIG_INVALID'
);
expectCode(
  () => createPersonalMemoryWriteApprovalService({ memoryKeyBase64: KEY_A, ttlMs: 300_001 }),
  'MEMORY_WRITE_APPROVAL_CONFIG_INVALID'
);

assert.equal(PERSONAL_MEMORY_WRITE_APPROVAL_POLICY.defaultTtlMs, 120_000);
assert.equal(PERSONAL_MEMORY_WRITE_APPROVAL_POLICY.maxTtlMs, 300_000);
assert.equal(PERSONAL_MEMORY_WRITE_APPROVAL_POLICY.replayScope, 'process-local');

console.log('personal memory write approval tests passed');
