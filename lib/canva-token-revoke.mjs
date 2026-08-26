import { requireRecordInput } from './boundary-input.mjs';

const REVOKE_ENDPOINT = 'https://api.canva.com/rest/v1/oauth/revoke';
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function invalid(field) {
  return new Error(`INVALID_CANVA_TOKEN_REVOKE:${field}`);
}

function text(value, field, max = 4096) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max) throw new Error(`INVALID_CANVA_TOKEN_REVOKE:${field}`);
  return normalized;
}

export function createCanvaTokenRevoke({ clientId, clientSecret, tokenStore, fetchImpl = globalThis.fetch } = {}) {
  const safeClientId = text(clientId, 'clientId', 512);
  const safeClientSecret = text(clientSecret, 'clientSecret', 2048);
  if (typeof tokenStore?.load !== 'function' || typeof tokenStore?.remove !== 'function') throw new Error('INVALID_CANVA_TOKEN_REVOKE:tokenStore');
  if (typeof fetchImpl !== 'function') throw new Error('INVALID_CANVA_TOKEN_REVOKE:fetch');
  const authorization = `Basic ${Buffer.from(`${safeClientId}:${safeClientSecret}`, 'utf8').toString('base64')}`;

  async function revoke(input) {
    const { ownerId, explicitUserIntent } = requireRecordInput(input, invalid);
    const owner = text(ownerId, 'ownerId', 128);
    if (!OWNER_PATTERN.test(owner)) throw new Error('INVALID_CANVA_TOKEN_REVOKE:ownerId');
    if (explicitUserIntent !== true) throw new Error('CANVA_TOKEN_REVOKE_REQUIRES_INTENT');
    const current = await tokenStore.load({ ownerId: owner, provider: 'canva' });
    if (!current || Array.isArray(current) || typeof current !== 'object') throw new Error('CANVA_TOKEN_REVOKE_FAILED:missingRecord');
    const token = text(current.refreshToken, 'refreshToken');
    const response = await fetchImpl(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
      redirect: 'error'
    });
    if (!response?.ok) throw new Error('CANVA_TOKEN_REVOKE_FAILED:http');
    const removed = await tokenStore.remove({ ownerId: owner, provider: 'canva', explicitUserIntent: true });
    return Object.freeze({ provider: 'canva', ownerId: owner, revoked: true, localTokenDeleted: removed?.deleted === true });
  }

  return Object.freeze({ revoke });
}

export { REVOKE_ENDPOINT as CANVA_REVOKE_ENDPOINT };
