const TOKEN_ENDPOINT = 'https://api.canva.com/rest/v1/oauth/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SCOPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/;
const MAX_SCOPES = 32;

function text(value, field, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new Error(`INVALID_CANVA_TOKEN_EXCHANGE:${field}`);
  return normalized;
}

function redirectUri(value) {
  const raw = text(value, 'redirectUri', { max: 2048 });
  let url;
  try { url = new URL(raw); } catch { throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:redirectUri'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:redirectUri');
  return url.toString();
}

function normalizeScopes(value, field, { optional = false } = {}) {
  if (value == null && optional) return null;
  if (!Array.isArray(value) || value.length > MAX_SCOPES) throw new Error(`INVALID_CANVA_TOKEN_EXCHANGE:${field}`);
  const normalized = [];
  const seen = new Set();
  for (const raw of value) {
    if (typeof raw !== 'string') throw new Error(`INVALID_CANVA_TOKEN_EXCHANGE:${field}`);
    const scope = raw.trim();
    if (!scope || !SCOPE_PATTERN.test(scope) || seen.has(scope)) throw new Error(`INVALID_CANVA_TOKEN_EXCHANGE:${field}`);
    seen.add(scope);
    normalized.push(scope);
  }
  return normalized.sort();
}

function assertExpectedScopes(actualScopes, expectedScopes) {
  const expected = normalizeScopes(expectedScopes, 'expectedScopes', { optional: true });
  if (expected === null) return;
  const actual = normalizeScopes(actualScopes, 'responseScopes');
  if (actual.length !== expected.length || actual.some((scope, index) => scope !== expected[index])) {
    throw new Error('CANVA_TOKEN_EXCHANGE_SCOPE_MISMATCH');
  }
}

function tokenResponse(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken', { max: 4096 });
  const refreshToken = text(value.refresh_token, 'refreshToken', { max: 4096 });
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:expiresIn');
  const scopes = value.scope == null
    ? []
    : normalizeScopes(text(value.scope, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean), 'responseScopes');
  return Object.freeze({ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: Object.freeze(scopes) });
}

export function createCanvaTokenExchange({ clientId, clientSecret, tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.save !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:tokenStore');
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:fetch');
  if (typeof now !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:now');
  const authorization = `Basic ${Buffer.from(`${safeClientId}:${safeClientSecret}`, 'utf8').toString('base64')}`;

  async function exchange({ ownerId, code, verifier, redirectUri: callbackUri, expectedScopes } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:ownerId');
    const safeCode = text(code, 'code', { min: 8, max: 4096 });
    const safeVerifier = text(verifier, 'verifier', { min: 43, max: 128 });
    const safeRedirectUri = redirectUri(callbackUri);
    const safeExpectedScopes = normalizeScopes(expectedScopes, 'expectedScopes', { optional: true });
    const body = new URLSearchParams({ grant_type: 'authorization_code', code_verifier: safeVerifier, code: safeCode, redirect_uri: safeRedirectUri });
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:http');
    const tokens = tokenResponse(await response.json());
    assertExpectedScopes(tokens.scopes, safeExpectedScopes);
    const issuedAt = Number(now());
    if (!Number.isFinite(issuedAt)) throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:now');
    const expiresAt = issuedAt + tokens.expiresIn * 1000;
    await tokenStore.save({
      ownerId: owner,
      provider: 'canva',
      tokenRecord: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenType: tokens.tokenType, scopes: tokens.scopes, expiresAt }
    });
    return Object.freeze({ provider: 'canva', ownerId: owner, scopes: tokens.scopes, expiresAt, refreshTokenStored: true });
  }

  return Object.freeze({ exchange });
}

export { TOKEN_ENDPOINT as CANVA_TOKEN_ENDPOINT };
