import assert from 'node:assert/strict';
import { createCanvaTokenExchange } from '../lib/canva-token-exchange.mjs';
import { createCanvaTokenRefresh } from '../lib/canva-token-refresh.mjs';
import { createCanvaTokenRevoke } from '../lib/canva-token-revoke.mjs';

const ownerId = 'owner-1';
const common = { clientId: 'client', clientSecret: 'secret' };

function cancellableFetch(capture) {
  return async (_url, options) => {
    capture.signal = options.signal;
    return await new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  };
}

{
  const outer = new AbortController();
  const capture = {};
  let saved = 0;
  const exchange = createCanvaTokenExchange({
    ...common,
    tokenStore: { async save() { saved += 1; } },
    fetchImpl: cancellableFetch(capture)
  });
  const pending = exchange.exchange({
    ownerId,
    code: 'authorization-code',
    verifier: 'v'.repeat(43),
    redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
    expectedScopes: ['profile:read'],
    signal: outer.signal
  });
  await Promise.resolve();
  outer.abort('navigation');
  await assert.rejects(pending, /CANVA_TOKEN_EXCHANGE_FAILED:cancelled/);
  assert.equal(capture.signal.aborted, true);
  assert.equal(saved, 0, 'cancelled exchange cannot persist credentials');
}

{
  const outer = new AbortController();
  const capture = {};
  let saved = 0;
  const refresh = createCanvaTokenRefresh({
    ...common,
    tokenStore: {
      async load() { return { refreshToken: 'refresh-token', scopes: ['profile:read'] }; },
      async save() { saved += 1; }
    },
    fetchImpl: cancellableFetch(capture)
  });
  const pending = refresh.refresh({ ownerId, signal: outer.signal });
  await Promise.resolve();
  outer.abort('shutdown');
  await assert.rejects(pending, /CANVA_TOKEN_REFRESH_FAILED:cancelled/);
  assert.equal(capture.signal.aborted, true);
  assert.equal(saved, 0, 'cancelled refresh cannot rotate stored credentials');
}

{
  const outer = new AbortController();
  const capture = {};
  let removed = 0;
  const revoke = createCanvaTokenRevoke({
    ...common,
    tokenStore: {
      async load() { return { refreshToken: 'refresh-token' }; },
      async remove() { removed += 1; }
    },
    fetchImpl: cancellableFetch(capture)
  });
  const pending = revoke.revoke({ ownerId, explicitUserIntent: true, signal: outer.signal });
  await Promise.resolve();
  outer.abort('shutdown');
  await assert.rejects(pending, /CANVA_TOKEN_REVOKE_FAILED:cancelled/);
  assert.equal(capture.signal.aborted, true);
  assert.equal(removed, 0, 'uncertain/cancelled revoke keeps local token for reconciliation');
}

{
  const preAborted = new AbortController();
  preAborted.abort();
  let fetched = 0;
  const exchange = createCanvaTokenExchange({
    ...common,
    tokenStore: { async save() { throw new Error('must not save'); } },
    fetchImpl: async () => { fetched += 1; }
  });
  await assert.rejects(exchange.exchange({
    ownerId,
    code: 'authorization-code',
    verifier: 'v'.repeat(43),
    redirectUri: 'https://hafize.example/api/connectors/canva/oauth/callback',
    expectedScopes: [],
    signal: preAborted.signal
  }), /CANVA_TOKEN_EXCHANGE_FAILED:cancelled/);
  assert.equal(fetched, 0, 'pre-abort blocks network egress');
}

console.log('canva token cancellation boundary tests passed');
