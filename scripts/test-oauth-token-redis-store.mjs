import assert from 'node:assert/strict';
import { createOAuthTokenRedisStore, OAUTH_TOKEN_REDIS_STORE_LIMITS } from '../lib/oauth-token-redis-store.mjs';

const key = Buffer.alloc(32, 21);
const ownerId = 'owner_shared_redis';
const provider = 'google';
const record = {
  accessToken: 'access-secret-111111111111',
  refreshToken: 'refresh-secret-222222222222',
  tokenType: 'Bearer',
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  expiresAt: 9_999_999
};
const shared = new Map();
let moduleLoads = 0;
let connectCalls = 0;
let closeCalls = 0;
let lastOptions = null;

function loadRedisModule() {
  moduleLoads += 1;
  return {
    createClient(options) {
      lastOptions = options;
      return {
        isReady: false,
        isOpen: false,
        on() {},
        async connect() { connectCalls += 1; this.isReady = this.isOpen = true; },
        async set(redisKey, value) { shared.set(redisKey, value); return 'OK'; },
        async get(redisKey) { return shared.get(redisKey) ?? null; },
        async del(redisKey) { return shared.delete(redisKey) ? 1 : 0; },
        async close() { closeCalls += 1; this.isReady = this.isOpen = false; },
        destroy() { this.isReady = this.isOpen = false; }
      };
    }
  };
}

const first = createOAuthTokenRedisStore({
  redisUrl: 'rediss://user:password@redis.example.test:6380/0',
  key,
  loadRedisModule
});
const second = createOAuthTokenRedisStore({
  redisUrl: 'rediss://user:password@redis.example.test:6380/0',
  key,
  loadRedisModule
});
assert.equal(moduleLoads, 0, 'Redis module loading must remain lazy');
await first.save({ ownerId, provider, tokenRecord: record });
assert.equal(moduleLoads, 1);
assert.equal(connectCalls, 1);
assert.deepEqual(lastOptions.socket, {
  connectTimeout: OAUTH_TOKEN_REDIS_STORE_LIMITS.connectTimeoutMs,
  reconnectStrategy: false
});
assert.equal(shared.size, 1);
const [redisKey, payload] = [...shared.entries()][0];
assert.match(redisKey, /^hafize:oauth-token:v1:[a-f0-9]{64}$/);
assert.equal(redisKey.includes(ownerId), false);
assert.equal(redisKey.includes(provider), false);
assert.equal(payload.includes(ownerId), false);
assert.equal(payload.includes(record.accessToken), false);
assert.equal(payload.includes(record.refreshToken), false);

assert.deepEqual(await second.load({ ownerId, provider }), record, 'independent runtimes must see one shared encrypted token record');
assert.equal(moduleLoads, 2);
assert.equal(connectCalls, 2);
await assert.rejects(
  () => second.remove({ ownerId, provider }),
  (error) => error?.code === 'OAUTH_TOKEN_STORE_DELETE_REQUIRES_INTENT'
);
assert.deepEqual(await second.remove({ ownerId, provider, explicitUserIntent: true }), { ownerId, provider, deleted: true });
assert.equal(await first.load({ ownerId, provider }), null);

await first.save({ ownerId, provider, tokenRecord: record });
shared.set(redisKey, '{"tampered":true}');
await assert.rejects(
  () => second.load({ ownerId, provider }),
  (error) => error?.code === 'OAUTH_TOKEN_STORE_READ_FAILED'
);

const closeA = first.close();
const closeB = first.close();
assert.strictEqual(closeA, closeB);
await closeA;
assert.equal(closeCalls >= 1, true);
await assert.rejects(
  () => first.load({ ownerId, provider }),
  (error) => error?.code === 'OAUTH_TOKEN_STORE_READ_FAILED'
);
assert.throws(
  () => createOAuthTokenRedisStore({ redisUrl: 'https://redis.example.test', key, loadRedisModule }),
  /INVALID_OAUTH_TOKEN_REDIS_STORE:redisUrl/
);

const closeFailure = createOAuthTokenRedisStore({
  redisUrl: 'redis://shared.example.test:6379/0',
  key,
  loadRedisModule: async () => ({
    createClient: () => ({
      isReady: false, isOpen: false, on() {},
      async connect() { this.isReady = this.isOpen = true; },
      async set() { return 'OK'; }, async get() { return null; }, async del() { return 0; },
      async close() { throw new Error('redis password must not escape'); }, destroy() { this.isOpen = false; }
    })
  })
});
await closeFailure.save({ ownerId, provider, tokenRecord: record });
await assert.rejects(closeFailure.close(), (error) => error?.code === 'OAUTH_TOKEN_STORE_CLOSE_FAILED');

console.log('oauth token shared Redis store tests passed');
