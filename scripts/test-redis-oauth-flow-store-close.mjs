import assert from 'node:assert/strict';
import { createRedisOAuthFlowStore, OAUTH_REDIS_FLOW_LIMITS } from '../lib/redis-oauth-flow-store.mjs';

const FLOW = {
  state: 's'.repeat(43), verifier: 'v'.repeat(64), provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/callback', scopes: ['openid']
};

{
  let closes = 0;
  let destroys = 0;
  const client = {
    isReady: true, isOpen: true,
    async eval() { return 1; },
    async close() { closes += 1; this.isOpen = this.isReady = false; },
    destroy() { destroys += 1; this.isOpen = this.isReady = false; }
  };
  const store = createRedisOAuthFlowStore({ client });
  const closeA = store.close();
  const closeB = store.close();
  assert.strictEqual(closeA, closeB, 'close must be idempotent');
  await closeA;
  assert.equal(closes, 1);
  assert.equal(destroys, 0, 'healthy close must stay graceful');
  await assert.rejects(() => store.issue(FLOW), (error) => error?.code === 'OAUTH_FLOW_STORE_UNAVAILABLE');
}

{
  let deadline;
  let destroys = 0;
  const store = createRedisOAuthFlowStore({
    client: {
      isReady: true, isOpen: true,
      async eval() { return 1; },
      close() { return new Promise(() => {}); },
      destroy() { destroys += 1; this.isOpen = this.isReady = false; }
    },
    setTimer(callback, ms) {
      assert.equal(ms, OAUTH_REDIS_FLOW_LIMITS.commandTimeoutMs);
      deadline = callback;
      return 2;
    },
    clearTimer() {}
  });
  const closing = store.close();
  await Promise.resolve();
  deadline();
  await assert.rejects(closing, (error) => error?.code === 'OAUTH_FLOW_STORE_CLOSE_FAILED');
  assert.equal(destroys, 1, 'hung close must fall back to destroy');
}

console.log('Redis OAuth flow store close tests passed');
