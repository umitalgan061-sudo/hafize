import assert from 'node:assert/strict';
import { createGitHubWriteServerRuntime } from '../lib/github-write-server-runtime.mjs';

const readJson = async () => ({});
const disabled = createGitHubWriteServerRuntime({ env: {}, readJson, fetchImpl: async () => { throw new Error('network must not run'); } });
assert.equal(disabled.configured, false);
assert.deepEqual(await disabled.handle({}), { matched: false });

for (const partial of [
  { HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize' },
  { HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'x'.repeat(40) },
  { HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: Buffer.alloc(32, 1).toString('base64url') }
]) {
  assert.throws(
    () => createGitHubWriteServerRuntime({ env: partial, readJson }),
    /INVALID_GITHUB_WRITE_SERVER_RUNTIME:configuration/
  );
}

const env = {
  GITHUB_TOKEN: 'github-server-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: Buffer.alloc(32, 1).toString('base64url'),
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'u'.repeat(40),
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'owner@example.com',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: Buffer.alloc(32, 2).toString('base64url')
};
const calls = [];
const fetchImpl = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).includes('/git/ref/heads/main')) {
    return { ok: true, async json() { return { object: { sha: 'a'.repeat(40) } }; } };
  }
  if (String(url).endsWith('/git/refs')) {
    return { ok: true, async json() { return { object: { sha: 'b'.repeat(40) } }; } };
  }
  throw new Error('unexpected request');
};
let requestBody = {};
const runtime = createGitHubWriteServerRuntime({
  env,
  fetchImpl,
  readJson: async () => requestBody
});
assert.equal(runtime.configured, true);

const command = {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/runtime-test',
  baseRef: 'main'
};
requestBody = { command };
const prepared = await runtime.handle({
  method: 'POST', pathname: '/api/github/write/prepare',
  headers: { authorization: `Bearer ${env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN}` }
});
assert.equal(prepared.status, 200);
assert.match(prepared.body.approvalToken, /^gw1\./);
assert.equal(calls.length, 0);
assert.equal(JSON.stringify(prepared).includes(env.GITHUB_TOKEN), false);
assert.equal(JSON.stringify(prepared).includes('owner@example.com'), false);

requestBody = { command, approvalToken: prepared.body.approvalToken };
const executed = await runtime.handle({
  method: 'POST', pathname: '/api/github/write/execute',
  headers: { authorization: `Bearer ${env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN}` }
});
assert.equal(executed.status, 200);
assert.deepEqual(executed.body.receipt, {
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/runtime-test', sha: 'b'.repeat(40)
});
assert.equal(calls.length, 2);
assert.equal(calls.every((call) => call.init.headers.Authorization === `Bearer ${env.GITHUB_TOKEN}`), true);
assert.equal(calls[1].init.method, 'POST');

const replay = await runtime.handle({
  method: 'POST', pathname: '/api/github/write/execute',
  headers: { authorization: `Bearer ${env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN}` }
});
assert.equal(replay.status, 409);
assert.equal(replay.body.error, 'GITHUB_WRITE_APPROVAL_REPLAYED');
assert.equal(calls.length, 2);

requestBody = { command };
const unauthorized = await runtime.handle({
  method: 'POST', pathname: '/api/github/write/prepare', headers: {}
});
assert.deepEqual(unauthorized, { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
assert.equal(calls.length, 2);

const wrongRepo = { ...command, repository: 'attacker/repo' };
requestBody = { command: wrongRepo };
const rejected = await runtime.handle({
  method: 'POST', pathname: '/api/github/write/prepare',
  headers: { authorization: `Bearer ${env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN}` }
});
assert.equal(rejected.status, 403);
assert.equal(rejected.body.error, 'GITHUB_WRITE_REPOSITORY_NOT_ALLOWED');
assert.equal(calls.length, 2);

assert.throws(
  () => createGitHubWriteServerRuntime({
    env: { ...env, HAFIZE_GITHUB_WRITE_OWNER_KEY: Buffer.alloc(31).toString('base64url') }, readJson
  }),
  /INVALID_GITHUB_WRITE_SERVER_RUNTIME:ownerKey/
);

console.log('github write server runtime tests passed');
