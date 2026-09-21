import { describe, expect, it } from 'vitest';
import { buildOAuthAuthorizationUrl, createOAuthState, createPkceChallenge, createPkceVerifier } from './oauth-pkce.ts';

const bytes = (size: number): Uint8Array => Uint8Array.from({ length: size }, (_v, i) => i + 1);

describe('OAuth PKCE', () => {
  it('creates valid verifier, state and S256 challenge values', () => {
    const verifier = createPkceVerifier({ random: bytes });
    const state = createOAuthState({ random: bytes });
    const challenge = createPkceChallenge(verifier);
    expect(verifier).toMatch(/^[A-Za-z0-9._~-]{43,128}$/);
    expect(state).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
  });

  it('builds an HTTPS-only authorization URL', () => {
    const verifier = createPkceVerifier({ random: bytes });
    const url = new URL(buildOAuthAuthorizationUrl({
      authorizationEndpoint: 'https://example.com/oauth/authorize',
      clientId: 'hafize',
      redirectUri: 'https://app.example.com/callback',
      scopes: ['openid', 'email'],
      state: createOAuthState({ random: bytes }),
      codeChallenge: createPkceChallenge(verifier),
      extraParams: { prompt: 'consent' }
    }));
    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid email');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.hash).toBe('');
  });

  it('rejects unsafe endpoints and redirect credentials', () => {
    const verifier = createPkceVerifier({ random: bytes });
    const input = {
      authorizationEndpoint: 'https://example.com/authorize',
      clientId: 'hafize',
      redirectUri: 'https://app.example.com/callback',
      scopes: ['openid'],
      state: createOAuthState({ random: bytes }),
      codeChallenge: createPkceChallenge(verifier)
    };
    expect(() => buildOAuthAuthorizationUrl({ ...input, authorizationEndpoint: 'http://example.com' })).toThrow('INVALID_OAUTH_PKCE:authorizationEndpoint');
    expect(() => buildOAuthAuthorizationUrl({ ...input, redirectUri: 'https://user:pass@example.com/callback' })).toThrow('INVALID_OAUTH_PKCE:redirectUri');
  });

  it('rejects duplicate scopes and reserved extra parameters', () => {
    const verifier = createPkceVerifier({ random: bytes });
    const base = {
      authorizationEndpoint: 'https://example.com',
      clientId: 'hafize',
      redirectUri: 'https://example.com/callback',
      state: createOAuthState({ random: bytes }),
      codeChallenge: createPkceChallenge(verifier)
    };
    expect(() => buildOAuthAuthorizationUrl({ ...base, scopes: ['email', 'email'] })).toThrow('INVALID_OAUTH_PKCE:scopes');
    expect(() => buildOAuthAuthorizationUrl({ ...base, scopes: ['email'], extraParams: { client_id: 'override' } })).toThrow('INVALID_OAUTH_PKCE:reservedParam');
  });

  it('rejects bad random sources instead of weakening entropy requirements', () => {
    expect(() => createOAuthState({ random: () => new Uint8Array(1) })).toThrow('OAUTH_PKCE_RANDOM_FAILED');
    expect(() => createPkceVerifier({ random: () => new Uint8Array(47) })).toThrow('OAUTH_PKCE_RANDOM_FAILED');
  });
});
