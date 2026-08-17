import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-file-update.js');

assert.equal(api.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(api.BRANCH_PREFIX, 'hafize/');
assert.equal(api.MAX_PATH_CHARS, 400);
assert.equal(api.MAX_COMMIT_CHARS, 200);
assert.equal(api.MAX_CONTENT_BYTES, 64 * 1024);
assert.equal(api.MOUNT_TIMEOUT_MS, 10_000);

assert.equal(api.normalizeBranch(' hafize/feature-x '), 'hafize/feature-x');
assert.equal(api.normalizeBranch('main'), null);
assert.equal(api.normalizeBranch('hafize/'), null);
assert.equal(api.normalizeBranch('hafize/a..b'), null);
assert.equal(api.normalizeBranch('hafize/a//b'), null);
assert.equal(api.normalizeBranch('hafize/a/'), null);

assert.equal(api.normalizePath('public/app.js'), 'public/app.js');
assert.equal(api.normalizePath('/public/app.js'), null);
assert.equal(api.normalizePath('../server.mjs'), null);
assert.equal(api.normalizePath('.github/workflows/check.yml'), null);
assert.equal(api.normalizePath('.env.production'), null);
assert.equal(api.normalizePath('config/github-token.json'), null);
assert.equal(api.normalizePath('certs/private-key.pem'), null);
assert.equal(api.normalizePath('a\\b.js'), null);

const sha = 'a'.repeat(40);
assert.equal(api.normalizeBlobSha(sha.toUpperCase()), sha);
assert.equal(api.normalizeBlobSha('a'.repeat(39)), null);
assert.equal(api.normalizeBlobSha('z'.repeat(40)), null);

assert.equal(api.normalizeCommitMessage(' update safe file '), 'update safe file');
assert.equal(api.normalizeCommitMessage(''), null);
assert.equal(api.normalizeCommitMessage('x'.repeat(201)), null);
assert.equal(api.normalizeCommitMessage('bad\u0000message'), null);

assert.equal(api.utf8Bytes('abc'), 3);
assert.equal(api.normalizeContent('hello'), 'hello');
assert.equal(api.normalizeContent(''), null);
assert.equal(api.normalizeContent('bad\0content'), null);
assert.equal(api.normalizeContent('x'.repeat(64 * 1024 + 1)), null);

const command = api.buildCommand({
  branch: 'hafize/file-ui',
  path: 'public/example.js',
  expectedBlobSha: sha,
  commitMessage: 'update example',
  content: 'export const ok = true;\n'
});
assert.deepEqual(command, {
  operation: 'file.update',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/file-ui',
  path: 'public/example.js',
  expectedBlobSha: sha,
  commitMessage: 'update example',
  content: 'export const ok = true;\n'
});
assert.equal(api.sameCommand(command, { ...command }), true);
assert.equal(api.sameCommand(command, { ...command, content: 'changed' }), false);
assert.equal(api.sameCommand(command, { ...command, extra: true }), false);

const now = Date.now();
const token = `gw1.${'a'.repeat(8)}.${'b'.repeat(43)}`;
const prepared = api.normalizePrepared({ command, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() }, command, now);
assert.equal(prepared?.approvalToken, token);
assert.equal(api.normalizePrepared({ command, approvalToken: token, expiresAt: new Date(now - 1).toISOString() }, command, now), null);
assert.equal(api.normalizePrepared({ command: { ...command, path: 'public/other.js' }, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() }, command, now), null);

const receipt = api.normalizeReceipt({ receipt: { operation: 'file.update', repository: api.REPOSITORY, branch: command.branch, path: command.path, commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40) } }, command);
assert.deepEqual(receipt, { commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40) });
assert.equal(api.normalizeReceipt({ receipt: { operation: 'file.update', repository: api.REPOSITORY, branch: command.branch, path: 'wrong', commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40) } }, command), null);

console.log('github file update helper tests passed');
