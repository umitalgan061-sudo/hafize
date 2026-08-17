import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createGitHubWriteServerRuntime } from '../lib/github-write-server-runtime.mjs';

const TOKEN = 'g'.repeat(48);
const BEARER_SUBJECT = 'service:github-write';
const CLOUD_SUBJECT = 'user:hafize-web';
const REPOSITORY = 'umitalgan061-sudo/hafize';
const BASE_SHA = '1'.repeat(40);
const CREATED_SHA = '2'.repeat(40);

function b64(bytes, fill) {
  return Buffer.alloc(bytes, fill).toString('base64url');
}

function env() {
  return {
    GITHUB_TOKEN: 'github-provider-token',
    HAFIZE_GITHUB_WRITE_REPOS: REPOSITORY,
    HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: b64(32, 4),
    HAFIZE_GITHUB_WRITE_AUTH_TOKEN: TOKEN,
    HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: BEARER_SUBJECT,
    HAFIZE_GITHUB_WRITE_OWNER_KEY: b64(32, 5),
    HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: 'redis://127.0.0.1:6379/9',
    HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${b64(16, 1)}$${b64(32, 2)}`,
    HAFIZE_CLOUD_SESSION_SIGNING_KEY: b64(32, 3),
    HAFIZE_CLOUD_SESSION_SUBJECT: CLOUD_SUBJECT,
    HAFIZE_CLOUD_SESSION_ORIGIN: 'https://hafize.example',
    HAFIZE_CLOUD_SESSION_TTL_MS: '14400000'
  };
}

function cloudCookie(config, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: CLOUD_SUBJECT,
    iat: now - 1_000,
    exp: now - 1_000 + 14_400_000,
    n: 'c'.repeat(24)
  })).toString('base64url');
  const key = Buffer.from(config.HAFIZE_CLOUD_SESSION_SIGNING_KEY, 'base64url');
  const signature = createHmac('sha256', key).update(`hafize-session-v1\0${payload}`).digest('base64url');
  return `__Host-hafize_session=${payload}.${signature}`;
}

function redisFactory() {
  const claimed = new Set();
  return function createClient() {
    return {
      isReady: false,
      isOpen: false,
      on() {},
      async connect() {
        this.isReady = true;
        this.isOpen = true;
      },
      async set(key, _value, options) {
        assert.equal(options.NX, true);
        assert.equal(Number.isSafeInteger(options.PX), true);
        if (claimed.has(key)) return null;
        claimed.add(key);
        return 'OK';
      },
      async close() {
        this.isReady = false;
        this.isOpen = false;
      },
      destroy() {
        this.isReady = false;
        this.isOpen = false;
      }
    };
  };
}

function request(body) {
  return { body };
}

async function readJson(req) {
  return req.body;
}

const command = Object.freeze({
  operation: 'branch.create',
  repository: REPOSITORY,
  branch: 'hafize/cloud-session-runtime-test',
  baseRef: 'main'
});

{
  const config = env();
  let fetchCalls = 0;
  const runtime = createGitHubWriteServerRuntime({
    env: config,
    readJson,
    createRedisClient: redisFactory(),
    async fetchImpl(url, init) {
      fetchCalls += 1;
      if (fetchCalls === 1) {
        assert.match(url, /\/git\/ref\/heads\/main$/);
        assert.equal(init.method, 'GET');
        return { ok: true, status: 200, async json() { return { object: { sha: BASE_SHA } }; } };
      }
      assert.match(url, /\/git\/refs$/);
      assert.equal(init.method, 'POST');
      const payload = JSON.parse(init.body);
      assert.deepEqual(payload, { ref: 'refs/heads/hafize/cloud-session-runtime-test', sha: BASE_SHA });
      return { ok: true, status: 201, async json() { return { object: { sha: CREATED_SHA } }; } };
    }
  });

  const cookie = cloudCookie(config);
  const prepared = await runtime.handle({
    request: request({ command }),
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers: { cookie }
  });
  assert.equal(prepared.matched, true);
  assert.equal(prepared.status, 200);
  assert.equal(typeof prepared.body.approvalToken, 'string');
  assert.deepEqual(prepared.body.command, command);
  assert.equal(fetchCalls, 0, 'prepare must never call GitHub provider');

  const executed = await runtime.handle({
    request: request({ command, approvalToken: prepared.body.approvalToken }),
    method: 'POST',
    pathname: '/api/github/write/execute',
    headers: { cookie }
  });
  assert.equal(executed.status, 200);
  assert.equal(executed.body.receipt.operation, 'branch.create');
  assert.equal(executed.body.receipt.sha, CREATED_SHA);
  assert.equal(fetchCalls, 2);

  const replayed = await runtime.handle({
    request: request({ command, approvalToken: prepared.body.approvalToken }),
    method: 'POST',
    pathname: '/api/github/write/execute',
    headers: { cookie }
  });
  assert.equal(replayed.status, 409);
  assert.equal(replayed.body.error, 'GITHUB_WRITE_APPROVAL_REPLAYED');
  assert.equal(fetchCalls, 2, 'replay must be rejected before provider call');
  await runtime.close();
}

{
  const config = env();
  let providerCalled = false;
  const runtime = createGitHubWriteServerRuntime({
    env: config,
    readJson,
    createRedisClient: redisFactory(),
    async fetchImpl() {
      providerCalled = true;
      throw new Error('provider must not be called');
    }
  });
  const cookie = cloudCookie(config);
  const prepared = await runtime.handle({
    request: request({ command }),
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers: { cookie }
  });
  assert.equal(prepared.status, 200);

  const crossPrincipal = await runtime.handle({
    request: request({ command, approvalToken: prepared.body.approvalToken }),
    method: 'POST',
    pathname: '/api/github/write/execute',
    headers: { authorization: `Bearer ${TOKEN}` }
  });
  assert.equal(crossPrincipal.status, 409);
  assert.equal(crossPrincipal.body.error, 'GITHUB_WRITE_APPROVAL_MISMATCH');
  assert.equal(providerCalled, false);
  await runtime.close();
}

{
  const config = env();
  const runtime = createGitHubWriteServerRuntime({
    env: config,
    readJson,
    createRedisClient: redisFactory(),
    async fetchImpl() { throw new Error('unreachable'); }
  });
  const bearerPrepared = await runtime.handle({
    request: request({ command }),
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers: { authorization: `Bearer ${TOKEN}` }
  });
  assert.equal(bearerPrepared.status, 200, 'legacy bearer authentication must remain supported');

  const unauthenticated = await runtime.handle({
    request: request({ command }),
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers: {}
  });
  assert.deepEqual(unauthenticated, { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
  await runtime.close();
}

console.log('GitHub write cloud-session runtime tests passed');
