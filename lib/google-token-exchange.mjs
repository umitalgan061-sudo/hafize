const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function text(value, label, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new Error(`INVALID_GOOGLE_TOKEN_EXCHANGE:${label}`);
  return normalized;
}

function redirectUri(value) {
  const raw = text(value, 'redirectUri', { max: 2048 });
  let url;
  try { url = new URL(raw); } catch { throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:redirectUri'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:redirectUri');
  return url.toString();
}

function normalizeTokenResponse(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken');
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED:expiresIn');
  const refreshToken = value.refresh_token == null ? null : text(value.refresh_token, 'refreshToken');
  const scope = value.scope == null ? [] : text(value.scope, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean);
  return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: [...new Set(scope)] };
}

export function createGoogleTokenExchange({ clientId, clientSecret, tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = clientSecret == null ? null : text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.save !== 'function') throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:tokenStore');
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:fetch');
  if (typeof now !== 'function') throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:now');

  async function exchange(request) {
    if (request != null && (typeof request !== 'object' || Array.isArray(request))) throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:request');
    const { ownerId, code, verifier, redirectUri: callbackUri } = request || {};
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:ownerId');
    const safeCode = text(code, 'code', { min: 8, max: 2048 });
    const safeVerifier = text(verifier, 'verifier', { min: 43, max: 128 });
    const safeRedirectUri = redirectUri(callbackUri);
    const body = new URLSearchParams({ client_id: safeClientId, code: safeCode, code_verifier: safeVerifier, grant_type: 'authorization_code', redirect_uri: safeRedirectUri });
    if (safeClientSecret) body.set('client_secret', safeClientSecret);

    const response = await fetchImpl(TOKEN_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(), redirect: 'error' });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('GOOGLE_TOKEN_EXCHANGE_FAILED:http');
    const tokens = normalizeTokenResponse(await response.json());
    const issuedAt = Number(now());
    if (!Number.isFinite(issuedAt)) throw new Error('INVALID_GOOGLE_TOKEN_EXCHANGE:now');
    const expiresAt = issuedAt + tokens.expiresIn * 1000;
    await tokenStore.save({ ownerId: owner, provider: 'google', tokenRecord: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenType: tokens.tokenType, scopes: tokens.scopes, expiresAt } });
    return Object.freeze({ provider: 'google', ownerId: owner, scopes: Object.freeze(tokens.scopes), expiresAt, refreshTokenStored: tokens.refreshToken !== null });
  }

  return Object.freeze({ exchange });
}

export { TOKEN_ENDPOINT as GOOGLE_TOKEN_ENDPOINT };