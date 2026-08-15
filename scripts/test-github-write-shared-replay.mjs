import assert from 'node:assert/strict';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGitHubWriteApprovalBoundary } from '../lib/github-write-approval.mjs';
import { createGitHubWriteExecutionBoundary } from '../lib/github-write-execution.mjs';
import { createGitHubWriteHttpApi } from '../lib/github-write-http-api.mjs';
import { GITHUB_WRITE_REPLAY_KEY_PREFIX, createGitHubWriteReplayStore } from '../lib/github-write-replay-store.mjs';

const shared = new Map();
const setCalls = [];
function createClient() {
  return {
    isReady: false,
    on() {},
    async connect() { this.isReady = true; },
    async set(key, value, options) {
      setCalls.push({ key, value, options });
      if (shared.has(key)) return null;
      shared.set(key, { value, options });
      return 'OK';
    }
  };
}

const now = 2_000_000_000_000;
const nonce = Buffer.alloc(16, 3).toString('base64url');
const storeA = createGitHubWriteReplayStore({ redisUrl: 'rediss://redis.internal:6380/0', createClient });
const storeB = createGitHubWriteReplayStore({ redisUrl: 'rediss://redis.internal:6380/0', createClient });
assert.equal(await storeA.claim({ nonce, expiresAt: now + 60_000, now }), true);
assert.equal(await storeB.claim({ nonce, expiresAt: now + 60_000, now }), false);
assert.equal(setCalls.length, 2);
assert.match(setCalls[0].key, new RegExp(`^${GITHUB_WRITE_REPLAY_KEY_PREFIX}:`));
assert.equal(setCalls[0].key.includes(nonce), false, 'raw nonce must never become the Redis key');
assert.deepEqual(setCalls[0].options, { NX: true, PX: 60_000 });
assert.equal(setCalls[0].value, 'used');

let expiredConnects = 0;
const expired = createGitHubWriteReplayStore({
  redisUrl: 'redis://127.0.0.1:6379/1',
  createClient: () => ({ isReady: false, on() {}, async connect() { expiredConnects += 1; }, async set() { throw new Error('must not run'); } })
});
assert.equal(await expired.claim({ nonce: Buffer.alloc(16, 4).toString('base64url'), expiresAt: now, now }), false);
assert.equal(expiredConnects, 0, 'expired tokens must not touch Redis');

const failingStore = createGitHubWriteReplayStore({
  redisUrl: 'redis://127.0.0.1:6379/2',
  createClient: () => ({ isReady: false, on() {}, async connect() { throw new Error('offline'); }, async set() {} })
});
await assert.rejects(
  () => failingStore.claim({ nonce: Buffer.alloc(16, 5).toString('base64url'), expiresAt: now + 60_000, now }),
  /GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE/
);

const approvalShared = new Map();
function createApprovalClient() {
  return {
    isReady: false,
    on() {},
    async connect() { this.isReady = true; },
    async set(key, value, options) {
      if (approvalShared.has(key)) return null;
      approvalShared.set(key, { value, options });
      return 'OK';
    }
  };
}
const repository = 'umitalgan061-sudo/hafize';
const principal = { authenticated: true, subject: 'owner@example.com' };
const ownerResolver = createConnectorOwnerResolver({ key: Buffer.alloc(32, 6) });
const approvalOptions = {
  secret: Buffer.alloc(32, 7),
  allowedRepositories: new Set([repository]),
  ownerResolver,
  now: () => now,
  randomBytesImpl: (size) => Buffer.alloc(size, 8)
};
const approvalA = createGitHubWriteApprovalBoundary({
  ...approvalOptions,
  replayStore: createGitHubWriteReplayStore({ redisUrl: 'redis://shared:6379/0', createClient: createApprovalClient })
});
const approvalB = createGitHubWriteApprovalBoundary({
  ...approvalOptions,
  replayStore: createGitHubWriteReplayStore({ redisUrl: 'redis://shared:6379/0', createClient: createApprovalClient })
});
const command = { operation: 'branch.create', repository, branch: 'hafize/shared-replay', baseRef: 'main' };
const approvalToken = approvalA.prepare(command, { principal }).approvalToken;
let writerCalls = 0;
function writer() {
  return {
    async createBranch() { writerCalls += 1; return { sha: 'a'.repeat(40) }; },
    async updateFile() { throw new Error('unused'); },
    async createPullRequest() { throw new Error('unused'); },
    async mergePullRequest() { throw new Error('unused'); }
  };
}
const executionA = createGitHubWriteExecutionBoundary({ approvalBoundary: approvalA, writer: writer() });
const executionB = createGitHubWriteExecutionBoundary({ approvalBoundary: approvalB, writer: writer() });
assert.equal((await executionA.execute(command, { principal, approvalToken })).sha, 'a'.repeat(40));
await assert.rejects(() => executionB.execute(command, { principal, approvalToken }), /GITHUB_WRITE_APPROVAL_REPLAYED/);
assert.equal(writerCalls, 1, 'cross-instance replay must never reach the GitHub writer');

const unavailable = new Error('GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE');
unavailable.code = unavailable.message;
const api = createGitHubWriteHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal }) },
  approvalBoundary: { prepare: () => ({}) },
  executionBoundary: { async execute() { throw unavailable; } },
  readJson: async () => ({ command, approvalToken: 'gw1.test' })
});
const response = await api.handle({ method: 'POST', pathname: '/api/github/write/execute', headers: {} });
assert.deepEqual(response, { matched: true, status: 503, body: { error: 'GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE' } });

console.log('GitHub write shared replay tests passed');
