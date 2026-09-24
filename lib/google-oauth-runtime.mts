import { createOAuthFlowRuntime } from './oauth-flow-runtime.mts';
import { normalizeGoogleOAuthRequest } from './google-oauth-policy.mts';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

function requiredText(value: unknown, label: string, max: number = 2048): string {
  if (typeof value !== 'string') throw new Error(`INVALID_GOOGLE_OAUTH_RUNTIME:${label}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(`INVALID_GOOGLE_OAUTH_RUNTIME:${label}`);
  return normalized;
}

function normalizeRedirectUri(value: unknown) {
  const raw = requiredText(value, 'redirectUri');
  let url;
  try { url = new URL(raw); } catch { throw new Error('INVALID_GOOGLE_OAUTH_RUNTIME:redirectUri'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('INVALID_GOOGLE_OAUTH_RUNTIME:redirectUri');
  }
  return url.toString();
}

export function createGoogleOAuthRuntime({ clientId, redirectUri, flowRuntime = createOAuthFlowRuntime() }: { clientId?: string; redirectUri?: string; flowRuntime?: any } = {}) {
  const safeClientId = requiredText(clientId, 'clientId', 512);
  const safeRedirectUri = normalizeRedirectUri(redirectUri);
  if (typeof flowRuntime?.start !== 'function' || typeof flowRuntime?.finish !== 'function') {
    throw new Error('INVALID_GOOGLE_OAUTH_RUNTIME:flowRuntime');
  }

  function start(input: Record<string, any>) {
    const policy = normalizeGoogleOAuthRequest(input);
    const started = flowRuntime.start({
      provider: 'google',
      authorizationEndpoint: GOOGLE_AUTHORIZATION_ENDPOINT,
      clientId: safeClientId,
      redirectUri: safeRedirectUri,
      scopes: policy.scopes,
      extraParams: { access_type: 'offline', include_granted_scopes: 'true' }
    });
    return Object.freeze({
      authorizationUrl: started.authorizationUrl,
      state: started.state,
      capabilities: policy.capabilities,
      requiresWriteApproval: policy.requiresWriteApproval
    });
  }

  function finish(callback: Record<string, any>) {
    const result = flowRuntime.finish(callback);
    if (result.provider !== 'google') throw new Error('GOOGLE_OAUTH_FLOW_PROVIDER_MISMATCH');
    return result;
  }

  return Object.freeze({ start, finish });
}

export { GOOGLE_AUTHORIZATION_ENDPOINT };
