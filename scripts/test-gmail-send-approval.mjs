import assert from 'node:assert/strict';
import { createGmailSendApprovalService, GMAIL_SEND_APPROVAL_DEFAULT_TTL_MS } from '../lib/gmail-send-approval.mjs';

const secret = Buffer.alloc(32, 7);
let clock = 1_800_000_000_000;
let nonceSeed = 0;
const service = createGmailSendApprovalService({
  secret,
  now: () => clock,
  randomBytes(size) {
    assert.equal(size, 18);
    nonceSeed += 1;
    return Buffer.alloc(size, nonceSeed);
  }
});
const ownerId = 'owner_test';
const message = {
  to: ['alice@example.com'],
  subject: 'Durum özeti',
  text: 'Bugünkü rapor hazır.'
};

assert.throws(() => service.issue({ ownerId, message }), /GMAIL_SEND_USER_CONFIRMATION_REQUIRED/);
const token = service.issue({ ownerId, message, userConfirmed: true });
assert.equal(typeof token, 'string');
assert.equal(token.split('.').length, 2);
assert.equal(token.includes('alice@example.com'), false);
assert.equal(token.includes('Bugünkü rapor hazır.'), false);

const approved = service.consume({ token, ownerId, message });
assert.equal(approved.approved, true);
assert.equal(approved.expiresAt, clock + GMAIL_SEND_APPROVAL_DEFAULT_TTL_MS);
assert.throws(() => service.consume({ token, ownerId, message }), /GMAIL_SEND_APPROVAL_ALREADY_USED/);

const freshToken = service.issue({ ownerId, message, userConfirmed: true });
for (const changed of [
  { ...message, to: ['mallory@example.com'] },
  { ...message, subject: 'Başka konu' },
  { ...message, text: 'Değişmiş gövde' }
]) {
  assert.throws(() => service.consume({ token: freshToken, ownerId, message: changed }), /GMAIL_SEND_APPROVAL_MISMATCH/);
}
assert.throws(() => service.consume({ token: freshToken, ownerId: 'owner_other', message }), /GMAIL_SEND_APPROVAL_MISMATCH/);

const tampered = `${freshToken.slice(0, -1)}${freshToken.endsWith('A') ? 'B' : 'A'}`;
assert.throws(() => service.consume({ token: tampered, ownerId, message }), /INVALID_GMAIL_SEND_APPROVAL_SIGNATURE|INVALID_GMAIL_SEND_APPROVAL_TOKEN/);

const expiring = service.issue({ ownerId, message, userConfirmed: true });
clock += GMAIL_SEND_APPROVAL_DEFAULT_TTL_MS + 1;
assert.throws(() => service.consume({ token: expiring, ownerId, message }), /GMAIL_SEND_APPROVAL_EXPIRED/);

assert.throws(() => createGmailSendApprovalService({ secret: Buffer.alloc(16) }), /INVALID_GMAIL_SEND_APPROVAL_SECRET/);
assert.throws(() => createGmailSendApprovalService({ secret, ttlMs: 1000 }), /INVALID_GMAIL_SEND_APPROVAL_TTL/);
assert.throws(() => createGmailSendApprovalService({ secret, ttlMs: 600_000 }), /INVALID_GMAIL_SEND_APPROVAL_TTL/);

const badNonce = createGmailSendApprovalService({
  secret,
  randomBytes() { return Buffer.alloc(8); }
});
assert.throws(() => badNonce.issue({ ownerId, message, userConfirmed: true }), /INVALID_GMAIL_SEND_APPROVAL_NONCE/);

console.log('gmail send approval tests passed');