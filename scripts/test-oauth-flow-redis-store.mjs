import assert from 'node:assert/strict';
import { createOAuthFlowRedisStore } from '../lib/oauth-flow-redis-store.mjs';

const key = Buffer.alloc(32, 31);
const shared = new Map();
let clock = 1_000;
let connects = 0;
let closes = 0;
function loadRedisModule() {
  return {
    createClient() {
      return {
        isReady: false, isOpen: false, on() {},
        async connect() { connects += 1; this.isReady = this.isOpen = true; },
        async set(k, value, { NX, PX }) {
          if (NX && shared.has(k)) return null;
          shared.set(k, { value, expiresAt: clock + PX });
          return 'OK';
        },
        async eval(_script, { keys }) {
          const item = shared.get(keys[0]);
          if (!item || item.expiresAt <= clock) { shared.delete(keys[0]); return null; }
          shared.delete(keys[0]);
          return item.value;
        },
        async close() { closes += 1; this.isReady = this.isOpen = false; },
        destroy() { this.isReady = this.isOpen = false; }
      };
    }
  };
}

const input = {
  state: 's'.repeat(43), verifier: 'v'.repeat(64), ownerId: 'owner_google_1', provider: 'google',
  redirectUri: 'https://hafize.example.test/oauth/google/callback', scopes: ['https://www.googleapis.com/auth/gmail.readonly']
};
const first = createOAuthFlowRedisStore({ redisUrl: 'rediss://user:password@redis.test:6380/0', key, ttlMs: 5_000, now: () => clock, loadRedisModule });
const second = createOAuthFlowRedisStore({ redisUrl: 'rediss://user:password@redis.test:6380/0', key, ttlMs: 5_000, now: () => clock, loadRedisModule });
assert.deepEqual(await first.issue(input), { state: input.state, expiresAt: 6_000 });
assert.equal(connects, 1);
const [[redisKey, stored]] = [...shared.entries()];
assert.match(redisKey, /^hafize:oauth-flow:v1:[a-f0-9]{64}$/);
for (const secret of [input.state, input.verifier, input.ownerId]) {
  assert.equal(redisKey.includes(secret), false);
  assert.equal(stored.value.includes(secret), false);
}
const consumed = await second.consume(input.state);
assert.equal(connects, 2);
assert.equal(consumed.ownerId, input.ownerId);
assert.equal(consumed.verifier, input.verifier);
assert.deepEqual([...consumed.scopes], input.scopes);
await assert.rejects(() => first.consume(input.state), (error) => error?.code === 'OAUTH_FLOW_NOT_FOUND');

await first.issue({ ...input, state: 'a'.repeat(43) });
await assert.rejects(() => first.issue({ ...input, state: 'a'.repeat(43) }), (error) => error?.code === 'OAUTH_FLOW_STATE_COLLISION');
const keyA = [...shared.keys()][0];
shared.get(keyA).value = '{"tampered":true}';
await assert.rejects(() => second.consume('a'.repeat(43)), (error) => error?.code === 'OAUTH_FLOW_STORE_READ_FAILED');

await first.issue({ ...input, state: 'b'.repeat(43) });
clock = 7_000;
await assert.rejects(() => second.consume('b'.repeat(43)), (error) => error?.code === 'OAUTH_FLOW_NOT_FOUND');

const closeA = first.close();
const closeB = first.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.ok(closes >= 1);
await assert.rejects(() => first.issue({ ...input, state: 'c'.repeat(43) }), (error) => error?.code === 'OAUTH_FLOW_STORE_WRITE_FAILED');
assert.throws(() => createOAuthFlowRedisStore({ redisUrl: 'https://bad.test', key }), /INVALID_OAUTH_FLOW_REDIS_STORE:redisUrl/);
console.log('shared OAuth flow Redis store tests passed');
