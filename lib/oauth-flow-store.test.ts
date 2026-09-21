import { describe, expect, it } from 'vitest';
import { createOAuthFlowStore } from './oauth-flow-store.ts';

const verifier = 'A'.repeat(64);
const state = 'B'.repeat(40);
const base = { state, verifier, provider: 'google', redirectUri: 'https://example.com/callback', scopes: ['openid', 'email'] };

describe('OAuth flow store', () => {
  it('issues and consumes a single-use flow', () => {
    let now = 1_000;
    const store = createOAuthFlowStore({ ttlMs: 1_000, now: () => now });
    const issued = store.issue(base);
    expect(issued.expiresAt).toBe(2_000);
    expect(store.size()).toBe(1);
    expect(store.consume(state)).toMatchObject({ state, provider: 'google', createdAt: 1_000 });
    expect(store.size()).toBe(0);
    expect(() => store.consume(state)).toThrow('OAUTH_FLOW_NOT_FOUND');
  });

  it('expires flows before they are consumed', () => {
    let now = 1_000;
    const store = createOAuthFlowStore({ ttlMs: 100, now: () => now });
    store.issue(base);
    now = 1_101;
    expect(() => store.consume(state)).toThrow('OAUTH_FLOW_NOT_FOUND');
    expect(store.size()).toBe(0);
  });

  it('prevents state collisions and enforces bounded capacity', () => {
    const store = createOAuthFlowStore({ maxFlows: 1 });
    store.issue(base);
    expect(() => store.issue({ ...base, state: 'C'.repeat(40) })).toThrow('OAUTH_FLOW_STORE_FULL');
    expect(() => store.issue(base)).toThrow('OAUTH_FLOW_STATE_COLLISION');
  });

  it('rejects unsafe redirect URIs and malformed scopes', () => {
    const store = createOAuthFlowStore();
    expect(() => store.issue({ ...base, redirectUri: 'http://example.com/callback' })).toThrow('INVALID_OAUTH_FLOW:redirectUri');
    expect(() => store.issue({ ...base, scopes: ['openid', 'openid'] })).toThrow('INVALID_OAUTH_FLOW:scopes');
  });
});
