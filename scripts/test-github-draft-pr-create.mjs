import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const api = require('../public/github-draft-pr-create.js');

assert.equal(api.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(api.BRANCH_PREFIX, 'hafize/');
assert.equal(api.MAX_HEAD_SUFFIX_CHARS, 90);
assert.equal(api.MAX_BASE_REF_CHARS, 120);
assert.equal(api.MAX_TITLE_CHARS, 180);

assert.equal(api.normalizeHeadSuffix(' Feature/Test '), 'feature/test');
assert.equal(api.normalizeHeadSuffix('a'.repeat(91)), null);
assert.equal(api.normalizeHeadSuffix('../escape'), null);
assert.equal(api.normalizeHeadSuffix('feature//x'), null);
assert.equal(api.normalizeHeadSuffix('feature/'), null);
assert.equal(api.normalizeHeadSuffix(''), null);

assert.equal(api.normalizeBaseRef(' main '), 'main');
assert.equal(api.normalizeBaseRef('release/v1.2.3'), 'release/v1.2.3');
assert.equal(api.normalizeBaseRef('../main'), null);
assert.equal(api.normalizeBaseRef('main//x'), null);
assert.equal(api.normalizeBaseRef('x'.repeat(121)), null);

assert.equal(api.normalizeTitle('  feat:   safe   PR  '), 'feat: safe PR');
assert.equal(api.normalizeTitle('x'.repeat(181)), null);
assert.equal(api.normalizeTitle('bad\u0000title'), null);
assert.equal(api.normalizeTitle('   '), null);

const command = api.buildCommand({
  headSuffix: 'safe-pr',
  baseRef: 'main',
  title: 'feat: safe PR'
});
assert.deepEqual(command, {
  operation: 'pr.create',
  repository: 'umitalgan061-sudo/hafize',
  head: 'hafize/safe-pr',
  base: 'main',
  title: 'feat: safe PR',
  draft: true
});
assert.equal(api.buildCommand({ headSuffix: 'main', baseRef: 'hafize/main', title: 'x' }), null);
assert.equal(api.buildCommand({ headSuffix: 'safe', baseRef: '', title: 'x' }), null);
assert.equal(api.buildCommand({ headSuffix: 'safe', baseRef: 'main', title: '' }), null);

assert.equal(api.sameCommand(command, { ...command }), true);
assert.equal(api.sameCommand(command, { ...command, draft: false }), false);
assert.equal(api.sameCommand(command, { ...command, extra: true }), false);
assert.equal(api.sameCommand(command, { ...command, title: 'changed' }), false);

const now = 1_700_000_000_000;
const approvalToken = `gw1.${'a'.repeat(22)}.${'b'.repeat(43)}`;
const prepared = api.normalizePrepared({
  command,
  approvalToken,
  expiresAt: new Date(now + 60_000).toISOString()
}, command, now);
assert.equal(prepared?.approvalToken, approvalToken);
assert.deepEqual(prepared?.command, command);
assert.equal(api.normalizePrepared({ command, approvalToken, expiresAt: new Date(now - 1).toISOString() }, command, now), null);
assert.equal(api.normalizePrepared({ command: { ...command, title: 'other' }, approvalToken, expiresAt: new Date(now + 60_000).toISOString() }, command, now), null);
assert.equal(api.normalizePrepared({ command, approvalToken: 'bad', expiresAt: new Date(now + 60_000).toISOString() }, command, now), null);

assert.deepEqual(api.normalizeReceipt({ receipt: { operation: 'pr.create', repository: api.REPOSITORY, prNumber: 42 } }), { prNumber: 42 });
assert.equal(api.normalizeReceipt({ receipt: { operation: 'branch.create', repository: api.REPOSITORY, prNumber: 42 } }), null);
assert.equal(api.normalizeReceipt({ receipt: { operation: 'pr.create', repository: 'other/repo', prNumber: 42 } }), null);
assert.equal(api.normalizeReceipt({ receipt: { operation: 'pr.create', repository: api.REPOSITORY, prNumber: 0 } }), null);

assert.match(api.errorMessage(401), /oturum/i);
assert.match(api.errorMessage(403), /izin/i);
assert.match(api.errorMessage(410), /süresi/i);
assert.match(api.errorMessage(422), /Branch/i);

console.log('github draft PR create helper tests passed');
