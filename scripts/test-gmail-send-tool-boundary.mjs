import assert from 'node:assert/strict';
import { GMAIL_SEND_TOOL_DEFINITION, createGmailSendToolBoundary } from '../lib/gmail-send-tool-boundary.mjs';

const principal = { authenticated: true, subject: 'user:123@example.com' };
const calls = [];
const ownerResolver = {
  resolve(receivedPrincipal) {
    calls.push(['resolve', receivedPrincipal]);
    return { ownerId: 'owner_opaque_123' };
  }
};
const sendClient = {
  async send(input) {
    calls.push(['send', input]);
    return { messageId: 'm_123', threadId: 't_456', accessToken: 'must-not-leak' };
  }
};
const boundary = createGmailSendToolBoundary({ sendClient, ownerResolver });

assert.equal(GMAIL_SEND_TOOL_DEFINITION.function.name, 'gmail_send');
assert.equal(GMAIL_SEND_TOOL_DEFINITION.function.parameters.additionalProperties, false);
const serializedDefinition = JSON.stringify(GMAIL_SEND_TOOL_DEFINITION);
for (const forbidden of ['approvalGranted', 'ownerId', 'token', 'from', 'raw', 'url', 'attachments']) {
  assert.equal(serializedDefinition.includes(forbidden), false);
}

const args = {
  to: ['alice@example.com'],
  subject: 'Plan',
  text: 'Toplantı saat 15:00.',
  explicitUserIntent: true
};
await assert.rejects(() => boundary.execute(args, { principal }), /GMAIL_SEND_APPROVAL_REQUIRED/);
assert.equal(calls.length, 0);

const receipt = await boundary.execute(args, { principal, approvalGranted: true });
assert.deepEqual(receipt, { sent: true, messageId: 'm_123', threadId: 't_456' });
assert.equal(JSON.stringify(receipt).includes('must-not-leak'), false);
assert.deepEqual(calls[0], ['resolve', principal]);
assert.deepEqual(calls[1], ['send', {
  ownerId: 'owner_opaque_123',
  operation: 'message.send',
  to: ['alice@example.com'],
  subject: 'Plan',
  text: 'Toplantı saat 15:00.'
}]);

await assert.rejects(() => boundary.execute({ ...args, approvalGranted: true }, { principal, approvalGranted: true }), /INVALID_GMAIL_SEND_FIELD/);
for (const context of [null, 'principal', ['principal']]) {
  await assert.rejects(() => boundary.execute(args, context), /INVALID_GMAIL_SEND_TOOL:context/);
}
await assert.rejects(() => boundary.execute(args, { principal, approvalGranted: 'yes' }), /GMAIL_SEND_APPROVAL_REQUIRED/);
await assert.rejects(() => boundary.execute(args, { principal }), /GMAIL_SEND_APPROVAL_REQUIRED/);
assert.throws(() => createGmailSendToolBoundary({}), /INVALID_GMAIL_SEND_TOOL/);
assert.throws(() => createGmailSendToolBoundary({ sendClient, ownerResolver: {} }), /INVALID_GMAIL_SEND_TOOL/);

const unsafeReceipt = createGmailSendToolBoundary({
  ownerResolver,
  sendClient: { async send() { return { messageId: '', token: 'x' }; } }
});
await assert.rejects(() => unsafeReceipt.execute(args, { principal, approvalGranted: true }), /INVALID_GMAIL_SEND_TOOL:receipt.messageId/);
console.log('gmail send tool boundary tests passed');
