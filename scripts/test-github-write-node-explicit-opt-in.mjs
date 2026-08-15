import assert from 'node:assert/strict';
import { createGitHubWriteNodeServerRuntime } from '../lib/github-write-node-server-runtime.mjs';

const secret = Buffer.alloc(32, 11).toString('base64url');
const completeEnv = {
  GITHUB_TOKEN: 'server-only-token',
  HAFIZE_GITHUB_WRITE_REPOS: 'umitalgan061-sudo/hafize',
  HAFIZE_GITHUB_WRITE_APPROVAL_SECRET: secret,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: 'owner-bearer-token',
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'owner-1',
  HAFIZE_GITHUB_WRITE_OWNER_KEY: secret
};

let reads = 0;
let writes = 0;
let fetches = 0;
const dependencies = {
  readJson: async () => { reads += 1; return {}; },
  sendJson: () => { writes += 1; },
  fetchImpl: async () => { fetches += 1; throw new Error('network must remain unreachable'); }
};

for (const enabled of [undefined, '', ' false ', 'FALSE']) {
  const env = { ...completeEnv };
  if (enabled !== undefined) env.HAFIZE_GITHUB_WRITE_ENABLED = enabled;
  const runtime = createGitHubWriteNodeServerRuntime({ env, ...dependencies });
  assert.equal(runtime.configured, false);
  assert.deepEqual(Object.keys(runtime).sort(), ['configured', 'handle']);
  assert.deepEqual(await runtime.handle({
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers: { authorization: 'Bearer owner-bearer-token' }
  }), { matched: false });
}

assert.equal(reads, 0, 'disabled write runtime must not parse request bodies');
assert.equal(writes, 0, 'disabled write runtime must not emit HTTP responses');
assert.equal(fetches, 0, 'disabled write runtime must not call GitHub');

for (const enabled of ['1', 'yes', 'on', 'TRUE-ish']) {
  assert.throws(
    () => createGitHubWriteNodeServerRuntime({
      env: { ...completeEnv, HAFIZE_GITHUB_WRITE_ENABLED: enabled },
      ...dependencies
    }),
    /INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:enabled/
  );
}

for (const missing of [
  'GITHUB_TOKEN',
  'HAFIZE_GITHUB_WRITE_REPOS',
  'HAFIZE_GITHUB_WRITE_APPROVAL_SECRET',
  'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT',
  'HAFIZE_GITHUB_WRITE_OWNER_KEY'
]) {
  const env = { ...completeEnv, HAFIZE_GITHUB_WRITE_ENABLED: 'true' };
  delete env[missing];
  assert.throws(
    () => createGitHubWriteNodeServerRuntime({ env, ...dependencies }),
    /INVALID_GITHUB_WRITE_(?:NODE_)?SERVER_RUNTIME:configuration/
  );
}

console.log('GitHub write explicit opt-in tests passed');
