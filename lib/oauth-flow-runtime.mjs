import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.mjs';
import { createOAuthFlowStore } from './oauth-flow-store.mjs';
import { normalizeOAuthCallback } from './oauth-callback-contract.mjs';

/**
 * PKCE akışını başlatır ve geri dönüşü doğrular.
 *
 * @param {{ store?: any }} [options]
 */
export function createOAuthFlowRuntime({ store = createOAuthFlowStore() } = {}) {
  if (typeof store?.issue !== 'function' || typeof store?.consume !== 'function') {
    throw new Error('INVALID_OAUTH_FLOW_RUNTIME:store');
  }

  /**
   * @param {{
   *   provider?: string;
   *   authorizationEndpoint?: string;
   *   clientId?: string;
   *   redirectUri?: string;
   *   scopes?: string[];
   *   extraParams?: Record<string, string>;
   * }} [input]
   */
  function start({ provider, authorizationEndpoint, clientId, redirectUri, scopes, extraParams } = {}) {
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

  /** @param {Record<string, any>} input */
  function finish(input) {
    const callback = normalizeOAuthCallback(input);
    const flow = store.consume(callback.state);
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
