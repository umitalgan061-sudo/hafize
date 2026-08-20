import assert from 'node:assert/strict';
import {
  createPersonalMemoryApprovalBoundary,
  normalizeMemoryApprovalCommand,
  PERSONAL_MEMORY_APPROVAL_LIMITS
} from '../lib/personal-memory-approval.mjs';

const SECRET = Buffer.alloc(32, 7);
const OWNER_A = `owner_${'a'.repeat(43)}`;
const OWNER_B = `owner_${'b'.repeat(43)}`;
const MEMORY_ID = `memory_${'m'.repeat(12)}`;
const NOW = 1_800_000_000_000;

function writeCommand(content = 'Tenisi seviyorum') {
  return {
    kind: 'write',
    body: {
      kind: 'preference',
      content,
      sourceType: 'user_note',
      sensitivity: 'personal',
      explicitUserIntent: true
    }
  };
}

assert.equal(PERSONAL_MEMORY_APPROVAL_LIMITS.defaultTtlMs, 120_000);
assert.equal(PERSONAL_MEMORY_APPROVAL_LIMITS.maxTtlMs, 300_000);

{
  const normalized = normalizeMemoryApprovalCommand({
    kind: 'write',
    body: {
      explicitUserIntent: true,
      sensitivity: 'personal',
      content: 'Tenisi seviyorum',
      kind: 'preference',
      sourceType: 'user_note'
    }
  });
  assert.deepEqual(normalized, writeCommand());
  assert.equal(Object.isFrozen(normalized), true);
  assert.equal(Object.isFrozen(normalized.body), true);
}

{
  const boundary = createPersonalMemoryApprovalBoundary({
    secret: SECRET,
    now: () => NOW,
    randomBytesImpl: () => Buffer.alloc(16, 1)
  });
  const prepared = boundary.prepare(writeCommand(), { ownerId: OWNER_A });
  assert.match(prepared.approvalToken, /^mw1\./);
  assert.equal(prepared.expiresAt, new Date(NOW + 120_000).toISOString());

  const reordered = {
    kind: 'write',
    body: {
      explicitUserIntent: true,
      content: 'Tenisi seviyorum',
      sourceType: 'user_note',
      kind: 'preference',
      sensitivity: 'personal'
    }
  };
  assert.deepEqual(boundary.consume(reordered, { ownerId: OWNER_A, approvalToken: prepared.approvalToken }), writeCommand());
  assert.throws(
    () => boundary.consume(writeCommand(), { ownerId: OWNER_A, approvalToken: prepared.approvalToken }),
    (error) => error?.code === 'MEMORY_APPROVAL_REPLAYED'
  );
}

{
  const boundary = createPersonalMemoryApprovalBoundary({
    secret: SECRET,
    now: () => NOW,
    randomBytesImpl: () => Buffer.alloc(16, 2)
  });
  const prepared = boundary.prepare(writeCommand(), { ownerId: OWNER_A });
  assert.throws(
    () => boundary.consume(writeCommand(), { ownerId: OWNER_B, approvalToken: prepared.approvalToken }),
    (error) => error?.code === 'MEMORY_APPROVAL_MISMATCH'
  );
  assert.throws(
    () => boundary.consume(writeCommand('Başka içerik'), { ownerId: OWNER_A, approvalToken: prepared.approvalToken }),
    (error) => error?.code === 'MEMORY_APPROVAL_MISMATCH'
  );
  assert.throws(
    () => boundary.consume(writeCommand(), { ownerId: OWNER_A, approvalToken: `${prepared.approvalToken}x` }),
    (error) => error?.code === 'MEMORY_APPROVAL_INVALID'
  );
}

{
  let clock = NOW;
  const boundary = createPersonalMemoryApprovalBoundary({
    secret: SECRET,
    ttlMs: 1_000,
    now: () => clock,
    randomBytesImpl: () => Buffer.alloc(16, 3)
  });
  const prepared = boundary.prepare(writeCommand(), { ownerId: OWNER_A });
  clock += 1_000;
  assert.throws(
    () => boundary.consume(writeCommand(), { ownerId: OWNER_A, approvalToken: prepared.approvalToken }),
    (error) => error?.code === 'MEMORY_APPROVAL_EXPIRED'
  );
}

{
  const boundary = createPersonalMemoryApprovalBoundary({
    secret: SECRET,
    now: () => NOW,
    randomBytesImpl: () => Buffer.alloc(16, 4)
  });
  const command = {
    kind: 'delete-one',
    memoryId: MEMORY_ID,
    body: { exactMatch: true, explicitUserIntent: true }
  };
  const prepared = boundary.prepare(command, { ownerId: OWNER_A });
  assert.deepEqual(boundary.consume(command, { ownerId: OWNER_A, approvalToken: prepared.approvalToken }), command);
}

assert.throws(() => normalizeMemoryApprovalCommand({ kind: 'write', body: { explicitUserIntent: false } }), /MEMORY_WRITE_REQUIRES_EXPLICIT_USER_INTENT/);
assert.throws(() => normalizeMemoryApprovalCommand({ kind: 'delete-one', memoryId: 'bad', body: { exactMatch: true, explicitUserIntent: true } }), /INVALID_MEMORY_APPROVAL_MEMORY_ID/);
assert.throws(() => createPersonalMemoryApprovalBoundary({ secret: Buffer.alloc(8) }), /INVALID_MEMORY_APPROVAL_SECRET/);
assert.throws(() => createPersonalMemoryApprovalBoundary({ secret: SECRET, ttlMs: 301_000 }), /INVALID_MEMORY_APPROVAL_TTL/);

console.log('personal memory approval tests passed');
