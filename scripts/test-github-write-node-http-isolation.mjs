import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../lib/github-write-node-http-route.mjs', import.meta.url), 'utf8');

for (const forbidden of [
  'process.env',
  'GITHUB_TOKEN',
  'HAFIZE_GITHUB_WRITE_APPROVAL_SECRET',
  'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  'HAFIZE_GITHUB_WRITE_OWNER_KEY',
  'child_process',
  'exec(',
  'spawn(',
  'shell:',
  'repo.merge',
  'external.send'
]) {
  assert.equal(source.includes(forbidden), false, `Node route must not contain privileged surface: ${forbidden}`);
}

assert.match(source, /\/api\/github\/write\/prepare/);
assert.match(source, /\/api\/github\/write\/execute/);
assert.match(source, /new AbortController\(\)/);
assert.match(source, /controller\.signal\.aborted/);
assert.match(source, /response\.writableEnded/);
assert.match(source, /response\.destroyed/);
assert.match(source, /writeRuntime\.handle/);
assert.match(source, /writeJson\(response, result\.status, result\.body\)/);
assert.doesNotMatch(source, /fetch\s*\(/);
assert.doesNotMatch(source, /Authorization\s*:/);

console.log('GitHub write Node HTTP isolation tests passed');
