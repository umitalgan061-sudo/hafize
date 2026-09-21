import { describe, expect, it } from 'vitest';
import { decryptPersonalMemorySnapshot, encryptPersonalMemorySnapshot } from './personal-memory-encryption.ts';

const key = Uint8Array.from({ length: 32 }, (_v, i) => i + 3);
const iv = Uint8Array.from({ length: 12 }, (_v, i) => i + 10);

describe('personal memory encryption', () => {
  it('round-trips snapshots without exposing plaintext in the envelope', () => {
    const snapshot = { preferences: { language: 'tr' }, notes: ['one', 'two'] };
    const envelope = encryptPersonalMemorySnapshot(snapshot, key, { createIv: () => iv });
    expect(envelope.ciphertext).not.toContain('preferences');
    expect(decryptPersonalMemorySnapshot(envelope, key)).toEqual(snapshot);
  });

  it('fails closed on wrong keys and unknown fields', () => {
    const envelope = encryptPersonalMemorySnapshot({ secret: 'value' }, key, { createIv: () => iv });
    expect(() => decryptPersonalMemorySnapshot(envelope, new Uint8Array(32).fill(7))).toThrow('MEMORY_DECRYPT_FAILED');
    expect(() => decryptPersonalMemorySnapshot({ ...envelope, unknown: true }, key)).toThrow('MEMORY_DECRYPT_FAILED');
  });
});
