import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtimeSource = await readFile(new URL('../lib/github-write-node-server-runtime.mjs', import.meta.url), 'utf8');
const serverRuntimeSource = await readFile(new URL('../lib/github-write-server-runtime.mjs', import.meta.url), 'utf8');
const publicIndex = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

assert.match(runtimeSource, /HAFIZE_GITHUB_WRITE_ENABLED/);
assert.match(runtimeSource, /value === 'true'/);
assert.match(runtimeSource, /value === 'false'/);
assert.match(runtimeSource, /fail\('enabled'\)/);
assert.match(runtimeSource, /if \(!readEnabled\(env\)\)/);
assert.match(runtimeSource, /configured: false/);
assert.match(runtimeSource, /return \{ matched: false \}/);
assert.match(runtimeSource, /if \(runtime\.configured !== true\) fail\('configuration'\)/);

assert.doesNotMatch(runtimeSource, /process\.env\.GITHUB_TOKEN/);
assert.doesNotMatch(runtimeSource, /process\.env\.HAFIZE_GITHUB_WRITE_(?:APPROVAL_SECRET|AUTH_TOKEN|OWNER_KEY|REPLAY_REDIS_URL)/);
assert.doesNotMatch(runtimeSource, /console\.(?:log|error).*env/i);
assert.doesNotMatch(runtimeSource, /JSON\.stringify\(env\)/);

// Secret parsing stays in the existing backend-only core runtime.
assert.match(serverRuntimeSource, /env\.GITHUB_TOKEN/);
assert.match(serverRuntimeSource, /HAFIZE_GITHUB_WRITE_APPROVAL_SECRET/);
assert.match(serverRuntimeSource, /HAFIZE_GITHUB_WRITE_AUTH_TOKEN/);
assert.match(serverRuntimeSource, /HAFIZE_GITHUB_WRITE_OWNER_KEY/);
assert.match(serverRuntimeSource, /HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL/);
assert.match(serverRuntimeSource, /return Object\.freeze\(\{\s*configured: true,/s);
assert.doesNotMatch(serverRuntimeSource, /approvalSecret:/);
assert.doesNotMatch(serverRuntimeSource, /ownerKey:/);

// The activation switch and credentials must never be shipped in the browser UI.
assert.doesNotMatch(publicIndex, /HAFIZE_GITHUB_WRITE_ENABLED/);
assert.doesNotMatch(publicIndex, /HAFIZE_GITHUB_WRITE_APPROVAL_SECRET/);
assert.doesNotMatch(publicIndex, /HAFIZE_GITHUB_WRITE_AUTH_TOKEN/);
assert.doesNotMatch(publicIndex, /HAFIZE_GITHUB_WRITE_OWNER_KEY/);
assert.doesNotMatch(publicIndex, /HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL/);
assert.doesNotMatch(publicIndex, /GITHUB_TOKEN/);

console.log('GitHub write opt-in source isolation tests passed');
