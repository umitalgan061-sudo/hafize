import assert from 'node:assert/strict';
import { createGoogleTokenRefresh } from '../lib/google-token-refresh.mjs';

const OWNER = 'owner_expiry_bounds';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let saves = 0;
const nearMax = Number.MAX_SAFE_INTEGER - 100;
const refresh = createGoogleTokenRefresh({
  clientId: 'google-client-id.apps.example',
  now: () => nearMax,
  tokenStore: {
    async load() { return { accessToken: 'expired', refreshToken: 'refresh-token-12345678', tokenType: 'Bearer', scopes: [SCOPE], expiresAt: 1 }; },
    async save() { saves += 1; }
  },
  fetchImpl: async () => ({
    ok: true,
    async json() { return { access_token: 'overflow-test-access-token', token_type: 'Bearer', expires_in: 3600, scope: SCOPE }; }
  })
});

await assert.rejects(() => refresh.refresh({ ownerId: OWNER }),
  (error) => error?.code === 'INVALID_GOOGLE_TOKEN_REFRESH:now');
assert.equal(saves, 0, 'unsafe expiry arithmetic must fail before encrypted token mutation');

console.log('Google refresh expiry-bound tests passed');
