import { fetchBoundedProviderJson } from './provider-json-fetch.mjs';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const MAX_EXCHANGE_JSON_BYTES = 64 * 1024;
const DEFAULT_EXCHANGE_TIMEOUT_MS = 15_000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, label, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(`INVALID_GOOGLE_TOKEN_EXCHANGE:${label}`);
  return normalized;
}

function redirectUri(value) {
  const raw = text(value, 'redirectUri', { max: 2048 });
  let url;
  try { url = new URL(raw); } catch { fail('INVALID_GOOGLE_TOKEN_EXCHANGE:redirectUri'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:redirectUri');
  return url.toString();
}

function normalizeExpectedScopes(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:expectedScopes');
  const scopes = value.map((scope) => text(scope, 'expectedScope', { max: 256 }));
  if (new Set(scopes).size !== scopes.length) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:expectedScopes');
  return scopes;
}

function normalizeTokenResponse(value, expectedScopes) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('GOOGLE_TOKEN_EXCHANGE_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken');
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') fail('GOOGLE_TOKEN_EXCHANGE_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) fail('GOOGLE_TOKEN_EXCHANGE_FAILED:expiresIn');
  const refreshToken = value.refresh_token == null ? null : text(value.refresh_token, 'refreshToken');
  const returnedScopes = value.scope == null
    ? null
    : [...new Set(text(value.scope, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean))];
  let scopes = returnedScopes || [];
  if (expectedScopes) {
    scopes = returnedScopes || [...expectedScopes];
    const allowed = new Set(expectedScopes);
    if (scopes.some((scope) => !allowed.has(scope))) fail('GOOGLE_TOKEN_EXCHANGE_SCOPE_ESCALATION');
  }
  return Object.freeze({ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: Object.freeze(scopes) });
}

function safeNow(now, minimum = 0) {
  const value = Number(now());
  if (!Number.isSafeInteger(value) || value < minimum) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:now');
  return value;
}

export function createGoogleTokenExchange({
  clientId,
  clientSecret,
  tokenStore,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  requestTimeoutMs = DEFAULT_EXCHANGE_TIMEOUT_MS
} = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = clientSecret == null || String(clientSecret).trim() === ''
    ? null
    : text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.save !== 'function') fail('INVALID_GOOGLE_TOKEN_EXCHANGE:tokenStore');
  if (typeof fetchImpl !== 'function') fail('INVALID_GOOGLE_TOKEN_EXCHANGE:fetch');
  if (typeof now !== 'function') fail('INVALID_GOOGLE_TOKEN_EXCHANGE:now');

  async function resolveRefreshToken(owner, returned) {
    if (returned !== null) return returned;
    if (typeof tokenStore.load !== 'function') return null;
    const previous = await tokenStore.load({ ownerId: owner, provider: 'google' });
    if (previous == null) return null;
    if (!previous || Array.isArray(previous) || typeof previous !== 'object') fail('GOOGLE_TOKEN_EXCHANGE_FAILED:stored-token');
    if (previous.refreshToken == null) return null;
    return text(previous.refreshToken, 'refreshToken', { min: 8 });
  }

  async function exchange({
    ownerId,
    code,
    verifier,
    redirectUri: callbackUri,
    expectedScopes,
    requireRefreshToken = false
  } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:ownerId');
    if (typeof requireRefreshToken !== 'boolean') fail('INVALID_GOOGLE_TOKEN_EXCHANGE:requireRefreshToken');
    const safeCode = text(code, 'code', { min: 8, max: 2048 });
    const safeVerifier = text(verifier, 'verifier', { min: 43, max: 128 });
    const safeRedirectUri = redirectUri(callbackUri);
    const safeExpectedScopes = normalizeExpectedScopes(expectedScopes);
    const body = new URLSearchParams({
      client_id: safeClientId,
      code: safeCode,
      code_verifier: safeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: safeRedirectUri
    });
    if (safeClientSecret) body.set('client_secret', safeClientSecret);

    const issuedAt = safeNow(now);
    const response = await fetchBoundedProviderJson({
      fetchImpl,
      url: TOKEN_ENDPOINT,
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'error'
      },
      errorPrefix: 'GOOGLE_TOKEN_EXCHANGE_FAILED',
      maxBytes: MAX_EXCHANGE_JSON_BYTES,
      timeoutMs: requestTimeoutMs
    });
    const tokens = normalizeTokenResponse(response, safeExpectedScopes);
    const refreshToken = await resolveRefreshToken(owner, tokens.refreshToken);
    if (requireRefreshToken && refreshToken === null) fail('GOOGLE_TOKEN_EXCHANGE_REFRESH_TOKEN_REQUIRED');

    const receivedAt = safeNow(now, issuedAt);
    const expiresAt = receivedAt + tokens.expiresIn * 1000;
    if (!Number.isSafeInteger(expiresAt)) fail('INVALID_GOOGLE_TOKEN_EXCHANGE:now');
    await tokenStore.save({
      ownerId: owner,
      provider: 'google',
      tokenRecord: {
        accessToken: tokens.accessToken,
        refreshToken,
        tokenType: tokens.tokenType,
        scopes: tokens.scopes,
        expiresAt
      }
    });
    return Object.freeze({
      provider: 'google',
      ownerId: owner,
      scopes: tokens.scopes,
      expiresAt,
      refreshTokenStored: refreshToken !== null
    });
  }

  return Object.freeze({ exchange });
}

export const GOOGLE_TOKEN_EXCHANGE_LIMITS = Object.freeze({
  maxResponseBytes: MAX_EXCHANGE_JSON_BYTES,
  defaultTimeoutMs: DEFAULT_EXCHANGE_TIMEOUT_MS
});
export { TOKEN_ENDPOINT as GOOGLE_TOKEN_ENDPOINT };
