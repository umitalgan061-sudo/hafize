import assert from 'node:assert/strict';
import { createGoogleTokenExchange, GOOGLE_TOKEN_EXCHANGE_LIMITS } from '../lib/google-token-exchange.mjs';

const INPUT = {
  ownerId: 'owner_abc',
  code: 'authorization-code',
  verifier: 'v'.repeat(43),
  redirectUri: 'https://hafize.example.test/api/connectors/gmail/oauth/callback',
  expectedScopes: ['openid', 'https://www.googleapis.com/auth/gmail.readonly']
};

{
  const saves = [];
  let clockCalls = 0;
  const exchange = createGoogleTokenExchange({
    clientId: 'client',
    tokenStore: { async save(value) { saves.push(value); } },
    now() { clockCalls += 1; return clockCalls === 1 ? 1_000 : 1_250; },
    fetchImpl: async () => ({
      ok: true,
      async json() { return { access_token: 'access', refresh_token: 'refresh', token_type: 'Bearer', expires_in: 60 }; }
    })
  });
  const receipt = await exchange.exchange(INPUT);
  assert.deepEqual(saves[0].tokenRecord.scopes, INPUT.expectedScopes, 'omitted provider scope means requested scope set is unchanged');
  assert.equal(saves[0].tokenRecord.expiresAt, 61_250, 'expiry must start when provider response is received');
  assert.equal(receipt.expiresAt, 61_250);
}

{
  let saves = 0;
  const exchange = createGoogleTokenExchange({
    clientId: 'client', tokenStore: { async save() { saves += 1; } },
    fetchImpl: async () => ({
      ok: true,
      async json() { return { access_token: 'access', token_type: 'Bearer', expires_in: 3600, scope: `${INPUT.expectedScopes[0]} https://www.googleapis.com/auth/gmail.send` }; }
    })
  });
  await assert.rejects(() => exchange.exchange(INPUT), (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_SCOPE_ESCALATION');
  assert.equal(saves, 0, 'scope escalation must never overwrite encrypted token state');
}

{
  let saves = 0;
  const exchange = createGoogleTokenExchange({
    clientId: 'client', tokenStore: { async save() { saves += 1; } }, requestTimeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('socket secret'), { code: 'UND_ERR_ABORTED' })), { once: true });
    })
  });
  await assert.rejects(() => exchange.exchange(INPUT), (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:timeout');
  assert.equal(saves, 0);
}

{
  let saves = 0;
  const exchange = createGoogleTokenExchange({
    clientId: 'client', tokenStore: { async save() { saves += 1; } },
    fetchImpl: async () => ({
      ok: true,
      async json() { return { access_token: 'x'.repeat(GOOGLE_TOKEN_EXCHANGE_LIMITS.maxResponseBytes), token_type: 'Bearer', expires_in: 3600 }; }
    })
  });
  await assert.rejects(() => exchange.exchange(INPUT), (error) => error?.code === 'GOOGLE_TOKEN_EXCHANGE_FAILED:response-too-large');
  assert.equal(saves, 0);
}

{
  let saves = 0;
  const times = [Number.MAX_SAFE_INTEGER - 100, Number.MAX_SAFE_INTEGER - 50];
  const exchange = createGoogleTokenExchange({
    clientId: 'client', tokenStore: { async save() { saves += 1; } }, now: () => times.shift(),
    fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'access', token_type: 'Bearer', expires_in: 3600 }; } })
  });
  await assert.rejects(() => exchange.exchange(INPUT), (error) => error?.code === 'INVALID_GOOGLE_TOKEN_EXCHANGE:now');
  assert.equal(saves, 0);
}

{
  let saves = 0;
  const times = [10_000, 9_999];
  const exchange = createGoogleTokenExchange({
    clientId: 'client', tokenStore: { async save() { saves += 1; } }, now: () => times.shift(),
    fetchImpl: async () => ({ ok: true, async json() { return { access_token: 'access', token_type: 'Bearer', expires_in: 3600 }; } })
  });
  await assert.rejects(() => exchange.exchange(INPUT), (error) => error?.code === 'INVALID_GOOGLE_TOKEN_EXCHANGE:now');
  assert.equal(saves, 0);
}

console.log('Google token exchange security tests passed');
