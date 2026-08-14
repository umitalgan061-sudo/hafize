import assert from 'node:assert/strict';
import { createCanvaReadClient } from '../lib/canva-read-client.mjs';
import { createCanvaReadToolBoundary } from '../lib/canva-read-tool-boundary.mjs';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';

const now = 2_000_000_000_000;
const ownerResolver = createConnectorOwnerResolver({ key: Buffer.alloc(32, 11) });
const expectedOwner = ownerResolver.resolve({ authenticated: true, subject: 'user:42@example.com' }).ownerId;
const token = 'canva_access_token_integration_1234';
const events = [];
const tokenStore = {
  async load(input) {
    events.push(['load', input]);
    assert.deepEqual(input, { ownerId: expectedOwner, provider: 'canva' });
    return { accessToken: token, tokenType: 'Bearer', scopes: ['design:meta:read'], expiresAt: now + 60_000 };
  }
};
const readClient = createCanvaReadClient({
  tokenStore,
  now: () => now,
  fetchImpl: async (url, options) => {
    events.push(['fetch', url, options]);
    assert.equal(options.headers.authorization, `Bearer ${token}`);
    return { ok: true, async json() { return { design: { id: 'DAF42', title: 'Roadmap' } }; } };
  }
});
const tool = createCanvaReadToolBoundary({ readClient, ownerResolver });
const principal = { authenticated: true, subject: 'user:42@example.com' };
const result = await tool.execute({ operation: 'design.get', params: { designId: 'DAF42' } }, { principal });

assert.equal(result.design.title, 'Roadmap');
assert.equal(events[0][1].ownerId, expectedOwner);
assert.equal(events[1][1], 'https://api.canva.com/rest/v1/designs/DAF42');
assert.equal(JSON.stringify(result).includes(token), false);
assert.equal(JSON.stringify(result).includes(principal.subject), false);
await assert.rejects(
  () => tool.execute({ operation: 'design.get', params: { designId: 'DAF42' }, ownerId: 'owner_attacker' }, { principal }),
  /INVALID_CANVA_READ_TOOL/
);
await assert.rejects(
  () => tool.execute({ operation: 'design.get', params: { designId: 'DAF42' } }, { principal: { authenticated: false, subject: principal.subject } }),
  /CONNECTOR_AUTH_REQUIRED/
);
console.log('canva read integration tests passed');
