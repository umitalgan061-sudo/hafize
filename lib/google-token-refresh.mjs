const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, field, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) fail(`INVALID_GOOGLE_TOKEN_REFRESH:${field}`);
  return normalized;
}

function normalizeScopes(value, fallback) {
  if (value == null) return [...fallback];
  return [...new Set(text(value, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean))];
}

function normalizeResponse(value, previousScopes, previousRefreshToken) {
  if (!value || Array.isArray(value) || typeof value !== 'object') fail('GOOGLE_TOKEN_REFRESH_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken');
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') fail('GOOGLE_TOKEN_REFRESH_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) fail('GOOGLE_TOKEN_REFRESH_FAILED:expiresIn');
  const scopes = normalizeScopes(value.scope, previousScopes);
  const allowedScopes = new Set(previousScopes);
  if (scopes.some((scope) => !allowedScopes.has(scope))) fail('GOOGLE_TOKEN_REFRESH_SCOPE_ESCALATION');
  const refreshToken = value.refresh_token == null
    ? previousRefreshToken
    : text(value.refresh_token, 'refreshToken');
  return Object.freeze({ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: Object.freeze(scopes) });
}

export function createGoogleTokenRefresh({
  clientId,
  clientSecret,
  tokenStore,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = clientSecret == null || String(clientSecret).trim() === ''
    ? null
    : text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.load !== 'function' || typeof tokenStore?.save !== 'function') fail('INVALID_GOOGLE_TOKEN_REFRESH:tokenStore');
  if (typeof fetchImpl !== 'function') fail('INVALID_GOOGLE_TOKEN_REFRESH:fetch');
  if (typeof now !== 'function') fail('INVALID_GOOGLE_TOKEN_REFRESH:now');
  const inflight = new Map();

  async function refreshOnce(owner) {
    const current = await tokenStore.load({ ownerId: owner, provider: 'google' });
    if (!current || Array.isArray(current) || typeof current !== 'object') fail('GOOGLE_TOKEN_REFRESH_REAUTH_REQUIRED');
    const refreshToken = text(current.refreshToken, 'refreshToken', { min: 8 });
    const previousScopes = Array.isArray(current.scopes)
      ? [...new Set(current.scopes.map((scope) => text(scope, 'scope', { max: 512 })))]
      : [];
    const body = new URLSearchParams({
      client_id: safeClientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    if (safeClientSecret) body.set('client_secret', safeClientSecret);
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') fail('GOOGLE_TOKEN_REFRESH_FAILED:http');
    const tokens = normalizeResponse(await response.json(), previousScopes, refreshToken);
    const issuedAt = Number(now());
    if (!Number.isFinite(issuedAt)) fail('INVALID_GOOGLE_TOKEN_REFRESH:now');
    const expiresAt = issuedAt + tokens.expiresIn * 1000;
    await tokenStore.save({
      ownerId: owner,
      provider: 'google',
      tokenRecord: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenType: tokens.tokenType,
        scopes: tokens.scopes,
        expiresAt
      }
    });
    return Object.freeze({ provider: 'google', ownerId: owner, scopes: tokens.scopes, expiresAt });
  }

  function refresh({ ownerId } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) fail('INVALID_GOOGLE_TOKEN_REFRESH:ownerId');
    const existing = inflight.get(owner);
    if (existing) return existing;
    const promise = refreshOnce(owner).finally(() => {
      if (inflight.get(owner) === promise) inflight.delete(owner);
    });
    inflight.set(owner, promise);
    return promise;
  }

  return Object.freeze({ refresh });
}

export { TOKEN_ENDPOINT as GOOGLE_REFRESH_TOKEN_ENDPOINT };
