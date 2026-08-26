import assert from 'node:assert/strict';
import { createGmailReadToolBoundary, GMAIL_READ_TOOL_DEFINITION } from '../lib/gmail-read-tool-boundary.mjs';

const calls = [];
const ownerResolver = {
  resolve(principal) {
    calls.push(['resolve', principal]);
    if (principal?.authenticated !== true) throw new Error('CONNECTOR_AUTH_REQUIRED');
    return { ownerId: 'owner_opaque_123' };
  }
};
const readClient = {
  async read(input) {
    calls.push(['read', input]);
    return { messages: [{ id: 'm1' }] };
  }
};
const boundary = createGmailReadToolBoundary({ readClient, ownerResolver });
const definition = JSON.stringify(GMAIL_READ_TOOL_DEFINITION);
assert.equal(GMAIL_READ_TOOL_DEFINITION.function.name, 'gmail_read');
assert.equal(GMAIL_READ_TOOL_DEFINITION.function.parameters.additionalProperties, false);
assert.deepEqual(GMAIL_READ_TOOL_DEFINITION.function.parameters.properties.operation.enum, ['profile.get', 'message.list', 'message.get']);
for (const forbidden of ['ownerId', 'token', 'send', 'delete', 'modify']) assert.equal(definition.includes(forbidden), false);

const principal = { authenticated: true, subject: 'user:123@example.com' };
const result = await boundary.execute({ operation: 'message.list', params: { query: 'is:unread', maxResults: 10 } }, { principal });
assert.equal(result.messages[0].id, 'm1');
assert.deepEqual(calls[0], ['resolve', principal]);
assert.deepEqual(calls[1], ['read', { ownerId: 'owner_opaque_123', operation: 'message.list', params: { query: 'is:unread', maxResults: 10 } }]);
assert.equal(JSON.stringify(calls[1]).includes('user:123@example.com'), false);

calls.length = 0;
await boundary.execute({ operation: 'profile.get' }, { principal });
assert.deepEqual(calls[1], ['read', { ownerId: 'owner_opaque_123', operation: 'profile.get', params: undefined }]);

for (const args of [
  null,
  {},
  { operation: 'message.send' },
  { operation: 'profile.get', ownerId: 'owner_attacker' },
  { operation: 'profile.get', token: 'secret' },
  { operation: 'message.list', params: [] },
  { operation: 'message.list', params: { url: 'https://evil.example' } }
]) {
  await assert.rejects(() => boundary.execute(args, { principal }), /INVALID_GMAIL_READ_TOOL/);
}
await assert.rejects(() => boundary.execute({ operation: 'profile.get' }, { principal: { authenticated: false, subject: 'x' } }), /CONNECTOR_AUTH_REQUIRED/);
assert.throws(() => createGmailReadToolBoundary({}), /INVALID_GMAIL_READ_TOOL/);
assert.throws(() => createGmailReadToolBoundary({ readClient, ownerResolver: {} }), /INVALID_GMAIL_READ_TOOL/);

// null çağrı bağlamı normalize hata kodu vermeli, ham TypeError değil.
for (const context of [null, 'x', []]) {
  await assert.rejects(() => boundary.execute({ operation: 'profile.get' }, context), /INVALID_GMAIL_READ_TOOL:context/);
}

console.log('gmail read tool boundary tests passed');