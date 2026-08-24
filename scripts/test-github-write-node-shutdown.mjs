import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGitHubWriteNodeServerRuntime } from '../lib/github-write-node-server-runtime.mjs';

class Response extends EventEmitter {
  constructor() {
    super();
    this.writableEnded = false;
    this.destroyed = false;
  }
  end() { this.writableEnded = true; }
}

const secret = Buffer.alloc(32, 19).toString('base64url');
const env = {
  HAFIZE_GITHUB_WRITE_ENABLED: 'true',
  GITHUB_TOKEN: 'server-held-github-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: secret,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'shutdown-owner-token-fixture-32-chars',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'shutdown-owner',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: secret,
  HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: 'redis://shared-replay:6379/0'
};

let redisFactoryCalls = 0;
let redisCloseCalls = 0;
const replayKeys = new Set();
function createRedisClient(options) {
  redisFactoryCalls += 1;
  assert.equal(options.socket.connectTimeout, 5_000);
  assert.equal(options.socket.reconnectStrategy, false);
  return {
    isReady: false,
    isOpen: false,
    on() { return this; },
    async connect() {
      this.isOpen = true;
      this.isReady = true;
    },
    async set(key) {
      if (replayKeys.has(key)) return null;
      replayKeys.add(key);
      return 'OK';
    },
    async close() {
      redisCloseCalls += 1;
      this.isReady = false;
      this.isOpen = false;
    }
  };
}

const command = {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/shutdown-test',
  baseRef: 'main'
};
let requestBody = { command };
const writes = [];
const network = [];
const runtime = createGitHubWriteNodeServerRuntime({
  env,
  createRedisClient,
  readJson: async () => requestBody,
  sendJson(response, status, body) {
    writes.push({ status, body });
    response.end();
  },
  fetchImpl: async (url, init = {}) => {
    network.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).endsWith('/git/ref/heads/main')) {
      return { ok: true, async json() { return { object: { sha: 'a'.repeat(40) } }; } };
    }
    if (String(url).endsWith('/git/refs')) {
      return { ok: true, async json() { return { object: { sha: 'b'.repeat(40) } }; } };
    }
    throw new Error(`unexpected GitHub request: ${url}`);
  }
});
assert.equal(runtime.configured, true);
assert.equal(redisFactoryCalls, 0, 'prepare path must keep replay Redis lazy');

const auth = { authorization: `Bearer ${env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN}` };
const prepared = await runtime.handle({
  request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/prepare', headers: auth
});
assert.deepEqual(prepared, { matched: true, status: 200 });
const approvalToken = writes.at(-1).body.approvalToken;
assert.match(approvalToken, /^gw1\./);
assert.equal(redisFactoryCalls, 0);

requestBody = { command, approvalToken };
const executed = await runtime.handle({
  request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/execute', headers: auth
});
assert.deepEqual(executed, { matched: true, status: 200 });
assert.equal(redisFactoryCalls, 1);
assert.equal(network.length, 2);
assert.equal(redisCloseCalls, 0);

requestBody = { command };
await runtime.handle({ request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/prepare', headers: auth });
const unusedApproval = writes.at(-1).body.approvalToken;
const firstClose = runtime.close();
const secondClose = runtime.close();
assert.strictEqual(secondClose, firstClose);
await firstClose;
assert.equal(redisCloseCalls, 1, 'active replay Redis client must close exactly once');

requestBody = { command, approvalToken: unusedApproval };
const afterClose = await runtime.handle({
  request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/execute', headers: auth
});
assert.deepEqual(afterClose, { matched: true, status: 503 });
assert.equal(writes.at(-1).body.error, 'GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
assert.equal(network.length, 2, 'closed runtime must not issue another GitHub write');
assert.equal(redisFactoryCalls, 1, 'closed runtime must not reconnect replay Redis');

console.log('GitHub write Node shutdown tests passed');
