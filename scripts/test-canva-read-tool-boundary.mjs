import assert from 'node:assert/strict';
import { CANVA_READ_TOOL_DEFINITION, createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';

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
    return { design: { id: 'DAF123', title: 'Plan' } };
  }
};
const boundary = createCanvaReadToolBoundary({ readClient, ownerResolver });

assert.equal(CANVA_READ_TOOL_DEFINITION.function.name, 'canva_read');
assert.equal(CANVA_READ_TOOL_DEFINITION.function.parameters.additionalProperties, false);
assert.deepEqual(CANVA_READ_TOOL_DEFINITION.function.parameters.properties.operation.enum, [
  'user.get', 'user.profile', 'user.capabilities', 'design.list', 'design.get'
]);
assert.equal(JSON.stringify(CANVA_READ_TOOL_DEFINITION).includes('write'), false);
assert.equal(JSON.stringify(CANVA_READ_TOOL_DEFINITION).includes('token'), false);
assert.equal(JSON.stringify(CANVA_READ_TOOL_DEFINITION).includes('ownerId'), false);

const principal = { authenticated: true, subject: 'user:123@example.com' };
const result = await boundary.execute({ operation: 'design.get', params: { designId: 'DAF123' } }, { principal });
assert.equal(result.design.id, 'DAF123');
assert.deepEqual(calls[0], ['resolve', principal]);
assert.deepEqual(calls[1], ['read', { ownerId: 'owner_opaque_123', operation: 'design.get', params: { designId: 'DAF123' } }]);
assert.equal(JSON.stringify(calls[1]).includes('user:123@example.com'), false);

calls.length = 0;
await boundary.execute({ operation: 'user.get' }, { principal });
assert.deepEqual(calls[1], ['read', { ownerId: 'owner_opaque_123', operation: 'user.get', params: undefined }]);

for (const args of [
  null,
  {},
  { operation: 'design.delete' },
  { operation: 'user.get', ownerId: 'owner_attacker' },
  { operation: 'user.get', token: 'secret' },
  { operation: 'design.list', params: [] },
  { operation: 'design.list', params: { url: 'https://evil.example' } }
]) {
  await assert.rejects(() => boundary.execute(args, { principal }), /INVALID_CANVA_READ_TOOL/);
}
await assert.rejects(() => boundary.execute({ operation: 'user.get' }, { principal: { authenticated: false, subject: 'x' } }), /CONNECTOR_AUTH_REQUIRED/);
assert.throws(() => createCanvaReadToolBoundary({}), /INVALID_CANVA_READ_TOOL/);
assert.throws(() => createCanvaReadToolBoundary({ readClient, ownerResolver: {} }), /INVALID_CANVA_READ_TOOL/);
for (const context of [null, undefined, [], 'principal']) {
  await assert.rejects(() => boundary.execute({ operation: 'user.get' }, context), /CONNECTOR_AUTH_REQUIRED|INVALID_CANVA_READ_TOOL/);
}
console.log('canva read tool boundary tests passed');
