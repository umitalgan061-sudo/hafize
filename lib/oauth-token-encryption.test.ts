import { describe, expect, it } from 'vitest';
import { decryptOAuthTokenRecord, encryptOAuthTokenRecord } from './oauth-token-encryption.ts';

const key = Uint8Array.from({ length: 32 }, (_v, i) => i);
const iv = Uint8Array.from({ length: 12 }, (_v, i) => 255 - i);

describe('OAuth token encryption', () => {
  it('round-trips structured token data with AES-256-GCM', () => {
    const record = { accessToken: 'token-value', expiresAt: 123, scopes: ['read'] };
    const envelope = encryptOAuthTokenRecord(record, key, { createIv: () => iv });
    expect(envelope.version).toBe(1);
    expect(envelope.algorithm).toBe('aes-256-gcm');
    expect(decryptOAuthTokenRecord(envelope, key)).toEqual(record);
  });

  it('rejects invalid key lengths and envelope fields', () => {
    expect(() => encryptOAuthTokenRecord({}, new Uint8Array(31), { createIv: () => iv })).toThrow(/INVALID_OAUTH_TOKEN_ENCRYPTION:key/);
    const envelope = encryptOAuthTokenRecord({ ok: true }, key, { createIv: () => iv });
    expect(() => decryptOAuthTokenRecord({ ...envelope, extra: true }, key)).toThrow('OAUTH_TOKEN_DECRYPT_FAILED');
  });

  it('fails closed for tampered authentication data', () => {
    const envelope = encryptOAuthTokenRecord({ ok: true }, key, { createIv: () => iv });
    const tag = envelope.tag.slice(0, -2) + 'AA';
    expect(() => decryptOAuthTokenRecord({ ...envelope, tag }, key)).toThrow('OAUTH_TOKEN_DECRYPT_FAILED');
  });
});
