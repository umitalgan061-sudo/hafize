import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.mjs';
import { createOAuthFlowStore } from './oauth-flow-store.mjs';
import { normalizeOAuthCallback } from './oauth-callback-contract.mjs';

export function createOAuthFlowRuntime({ store = createOAuthFlowStore() } = {}) {
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
    const issued = await store.issue({ state, verifier, provider, redirectUri, scopes, ownerId });
    return Object.freeze({
      authorizationUrl,
      state,
      expiresAt: Number.isSafeInteger(issued?.expiresAt) ? issued.expiresAt : null
    });
  }

  async function finish(input) {
    const callback = normalizeOAuthCallback(input);
    const flow = await store.consume(callback.state);
    const owner = flow.ownerId == null ? {} : { ownerId: flow.ownerId };
    if (!callback.ok) {
      return Object.freeze({ ok: false, provider: flow.provider, ...owner, error: callback.error, errorDescription: callback.errorDescription });
    }
    return Object.freeze({
      ok: true,
      provider: flow.provider,
      ...owner,
      code: callback.code,
      verifier: flow.verifier,
      redirectUri: flow.redirectUri,
      scopes: Object.freeze([...flow.scopes])
    });
  }

  return Object.freeze({ start, finish });
}
