import { describe, expect, it } from 'vitest';
import { containsPlaintextCredential, isPlaintextCredentialField } from './plaintext-credential-policy.ts';

describe('credential policy',()=>{
  it('detects provider token patterns',()=>{
    expect(containsPlaintextCredential('NVIDIA_API_KEY=nvapi-abcdef')).toBe(true);
    expect(containsPlaintextCredential('Authorization: Bearer abcdefghijk')).toBe(true);
    expect(containsPlaintextCredential('-----BEGIN PRIVATE KEY-----')).toBe(true);
  });
  it('does not flag ordinary prose',()=>{
    expect(containsPlaintextCredential('API anahtarı kavramını açıklayan sıradan bir cümle.')).toBe(false);
  });
  it('detects sensitive field names',()=>{
    expect(isPlaintextCredentialField('client-secret','value')).toBe(true);
    expect(isPlaintextCredentialField('title','value')).toBe(false);
    expect(isPlaintextCredentialField('password','')).toBe(false);
  });
});
