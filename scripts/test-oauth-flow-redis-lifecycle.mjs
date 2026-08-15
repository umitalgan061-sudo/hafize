import assert from 'node:assert/strict';
import { createOAuthFlowRedisStore } from '../lib/oauth-flow-redis-store.mjs';

const key = Buffer.alloc(32, 51);
let releaseConnect;
const gate = new Promise((resolve) => { releaseConnect = resolve; });
let destroyCalls = 0;
const pending = createOAuthFlowRedisStore({
  redisUrl: 'redis://shared.example.test:6379/0', key,
  loadRedisModule: async () => ({ createClient: () => ({
    isReady: false, isOpen: true, on() {},
    async connect() { await gate; this.isReady = true; },
    async set() { return 'OK'; }, async eval() { return null; },
    async close() {}, destroy() { destroyCalls += 1; this.isOpen = this.isReady = false; }
  }) })
});
const issuing = pending.issue({ state: 'p'.repeat(43), verifier: 'v'.repeat(64), ownerId: 'owner_pending', provider: 'google', redirectUri: 'https://hafize.example.test/callback', scopes: ['gmail.readonly'] });
await Promise.resolve();
const closing = pending.close();
releaseConnect();
await assert.rejects(issuing, (error) => error?.code === 'OAUTH_FLOW_STORE_WRITE_FAILED');
await closing;
assert.ok(destroyCalls >= 1);

const broken = createOAuthFlowRedisStore({
  redisUrl: 'redis://shared.example.test:6379/0', key,
  loadRedisModule: async () => ({ createClient: () => ({
    isReady: false, isOpen: false, on() {}, async connect() { this.isReady = this.isOpen = true; },
    async set() { return 'OK'; }, async eval() { return null; },
    async close() { throw new Error('redis password must stay private'); }, destroy() { throw new Error('also private'); }
  }) })
});
await broken.issue({ state: 'q'.repeat(43), verifier: 'v'.repeat(64), ownerId: 'owner_broken', provider: 'google', redirectUri: 'https://hafize.example.test/callback', scopes: ['gmail.readonly'] });
await assert.rejects(broken.close(), (error) => error?.code === 'OAUTH_FLOW_STORE_CLOSE_FAILED' && !error.message.includes('password'));
console.log('OAuth flow Redis lifecycle tests passed');
