import { createOAuthFlowRuntime } from './oauth-flow-runtime.mjs';
import { normalizeCanvaOAuthRequest } from './canva-oauth-policy.mjs';

const CANVA_AUTHORIZATION_ENDPOINT = 'https://www.canva.com/api/oauth/authorize';

function requiredText(value, field, max = 2048) {
  if (typeof value !== 'string') throw new Error(`INVALID_CANVA_OAUTH_RUNTIME:${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`INVALID_CANVA_OAUTH_RUNTIME:${field}`);
  return normalized;
}

function normalizeRedirectUri(value) {
  const raw = requiredText(value, 'redirectUri');
  let url;
  try { url = new URL(raw); } catch { throw new Error('INVALID_CANVA_OAUTH_RUNTIME:redirectUri'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('INVALID_CANVA_OAUTH_RUNTIME:redirectUri');
  return url.toString();
}

export function createCanvaOAuthRuntime({ clientId, redirectUri, flowRuntime = createOAuthFlowRuntime() } = {}) {
  const safeClientId = requiredText(clientId, 'clientId', 512);
  const safeRedirectUri = normalizeRedirectUri(redirectUri);
  if (typeof flowRuntime?.start !== 'function' || typeof flowRuntime?.finish !== 'function') throw new Error('INVALID_CANVA_OAUTH_RUNTIME:flowRuntime');

  function start(input) {
    const policy = normalizeCanvaOAuthRequest(input);
    const started = flowRuntime.start({ provider: 'canva', authorizationEndpoint: CANVA_AUTHORIZATION_ENDPOINT, clientId: safeClientId, redirectUri: safeRedirectUri, scopes: policy.scopes });
    return Object.freeze({ authorizationUrl: started.authorizationUrl, state: started.state, capabilities: policy.capabilities, requiresWriteApproval: policy.requiresWriteApproval });
  }

  function finish(callback) {
    const result = flowRuntime.finish(callback);
    if (result.provider !== 'canva') throw new Error('CANVA_OAUTH_FLOW_PROVIDER_MISMATCH');
    return result;
  }

  return Object.freeze({ start, finish });
}

export { CANVA_AUTHORIZATION_ENDPOINT };
