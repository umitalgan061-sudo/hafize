import { describe, expect, it } from 'vitest';
import { containsPlaintextCredential, containsSourcePlaintextCredential, isPlaintextCredentialField } from './plaintext-credential-policy.ts';

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

it('exempts only exact nonliteral source references and preserves real credential blocking',()=>{
 const safe="const NVIDIA_API_KEY = gateway?.apiKey ?? (process.env.NVIDIA_API_KEY || '');";
 expect(containsPlaintextCredential(safe)).toBe(true);
 expect(containsSourcePlaintextCredential(safe,'server.ts')).toBe(false);
 expect(containsSourcePlaintextCredential(safe,'README.md')).toBe(true);
 expect(containsSourcePlaintextCredential(safe+'\nAPI_KEY=super-secret-value','server.ts')).toBe(true);
 expect(containsSourcePlaintextCredential(safe.replace("|| ''","|| 'hardcoded-value'"),'server.ts')).toBe(true);
 expect(containsSourcePlaintextCredential("const authToken = typeof token === 'string' ? token.trim() : '';",'lib/github-read.ts')).toBe(false);
});
