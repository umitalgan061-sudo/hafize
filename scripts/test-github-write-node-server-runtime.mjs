import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGitHubWriteNodeServerRuntime } from '../lib/github-write-node-server-runtime.mjs';

function readJson() { return Promise.resolve({}); }
function sendJson() { throw new Error('disabled runtime must not write'); }

const disabled = createGitHubWriteNodeServerRuntime({
  env: {},
  readJson,
  sendJson,
  fetchImpl: async () => { throw new Error('disabled runtime must not fetch'); }
});
assert.equal(disabled.configured, false);
assert.deepEqual(Object.keys(disabled).sort(), ['configured', 'handle']);
assert.equal('runtime' in disabled, false);
assert.equal('writer' in disabled, false);
assert.equal('token' in disabled, false);
assert.equal('approvalBoundary' in disabled, false);
assert.deepEqual(await disabled.handle({
  request: {},
  response: { end() {}, writableEnded: false, destroyed: false },
  method: 'POST',
  pathname: '/api/github/write/prepare',
  headers: {}
}), { matched: false });
assert.deepEqual(await disabled.handle({
  request: {},
  response: { end() {}, writableEnded: false, destroyed: false },
  method: 'GET',
  pathname: '/api/health',
  headers: {}
}), { matched: false });

assert.throws(
  () => createGitHubWriteNodeServerRuntime({ env: {}, sendJson }),
  /INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:readJson/
);
assert.throws(
  () => createGitHubWriteNodeServerRuntime({ env: {}, readJson }),
  /INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:sendJson/
);

const source = await readFile(new URL('../lib/github-write-node-server-runtime.mjs', import.meta.url), 'utf8');
assert.match(source, /createGitHubWriteServerRuntime/);
assert.match(source, /createGitHubWriteNodeHttpRoute/);
for (const forbidden of ['GITHUB_TOKEN', 'APPROVAL_SECRET', 'AUTH_TOKEN', 'OWNER_KEY', 'Authorization', 'fetch(']) {
  assert.equal(source.includes(forbidden), false, `composition must not read privileged value directly: ${forbidden}`);
}

console.log('GitHub write Node server runtime tests passed');
