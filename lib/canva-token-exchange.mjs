const TOKEN_ENDPOINT = 'https://api.canva.com/rest/v1/oauth/token';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

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

function tokenResponse(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:response');
  const accessToken = text(value.access_token, 'accessToken', { max: 4096 });
  const refreshToken = text(value.refresh_token, 'refreshToken', { max: 4096 });
  const tokenType = text(value.token_type, 'tokenType', { max: 32 });
  if (tokenType.toLowerCase() !== 'bearer') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:tokenType');
  const expiresIn = Number(value.expires_in);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 86400) throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:expiresIn');
  const scopes = value.scope == null ? [] : text(value.scope, 'scope', { max: 4096 }).split(/\s+/).filter(Boolean);
  return Object.freeze({ accessToken, refreshToken, tokenType: 'Bearer', expiresIn, scopes: Object.freeze([...new Set(scopes)]) });
}

export function createCanvaTokenExchange({ clientId, clientSecret, tokenStore, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const safeClientId = text(clientId, 'clientId', { max: 512 });
  const safeClientSecret = text(clientSecret, 'clientSecret', { max: 2048 });
  if (typeof tokenStore?.save !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:tokenStore');
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:fetch');
  if (typeof now !== 'function') throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:now');
  const authorization = `Basic ${Buffer.from(`${safeClientId}:${safeClientSecret}`, 'utf8').toString('base64')}`;

  async function exchange(request) {
    if (request != null && (Array.isArray(request) || typeof request !== 'object')) {
      throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:request');
    }
    const { ownerId, code, verifier, redirectUri: callbackUri } = request || {};
    const owner = text(ownerId, 'ownerId', { max: 128 });
    if (!OWNER_PATTERN.test(owner)) throw new Error('INVALID_CANVA_TOKEN_EXCHANGE:ownerId');
    const safeCode = text(code, 'code', { min: 8, max: 4096 });
    const safeVerifier = text(verifier, 'verifier', { min: 43, max: 128 });
    const safeRedirectUri = redirectUri(callbackUri);
    const body = new URLSearchParams({ grant_type: 'authorization_code', code_verifier: safeVerifier, code: safeCode, redirect_uri: safeRedirectUri });
    const response = await fetchImpl(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'error'
    });
    if (!response?.ok || typeof response.json !== 'function') throw new Error('CANVA_TOKEN_EXCHANGE_FAILED:http');
    const tokens = tokenResponse(await response.json());
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
