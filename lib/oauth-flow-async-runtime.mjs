import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.mjs';
import { normalizeOAuthCallback } from './oauth-callback-contract.mjs';

const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

function owner(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!OWNER_RE.test(normalized)) throw new Error('INVALID_OAUTH_FLOW_RUNTIME:ownerId');
  return normalized;
}

export function createOAuthFlowAsyncRuntime({ store } = {}) {
  if (typeof store?.issue !== 'function' || typeof store?.consume !== 'function') {
    throw new Error('INVALID_OAUTH_FLOW_RUNTIME:store');
  }

  async function start({ provider, authorizationEndpoint, clientId, redirectUri, scopes, extraParams, ownerId } = {}) {
    const verifier = createPkceVerifier();
    const state = createOAuthState();
    const authorizationUrl = buildOAuthAuthorizationUrl({
      authorizationEndpoint,
      clientId,
      redirectUri,
      scopes,
      state,
      codeChallenge: createPkceChallenge(verifier),
      extraParams
    });
    await store.issue({ state, verifier, ownerId: owner(ownerId), provider, redirectUri, scopes });
    return Object.freeze({ authorizationUrl, state });
  }

  async function finish(input) {
    const callback = normalizeOAuthCallback(input);
    const flow = await store.consume(callback.state);
    if (!callback.ok) {
      return Object.freeze({ ok: false, provider: flow.provider, ownerId: flow.ownerId, error: callback.error, errorDescription: callback.errorDescription });
    }
    return Object.freeze({
      ok: true,
      provider: flow.provider,
      ownerId: flow.ownerId,
      code: callback.code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
      scopes: Object.freeze([...flow.scopes])
    });
  }

  async function close() {
    await store.close?.();
  }

  return Object.freeze({ start, finish, close });
}
