import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.mts';
import { createOAuthFlowStore } from './oauth-flow-store.mts';
import { normalizeOAuthCallback } from './oauth-callback-contract.mts';

/**
 * PKCE akışını başlatır ve geri dönüşü doğrular.
 */
export function createOAuthFlowRuntime({ store = createOAuthFlowStore() }: { store?: any } = {}) {
  if (typeof store?.issue !== 'function' || typeof store?.consume !== 'function') {
    throw new Error('INVALID_OAUTH_FLOW_RUNTIME:store');
  }

  function start({ provider, authorizationEndpoint, clientId, redirectUri, scopes, extraParams }: { provider?: string; authorizationEndpoint?: string; clientId?: string; redirectUri?: string; scopes?: string[]; extraParams?: Record<string, string>; } = {}) {
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
    store.issue({ state, verifier, provider, redirectUri, scopes });
    return Object.freeze({ authorizationUrl, state });
  }

  function finish(input: Record<string, any>) {
    const callback = normalizeOAuthCallback(input);
    const flow = store.consume(callback.state);
    if (callback.ok === false) {
      return Object.freeze({ ok: false as const, provider: flow.provider, error: callback.error, errorDescription: callback.errorDescription });
    }
    return Object.freeze({
      ok: true as const,
      provider: flow.provider,
      code: callback.code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
      scopes: Object.freeze([...flow.scopes])
    });
  }

  return Object.freeze({ start, finish });
}
