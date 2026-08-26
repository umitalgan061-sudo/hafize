import assert from 'node:assert/strict';
import { GMAIL_SEND_LIMITS, normalizeGmailSendRequest } from '../lib/gmail-send-contract.mjs';

const validInput = {
  to: ['alice@example.com', 'Bob@example.org'],
  subject: 'Durum özeti',
  text: 'Bugünkü rapor hazır.',
  explicitUserIntent: true
};
const normalized = normalizeGmailSendRequest(validInput, { approvalGranted: true });
assert.deepEqual(normalized, {
  operation: 'message.send',
  to: ['alice@example.com', 'Bob@example.org'],
  subject: 'Durum özeti',
  text: 'Bugünkü rapor hazır.'
});
assert.equal(Object.isFrozen(normalized), true);
assert.equal(Object.isFrozen(normalized.to), true);
assert.equal('approvalGranted' in normalized, false);
assert.equal('explicitUserIntent' in normalized, false);
assert.throws(() => normalizeGmailSendRequest(validInput), /GMAIL_SEND_APPROVAL_REQUIRED/);
assert.throws(() => normalizeGmailSendRequest({ ...validInput, approvalGranted: true }, { approvalGranted: true }), /INVALID_GMAIL_SEND_FIELD/);

for (const input of [null, [], {}, { to: ['a@example.com'], subject: 'x', text: 'y' }]) {
  assert.throws(() => normalizeGmailSendRequest(input, { approvalGranted: true }), /GMAIL_SEND|INVALID_GMAIL_SEND/);
}

for (const field of ['from', 'cc', 'bcc', 'raw', 'url', 'token', 'attachments']) {
  assert.throws(() => normalizeGmailSendRequest({ ...validInput, [field]: 'forbidden' }, { approvalGranted: true }), /INVALID_GMAIL_SEND_FIELD/);
}

for (const recipients of [
  [],
  ['not-an-email'],
  ['a@example.com\r\nBcc:evil@example.com'],
  ['A@example.com', 'a@example.com'],
  Array.from({ length: GMAIL_SEND_LIMITS.maxRecipients + 1 }, (_, index) => `u${index}@example.com`)
]) {
  assert.throws(() => normalizeGmailSendRequest({ ...validInput, to: recipients }, { approvalGranted: true }), /INVALID_GMAIL_SEND_RECIPIENT/);
}

for (const subject of ['', 'hello\nBcc: x@example.com', 'x'.repeat(GMAIL_SEND_LIMITS.maxSubjectLength + 1)]) {
  assert.throws(() => normalizeGmailSendRequest({ ...validInput, subject }, { approvalGranted: true }), /INVALID_GMAIL_SEND_SUBJECT/);
}

for (const text of ['', '\0', 'x'.repeat(GMAIL_SEND_LIMITS.maxTextLength + 1)]) {
  assert.throws(() => normalizeGmailSendRequest({ ...validInput, text }, { approvalGranted: true }), /INVALID_GMAIL_SEND_TEXT/);
}


// Bozuk seçenek nesnesi onaylanmis sayilmamali; kapi kapali tarafa dusmeli.
for (const options of [null, 'x', []]) {
  assert.throws(() => normalizeGmailSendRequest(validInput, options), /GMAIL_SEND_APPROVAL_REQUIRED/);
}
assert.throws(() => normalizeGmailSendRequest(validInput, {}), /GMAIL_SEND_APPROVAL_REQUIRED/);
assert.throws(() => normalizeGmailSendRequest(validInput, undefined), /GMAIL_SEND_APPROVAL_REQUIRED/);

assert.deepEqual(GMAIL_SEND_LIMITS, { maxRecipients: 10, maxSubjectLength: 180, maxTextLength: 50_000 });
console.log('gmail send contract tests passed');
