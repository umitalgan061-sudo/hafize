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

const secret = Buffer.alloc(32, 13).toString('base64url');
const baseEnv = {
  GITHUB_TOKEN: 'server-held-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: secret,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'owner-token',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'owner-13',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: secret
};
const command = {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/opt-in-e2e',
  baseRef: 'main'
};

let requestBody = { command };
const writes = [];
const network = [];
const fetchImpl = async (url, init = {}) => {
  network.push({ url: String(url), method: init.method || 'GET', authorization: init.headers?.Authorization });
  if (String(url).endsWith('/git/ref/heads/main')) {
    return { ok: true, async json() { return { object: { sha: 'a'.repeat(40) } }; } };
  }
  if (String(url).endsWith('/git/refs')) {
    return { ok: true, async json() { return { object: { sha: 'b'.repeat(40) } }; } };
  }
  throw new Error(`unexpected GitHub request: ${url}`);
};
const dependencies = {
  readJson: async () => requestBody,
  fetchImpl,
  sendJson(response, status, body) {
    writes.push({ status, body });
    response.end();
  }
};

const disabled = createGitHubWriteNodeServerRuntime({ env: baseEnv, ...dependencies });
assert.equal(disabled.configured, false);
assert.deepEqual(await disabled.handle({
  request: {},
  response: new Response(),
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer owner-token' }
}), { matched: false });
assert.equal(network.length, 0);
assert.equal(writes.length, 0);

const enabled = createGitHubWriteNodeServerRuntime({
  env: { ...baseEnv, HAFIZE_GITHUB_WRITE_ENABLED: 'true' },
  ...dependencies
});
assert.equal(enabled.configured, true);

const prepareResponse = new Response();
const prepared = await enabled.handle({
  request: {},
  response: prepareResponse,
  method: 'POST',
  pathname: '/api/github/write/prepare',
  headers: { authorization: 'Bearer owner-token' }
});
assert.deepEqual(prepared, { matched: true, status: 200 });
assert.equal(prepareResponse.writableEnded, true);
assert.equal(network.length, 0, 'prepare must never write to GitHub');
const approvalToken = writes.at(-1).body.approvalToken;
assert.match(approvalToken, /^gw1\./);
assert.equal(JSON.stringify(writes.at(-1)).includes(baseEnv.GITHUB_TOKEN), false);
assert.equal(JSON.stringify(writes.at(-1)).includes(secret), false);

requestBody = { command, approvalToken };
const executeResponse = new Response();
const executed = await enabled.handle({
  request: {},
  response: executeResponse,
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer owner-token' }
});
assert.deepEqual(executed, { matched: true, status: 200 });
assert.equal(executeResponse.writableEnded, true);
assert.deepEqual(writes.at(-1).body.receipt, {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/opt-in-e2e',
  sha: 'b'.repeat(40)
});
assert.equal(network.length, 2);
assert.deepEqual(network.map((call) => call.method), ['GET', 'POST']);
assert.equal(network.every((call) => call.authorization === 'Bearer server-held-token'), true);

const replayResponse = new Response();
const replayed = await enabled.handle({
  request: {},
  response: replayResponse,
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer owner-token' }
});
assert.deepEqual(replayed, { matched: true, status: 409 });
assert.equal(writes.at(-1).body.error, 'GITHUB_WRITE_APPROVAL_REPLAYED');
assert.equal(network.length, 2, 'replayed approval must not reach GitHub');

requestBody = { command };
const unauthorizedResponse = new Response();
const unauthorized = await enabled.handle({
  request: {},
  response: unauthorizedResponse,
  method: 'POST',
  pathname: '/api/github/write/prepare',
  headers: {}
});
assert.deepEqual(unauthorized, { matched: true, status: 401 });
assert.equal(writes.at(-1).body.error, 'AUTH_REQUIRED');
assert.equal(network.length, 2);

console.log('GitHub write opt-in execution tests passed');
