import assert from 'node:assert/strict';
import {
  GITHUB_WRITE_REPLAY_CONNECT_TIMEOUT_MS,
  createGitHubWriteReplayStore
} from '../lib/github-write-replay-store.mjs';

const NONCE = 'abcdefghijklmnopqrstuv';
const expiresAt = 50_000;
const now = 10_000;

let factoryCalls = 0;
let capturedOptions = null;
let closeCalls = 0;
let destroyCalls = 0;
let setCalls = 0;
const readyClient = {
  isReady: false,
  isOpen: false,
  on() { return this; },
  async connect() {
    this.isOpen = true;
    this.isReady = true;
  },
  async set(key, value, options) {
    setCalls += 1;
    assert.match(key, /^hafize:github-write:approval:v1:[a-f0-9]{64}$/);
    assert.equal(value, 'used');
    assert.deepEqual(options, { NX: true, PX: expiresAt - now });
    return 'OK';
  },
  async close() {
    closeCalls += 1;
    this.isReady = false;
    this.isOpen = false;
  },
  destroy() {
    destroyCalls += 1;
    this.isReady = false;
    this.isOpen = false;
  }
};

const store = createGitHubWriteReplayStore({
  redisUrl: 'rediss://user:password@redis.example.test:6380/0',
  createClient(options) {
    factoryCalls += 1;
    capturedOptions = options;
    return readyClient;
  }
});

assert.equal(factoryCalls, 0, 'replay Redis must remain lazy until the first claim');
assert.equal(await store.claim({ nonce: NONCE, expiresAt, now }), true);
assert.equal(factoryCalls, 1);
assert.equal(setCalls, 1);
assert.equal(capturedOptions.url, 'rediss://user:password@redis.example.test:6380/0');
assert.deepEqual(capturedOptions.socket, {
  connectTimeout: GITHUB_WRITE_REPLAY_CONNECT_TIMEOUT_MS,
  reconnectStrategy: false
});

const firstClose = store.close();
const secondClose = store.close();
assert.strictEqual(secondClose, firstClose, 'close must be idempotent and share one promise');
await firstClose;
assert.equal(closeCalls, 1, 'ready Redis client must close exactly once');
assert.equal(destroyCalls, 0);
await assert.rejects(
  () => store.claim({ nonce: 'ABCDEFGHIJKLMNOPQRSTUV', expiresAt, now }),
  (error) => error?.code === 'GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE'
);
assert.equal(factoryCalls, 1, 'closed replay store must never reconnect');

let pendingReject = null;
let pendingDestroyCalls = 0;
let pendingFactoryCalls = 0;
const pendingClient = {
  isReady: false,
  isOpen: false,
  on() { return this; },
  connect() {
    return new Promise((_resolve, reject) => { pendingReject = reject; });
  },
  async set() { throw new Error('set must not run while connect is pending'); },
  destroy() {
    pendingDestroyCalls += 1;
    pendingReject?.(new Error('destroyed during connect'));
  }
};
const pendingStore = createGitHubWriteReplayStore({
  redisUrl: 'redis://shared-replay:6379/0',
  createClient(options) {
    pendingFactoryCalls += 1;
    assert.equal(options.socket.reconnectStrategy, false);
    return pendingClient;
  }
});
const pendingClaim = pendingStore.claim({ nonce: '1234567890123456789012', expiresAt, now });
await Promise.resolve();
assert.equal(pendingFactoryCalls, 1);
await pendingStore.close();
await assert.rejects(
  () => pendingClaim,
  (error) => error?.code === 'GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE'
);
assert.equal(pendingDestroyCalls >= 1, true, 'shutdown must interrupt a pending Redis connection');
await pendingStore.close();
assert.equal(pendingFactoryCalls, 1, 'shutdown race must not create a replacement client');

let lazyFactoryCalls = 0;
const neverOpened = createGitHubWriteReplayStore({
  redisUrl: 'redis://shared-replay:6379/0',
  createClient() {
    lazyFactoryCalls += 1;
    throw new Error('factory must stay lazy');
  }
});
await neverOpened.close();
await neverOpened.close();
assert.equal(lazyFactoryCalls, 0, 'closing an unused store must not open Redis');

console.log('github write replay store lifecycle tests passed');
