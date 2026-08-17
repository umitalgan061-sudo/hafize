import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const api = require('../public/github-file-update.js');
const sourcePath = fileURLToPath(new URL('../public/github-file-update.js', import.meta.url));
const contractPath = fileURLToPath(new URL('../lib/github-write-contract.mjs', import.meta.url));
const executionPath = fileURLToPath(new URL('../lib/github-write-execution.mjs', import.meta.url));
const [source, contract, execution] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(contractPath, 'utf8'),
  readFile(executionPath, 'utf8')
]);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /api\.github\.com/,
  /Authorization\s*:/i,
  /GITHUB_TOKEN/,
  /approval.*secret/i,
  /\bchild_process\b/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/,
  /shell\s*:\s*true/i,
  /\.innerHTML\s*=/
]) {
  assert.equal(forbidden.test(source), false, `renderer must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("const REPOSITORY = 'umitalgan061-sudo/hafize'"), true);
assert.equal(source.includes("const PREPARE_PATH = '/api/github/write/prepare'"), true);
assert.equal(source.includes("const EXECUTE_PATH = '/api/github/write/execute'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("operation: 'file.update'"), true);
assert.equal(source.includes("rootRef.dispatchEvent?.(new rootRef.CustomEvent('hafize:github-file-updated'"), true);

assert.match(contract, /'file\.update'/);
assert.match(contract, /MAX_FILE_BYTES = 64 \* 1024/);
assert.match(contract, /HAFIZE_BRANCH_PREFIX = 'hafize\/'/);
assert.match(contract, /expectedBlobSha: normalizeSha/);
assert.match(contract, /GITHUB_WORKFLOW_WRITE_BLOCKED/);
assert.match(contract, /SENSITIVE_GITHUB_WRITE_PATH_BLOCKED/);
assert.match(contract, /normalizeCommitMessage/);
assert.match(contract, /normalizeContent/);
assert.match(execution, /writer\.updateFile/);
assert.match(execution, /command\.operation === 'file\.update'/);

const safe = api.buildCommand({
  branch: 'hafize/safe-file-update',
  path: 'public/safe.js',
  expectedBlobSha: '1'.repeat(40),
  commitMessage: 'update safe js',
  content: 'console.log("safe");\n'
});
assert.ok(safe);

for (const path of [
  '.github/workflows/ci.yml', '.env', '.env.local', 'private-key.pem',
  'config/credential.json', 'config/access-token.json', '../server.mjs', '/server.mjs'
]) {
  assert.equal(api.buildCommand({ ...safe, path }), null, `must reject ${path}`);
}

assert.equal(api.buildCommand({ ...safe, branch: 'main' }), null);
assert.equal(api.buildCommand({ ...safe, expectedBlobSha: '0'.repeat(39) }), null);
assert.equal(api.buildCommand({ ...safe, content: 'x'.repeat(64 * 1024 + 1) }), null);

console.log('github file update boundary tests passed');
