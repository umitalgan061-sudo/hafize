import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.mjs';
import { createOAuthFlowStore } from './oauth-flow-store.mjs';
import { normalizeOAuthCallback } from './oauth-callback-contract.mjs';

export function createOAuthFlowRuntime({ store = createOAuthFlowStore() } = {}) {
  if (typeof store?.issue !== 'function' || typeof store?.consume !== 'function') {
    throw new Error('INVALID_OAUTH_FLOW_RUNTIME:store');
  }

  async function start({ provider, authorizationEndpoint, clientId, redirectUri, scopes, extraParams } = {}) {
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
    await store.issue({ state, verifier, provider, redirectUri, scopes });
    return Object.freeze({ authorizationUrl, state });
  }

  async function finish(input) {
    const callback = normalizeOAuthCallback(input);
    const flow = await store.consume(callback.state);
    if (!callback.ok) {
      return Object.freeze({ ok: false, provider: flow.provider, error: callback.error, errorDescription: callback.errorDescription });
    }
    return Object.freeze({
      ok: true,
      provider: flow.provider,
      code: callback.code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
      scopes: Object.freeze([...flow.scopes])
    });
  }

  return Object.freeze({ start, finish });
}
