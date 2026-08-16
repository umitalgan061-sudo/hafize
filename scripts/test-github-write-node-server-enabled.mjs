import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createGitHubWriteNodeServerRuntime } from '../lib/github-write-node-server-runtime.mjs';

class Response extends EventEmitter {
  constructor() { super(); this.writableEnded = false; this.destroyed = false; }
  end() { this.writableEnded = true; }
}

const secret = Buffer.alloc(32, 7).toString('base64url');
const env = {
  HAFIZE_GITHUB_WRITE_ENABLED: 'true',
  GITHUB_TOKEN: 'server-held-github-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: secret,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'user-bearer-token',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'user-1',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: secret,
  HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL: 'redis://shared-replay:6379/0'
};
let fetchCalls = 0;
const writes = [];
const runtime = createGitHubWriteNodeServerRuntime({
  env,
  readJson: async () => ({ command: { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/test', baseRef: 'main' } }),
  sendJson(response, status, body) { writes.push({ status, body }); response.end(); },
  fetchImpl: async () => { fetchCalls += 1; throw new Error('prepare must not call GitHub'); }
});
assert.equal(runtime.configured, true);
assert.deepEqual(Object.keys(runtime).sort(), ['close', 'configured', 'handle']);

const unauthorized = await runtime.handle({ request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/prepare', headers: {} });
assert.deepEqual(unauthorized, { matched: true, status: 401 });
assert.equal(writes.at(-1).body.error, 'AUTH_REQUIRED');

const prepared = await runtime.handle({
  request: {}, response: new Response(), method: 'POST', pathname: '/api/github/write/prepare',
  headers: { authorization: 'Bearer user-bearer-token' }
});
assert.deepEqual(prepared, { matched: true, status: 200 });
assert.equal(typeof writes.at(-1).body.approvalToken, 'string');
assert.ok(writes.at(-1).body.approvalToken.length > 20);
assert.equal(fetchCalls, 0);
assert.equal(JSON.stringify(runtime).includes('server-held-github-token'), false);
assert.equal(JSON.stringify(runtime).includes(secret), false);
await runtime.close();

console.log('GitHub write Node server enabled tests passed');
