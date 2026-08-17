import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const branchCreate = require('../public/github-branch-create.js');

assert.equal(branchCreate.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(branchCreate.PREPARE_PATH, '/api/github/write/prepare');
assert.equal(branchCreate.EXECUTE_PATH, '/api/github/write/execute');
assert.equal(branchCreate.BRANCH_PREFIX, 'hafize/');
assert.equal(branchCreate.MAX_SUFFIX_CHARS, 90);
assert.equal(branchCreate.MAX_BASE_REF_CHARS, 120);
assert.equal(branchCreate.MAX_APPROVAL_TOKEN_CHARS, 2048);
assert.equal(branchCreate.MOUNT_TIMEOUT_MS, 10_000);

assert.equal(branchCreate.normalizeSuffix('  Feature-One  '), 'feature-one');
assert.equal(branchCreate.normalizeSuffix('folder/feature_2'), 'folder/feature_2');
assert.equal(branchCreate.normalizeSuffix(''), null);
assert.equal(branchCreate.normalizeSuffix('../escape'), null);
assert.equal(branchCreate.normalizeSuffix('bad//branch'), null);
assert.equal(branchCreate.normalizeSuffix('bad/'), null);
assert.equal(branchCreate.normalizeSuffix('Upper Case'), null);
assert.equal(branchCreate.normalizeSuffix('x'.repeat(91)), null);

assert.equal(branchCreate.normalizeBaseRef(' main '), 'main');
assert.equal(branchCreate.normalizeBaseRef('release/2026.08'), 'release/2026.08');
assert.equal(branchCreate.normalizeBaseRef(''), null);
assert.equal(branchCreate.normalizeBaseRef('../main'), null);
assert.equal(branchCreate.normalizeBaseRef('main//x'), null);
assert.equal(branchCreate.normalizeBaseRef('x'.repeat(121)), null);

const command = branchCreate.buildCommand({ suffix: 'safe-feature', baseRef: 'main' });
assert.deepEqual(command, {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/safe-feature',
  baseRef: 'main'
});
assert.equal(Object.isFrozen(command), true);
assert.equal(branchCreate.buildCommand({ suffix: 'safe-feature', baseRef: 'hafize/safe-feature' }), null);
assert.equal(branchCreate.buildCommand({ suffix: '../bad', baseRef: 'main' }), null);

assert.equal(branchCreate.sameCommand(command, { ...command }), true);
assert.equal(branchCreate.sameCommand(command, { ...command, operation: 'file.update' }), false);
assert.equal(branchCreate.sameCommand(command, { ...command, repository: 'other/repo' }), false);
assert.equal(branchCreate.sameCommand(command, { ...command, extra: true }), false);

const now = Date.UTC(2026, 7, 17, 12, 0, 0);
const token = `gw1.${'a'.repeat(20)}.${'b'.repeat(43)}`;
const prepared = branchCreate.normalizePrepared({
  command: { ...command },
  approvalToken: token,
  expiresAt: new Date(now + 120_000).toISOString()
}, command, now);
assert.equal(prepared.approvalToken, token);
assert.equal(prepared.command.branch, 'hafize/safe-feature');
assert.equal(Object.isFrozen(prepared), true);
assert.equal(Object.isFrozen(prepared.command), true);

assert.equal(branchCreate.normalizePrepared({ command, approvalToken: 'bad', expiresAt: new Date(now + 60_000).toISOString() }, command, now), null);
assert.equal(branchCreate.normalizePrepared({ command: { ...command, branch: 'hafize/other' }, approvalToken: token, expiresAt: new Date(now + 60_000).toISOString() }, command, now), null);
assert.equal(branchCreate.normalizePrepared({ command, approvalToken: token, expiresAt: new Date(now - 1).toISOString() }, command, now), null);
assert.equal(branchCreate.normalizePrepared({ command, approvalToken: token, expiresAt: new Date(now + 400_000).toISOString() }, command, now), null);

assert.match(branchCreate.errorMessage(401), /oturum/i);
assert.match(branchCreate.errorMessage(403), /izin/i);
assert.match(branchCreate.errorMessage(409), /eşleşmiyor/i);
assert.match(branchCreate.errorMessage(410), /süresi/i);
assert.match(branchCreate.errorMessage(503), /kullanılamıyor/i);
assert.match(branchCreate.errorMessage(502), /başarısız/i);

console.log('github branch create helper tests passed');
