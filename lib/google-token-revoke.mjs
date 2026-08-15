const REVOCATION_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_ERROR_BYTES = 8 * 1024;

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fail(code) {
  throw codedError(code);
}

function cleanOwner(value) {
  const owner = typeof value === 'string' ? value.trim() : '';
  if (!OWNER_RE.test(owner)) fail('INVALID_GOOGLE_TOKEN_REVOKE:ownerId');
  return owner;
}

function cleanToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (token.length < 8 || token.length > 4096 || /[\u0000\r\n]/.test(token)) {
    fail('GOOGLE_TOKEN_REVOKE_INVALID_RECORD');
  }
  return token;
}

function declaredLength(response) {
  const raw = response?.headers?.get?.('content-length');
  if (raw == null || raw === '' || !/^\d+$/.test(String(raw))) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

async function readBoundedText(response, maxBytes = MAX_ERROR_BYTES) {
  const declared = declaredLength(response);
  if (declared !== null && declared > maxBytes) fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');

  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const item = await reader.read();
        if (item?.done) break;
        if (!(item?.value instanceof Uint8Array)) fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
        const chunk = Buffer.from(item.value);
        size += chunk.length;
        if (size > maxBytes) {
          try { await reader.cancel(); } catch { /* best effort */ }
          fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
        }
        chunks.push(chunk);
      }
    } finally {
      try { reader.releaseLock?.(); } catch { /* already released */ }
    }
    return Buffer.concat(chunks, size).toString('utf8');
  }

  if (typeof response?.text === 'function') {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
    return text;
  }

  fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
}

async function isAlreadyInvalid(response) {
  if (Number(response?.status) !== 400) return false;
  let payload;
  try {
    payload = JSON.parse(await readBoundedText(response));
  } catch (error) {
    if (error?.code === 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED') throw error;
    return false;
  }
  return payload && !Array.isArray(payload) && typeof payload === 'object' && payload.error === 'invalid_token';
}

export function createGoogleTokenRevoke({
  tokenStore,
  refreshLease = null,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (typeof tokenStore?.load !== 'function' || typeof tokenStore?.remove !== 'function') {
    fail('INVALID_GOOGLE_TOKEN_REVOKE:tokenStore');
  }
  if (refreshLease !== null && typeof refreshLease?.acquire !== 'function') {
    fail('INVALID_GOOGLE_TOKEN_REVOKE:refreshLease');
  }
  if (typeof fetchImpl !== 'function') fail('INVALID_GOOGLE_TOKEN_REVOKE:fetch');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120_000) {
    fail('INVALID_GOOGLE_TOKEN_REVOKE:timeoutMs');
  }

  async function revokeProviderToken(token) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      let response;
      try {
        response = await fetchImpl(REVOCATION_ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({ token }).toString(),
          redirect: 'error',
          signal: controller.signal
        });
      } catch {
        fail(controller.signal.aborted ? 'GOOGLE_TOKEN_REVOKE_UPSTREAM_TIMEOUT' : 'GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
      }

      if (Number(response?.status) === 200) return Object.freeze({ providerRevoked: true });
      if (await isAlreadyInvalid(response)) return Object.freeze({ providerRevoked: false });
      fail('GOOGLE_TOKEN_REVOKE_UPSTREAM_FAILED');
    } finally {
      clearTimeout(timer);
    }
  }

  async function disconnect({ ownerId, explicitUserIntent } = {}) {
    const owner = cleanOwner(ownerId);
    if (explicitUserIntent !== true) fail('GOOGLE_TOKEN_REVOKE_REQUIRES_INTENT');

    let lease = null;
    try {
      if (refreshLease) lease = await refreshLease.acquire({ ownerId: owner });
      const record = await tokenStore.load({ ownerId: owner, provider: 'google' });
      if (record === null) {
        return Object.freeze({
          provider: 'google',
          ownerId: owner,
          disconnected: true,
          alreadyDisconnected: true,
          providerRevoked: false
        });
      }
      if (!record || Array.isArray(record) || typeof record !== 'object') fail('GOOGLE_TOKEN_REVOKE_INVALID_RECORD');
      const token = record.refreshToken != null
        ? cleanToken(record.refreshToken)
        : cleanToken(record.accessToken);

      const provider = await revokeProviderToken(token);
      await lease?.renew?.();
      await tokenStore.remove({
        ownerId: owner,
        provider: 'google',
        explicitUserIntent: true
      });
      return Object.freeze({
        provider: 'google',
        ownerId: owner,
        disconnected: true,
        alreadyDisconnected: false,
        providerRevoked: provider.providerRevoked
      });
    } finally {
      try { await lease?.release?.(); } catch { /* lease TTL remains the final safety net */ }
    }
  }

  return Object.freeze({ disconnect });
}

export const GOOGLE_TOKEN_REVOKE_LIMITS = Object.freeze({
  endpoint: REVOCATION_ENDPOINT,
  timeoutMs: DEFAULT_TIMEOUT_MS,
  maxErrorBytes: MAX_ERROR_BYTES
});
