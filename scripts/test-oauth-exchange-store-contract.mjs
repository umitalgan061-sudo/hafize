import assert from 'node:assert/strict';
import { createGoogleTokenExchange } from '../lib/google-token-exchange.mjs';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';

function strictStore(saved) {
  return {
    async save(input) {
      assert.deepEqual(Object.keys(input).sort(), ['ownerId', 'provider', 'tokenRecord']);
      assert.equal(typeof input.tokenRecord, 'object');
      assert.equal(typeof input.tokenRecord.accessToken, 'string');
      assert.equal('accessToken' in input, false);
      assert.equal('refreshToken' in input, false);
      saved.push(input);
    }
  };
}

const googleSaved = [];
const google = createGoogleTokenExchange({
  clientId: 'google-client',
  tokenStore: strictStore(googleSaved),
  fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'ga', refresh_token: 'gr', token_type: 'Bearer', expires_in: 3600, scope: 'openid email' }; } })
});
await google.exchange({ ownerId: 'owner', code: '12345678', verifier: 'g'.repeat(43), redirectUri: 'https://example.com/google' });
assert.equal(googleSaved[0].provider, 'google');
assert.equal(googleSaved[0].tokenRecord.refreshToken, 'gr');

const canvaSaved = [];
const canva = createCanvaTokenExchange({
  clientId: 'canva-client', clientSecret: 'canva-secret', tokenStore: strictStore(canvaSaved),
  fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'ca', refresh_token: 'cr', token_type: 'Bearer', expires_in: 14400, scope: 'asset:read' }; } })
});
await canva.exchange({ ownerId: 'owner', code: '12345678', verifier: 'c'.repeat(43), redirectUri: 'https://example.com/canva' });
assert.equal(canvaSaved[0].provider, 'canva');
assert.equal(canvaSaved[0].tokenRecord.refreshToken, 'cr');
console.log('oauth exchange store contract tests passed');
