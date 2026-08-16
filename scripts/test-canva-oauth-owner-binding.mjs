import assert from 'node:assert/strict';
import { createCanvaOAuthRuntime, CANVA_AUTHORIZATION_ENDPOINT } from '../lib/canva-oauth-runtime.mjs';

const calls = [];
const flowRuntime = {
  async start(input) {
    calls.push(input);
    return {
      authorizationUrl: 'https://www.canva.com/api/oauth/authorize?state=state-1',
      state: 'state-1',
      expiresAt: 1_800_000_000_000
    };
  },
  async finish(callback) {
    return {
      ok: true,
      provider: 'canva',
      ownerId: 'owner:abc',
      code: callback.code,
      verifier: 'v'.repeat(64),
      redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
      scopes: Object.freeze(['profile:read', 'design:meta:read'])
    };
  }
};

const runtime = createCanvaOAuthRuntime({
  clientId: 'canva-client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  flowRuntime
});

const started = await runtime.start(
  { capabilities: ['profile.read', 'design.meta.read'] },
  { ownerId: 'owner:abc' }
);

assert.equal(calls.length, 1);
assert.deepEqual(calls[0], {
  provider: 'canva',
  authorizationEndpoint: CANVA_AUTHORIZATION_ENDPOINT,
  clientId: 'canva-client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  scopes: ['profile:read', 'design:meta:read'],
  ownerId: 'owner:abc'
});
assert.equal(started.authorizationUrl.startsWith(CANVA_AUTHORIZATION_ENDPOINT), true);
assert.equal(started.state, 'state-1');
assert.equal(started.expiresAt, 1_800_000_000_000);
assert.deepEqual(started.capabilities, ['profile.read', 'design.meta.read']);
assert.equal(started.requiresWriteApproval, false);

const finished = await runtime.finish({ code: 'code-12345678', state: 'state-1' });
assert.equal(finished.ownerId, 'owner:abc');
assert.equal(finished.provider, 'canva');
assert.deepEqual(finished.scopes, ['profile:read', 'design:meta:read']);

const noExpiryRuntime = createCanvaOAuthRuntime({
  clientId: 'client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  flowRuntime: {
    async start(input) {
      assert.equal(input.ownerId, 'owner:no-expiry');
      return { authorizationUrl: 'https://www.canva.com/api/oauth/authorize', state: 's' };
    },
    async finish() { return { ok: true, provider: 'canva' }; }
  }
});
const noExpiry = await noExpiryRuntime.start({ capabilities: ['profile.read'] }, { ownerId: 'owner:no-expiry' });
assert.equal(noExpiry.expiresAt, null);

const writeRuntime = createCanvaOAuthRuntime({
  clientId: 'client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  flowRuntime: {
    async start(input) {
      assert.equal(input.ownerId, 'owner:write');
      assert.deepEqual(input.scopes, ['design:content:write']);
      return { authorizationUrl: 'https://www.canva.com/api/oauth/authorize', state: 'write-state', expiresAt: 5 };
    },
    async finish() { return { ok: true, provider: 'canva' }; }
  }
});
const writeStarted = await writeRuntime.start(
  { capabilities: ['design.content.write'], explicitUserIntent: true },
  { ownerId: 'owner:write' }
);
assert.equal(writeStarted.requiresWriteApproval, true);

await assert.rejects(
  () => writeRuntime.start({ capabilities: ['design.content.write'] }, { ownerId: 'owner:write' }),
  /INVALID_CANVA_OAUTH_POLICY:explicit_user_intent/
);

const mismatchRuntime = createCanvaOAuthRuntime({
  clientId: 'client',
  redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
  flowRuntime: {
    async start() { return { authorizationUrl: 'https://www.canva.com/api/oauth/authorize', state: 's' }; },
    async finish() { return { ok: true, provider: 'google' }; }
  }
});
await assert.rejects(() => mismatchRuntime.finish({ code: 'x', state: 'y' }), /CANVA_OAUTH_FLOW_PROVIDER_MISMATCH/);

console.log('Canva OAuth owner binding tests passed');
