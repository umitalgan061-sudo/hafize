const TOKEN_ENDPOINT = 'https://api.canva.com/rest/v1/oauth/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function text(value, field, { min = 1, max = 4096 } = {}) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length < min || normalized.length > max) throw new Error(`INVALID_CANVA_TOKEN_REFRESH:${field}`);
  return normalized;
}

function normalizeResponse(value, previousScopes) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('CANVA_TOKEN_REFRESH_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken', { max: 4096 });
  const refreshToken = text(value.refresh_token, 'refreshToken', { max: 4096 });
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') throw new Error('CANVA_TOKEN_REFRESH_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) throw new Error('CANVA_TOKEN_REFRESH_FAILED:expiresIn');
  const scopes = value.scope == null ? previousScopes : text(value.scope, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean);
  return Object.freeze({ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: Object.freeze([...new Set(scopes)]) });
}

export function createCanvaTokenRefresh({ clientId, clientSecret, tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.load !== 'function' || typeof tokenStore?.save !== 'function') throw new Error('INVALID_CANVA_TOKEN_REFRESH:tokenStore');
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_CANVA_TOKEN_REFRESH:fetch');
  if (typeof now !== 'function') throw new Error('INVALID_CANVA_TOKEN_REFRESH:now');
  const authorization = `Basic ${Buffer.from(`${safeClientId}:${safeClientSecret}`, 'utf8').toString('base64')}`;

  async function refresh({ ownerId } = {}) {
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) throw new Error('INVALID_CANVA_TOKEN_REFRESH:ownerId');
    const current = await tokenStore.load({ ownerId: owner, provider: 'canva' });
    if (!current || Array.isArray(current) || typeof current !== 'object') throw new Error('CANVA_TOKEN_REFRESH_FAILED:missingRecord');
    const refreshToken = text(current.refreshToken, 'refreshToken', { max: 4096 });
    const previousScopes = Array.isArray(current.scopes) ? current.scopes.map((scope) => text(scope, 'scope', { max: 512 })) : [];
    const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('CANVA_TOKEN_REFRESH_FAILED:http');
    const tokens = normalizeResponse(await response.json(), previousScopes);
    const issuedAt = Number(now());
    if (!Number.isFinite(issuedAt)) throw new Error('INVALID_CANVA_TOKEN_REFRESH:now');
    const expiresAt = issuedAt + tokens.expiresIn * 1000;
    await tokenStore.save({ ownerId: owner, provider: 'canva', tokenRecord: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenType: tokens.tokenType, scopes: tokens.scopes, expiresAt } });
    return Object.freeze({ provider: 'canva', ownerId: owner, scopes: tokens.scopes, expiresAt, rotated: true });
  }

  return Object.freeze({ refresh });
}

export { TOKEN_ENDPOINT as CANVA_REFRESH_TOKEN_ENDPOINT };
