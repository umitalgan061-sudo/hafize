import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const merge = require('../public/github-pr-merge.js');

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const TOKEN = `gw1.${'a'.repeat(10)}.${'b'.repeat(43)}`;
const NOW = Date.parse('2026-08-17T10:00:00.000Z');

assert.equal(merge.REPOSITORY, 'umitalgan061-sudo/hafize');
assert.equal(merge.PREPARE_PATH, '/api/github/write/prepare');
assert.equal(merge.EXECUTE_PATH, '/api/github/write/execute');
assert.equal(merge.MAX_PR_NUMBER, 2_147_483_647);
assert.equal(merge.MOUNT_TIMEOUT_MS, 10_000);

assert.equal(merge.normalizePrNumber(' 238 '), 238);
assert.equal(merge.normalizePrNumber(1), 1);
assert.equal(merge.normalizePrNumber('0'), null);
assert.equal(merge.normalizePrNumber('-1'), null);
assert.equal(merge.normalizePrNumber('1.2'), null);
assert.equal(merge.normalizePrNumber('abc'), null);
assert.equal(merge.normalizePrNumber('2147483648'), null);

assert.equal(merge.normalizeHeadSha(SHA.toUpperCase()), SHA);
assert.equal(merge.normalizeHeadSha(' ' + SHA + ' '), SHA);
assert.equal(merge.normalizeHeadSha('g'.repeat(40)), null);
assert.equal(merge.normalizeHeadSha('a'.repeat(39)), null);
assert.equal(merge.normalizeHeadSha('a'.repeat(41)), null);

const command = merge.buildCommand({ prNumber: '238', expectedHeadSha: SHA });
assert.deepEqual(command, {
  operation: 'pr.merge',
  repository: 'umitalgan061-sudo/hafize',
  prNumber: 238,
  expectedHeadSha: SHA
});
assert.equal(Object.isFrozen(command), true);
assert.equal(merge.buildCommand({ prNumber: '238', expectedHeadSha: 'bad' }), null);
assert.equal(merge.buildCommand({ prNumber: '0', expectedHeadSha: SHA }), null);

assert.equal(merge.sameCommand(command, { ...command }), true);
assert.equal(merge.sameCommand(command, { ...command, expectedHeadSha: OTHER_SHA }), false);
assert.equal(merge.sameCommand(command, { ...command, extra: true }), false);
assert.equal(merge.sameCommand(command, { ...command, operation: 'pr.create' }), false);

const prepared = merge.normalizePrepared({
  command: { ...command },
  approvalToken: TOKEN,
  expiresAt: new Date(NOW + 60_000).toISOString()
}, command, NOW);
assert.ok(prepared);
assert.equal(prepared.approvalToken, TOKEN);
assert.equal(Object.isFrozen(prepared), true);
assert.equal(Object.isFrozen(prepared.command), true);

assert.equal(merge.normalizePrepared({
  command: { ...command, prNumber: 239 },
  approvalToken: TOKEN,
  expiresAt: new Date(NOW + 60_000).toISOString()
}, command, NOW), null);
assert.equal(merge.normalizePrepared({ command, approvalToken: 'bad', expiresAt: new Date(NOW + 60_000).toISOString() }, command, NOW), null);
assert.equal(merge.normalizePrepared({ command, approvalToken: TOKEN, expiresAt: new Date(NOW).toISOString() }, command, NOW), null);
assert.equal(merge.normalizePrepared({ command, approvalToken: TOKEN, expiresAt: new Date(NOW + 6 * 60_000).toISOString() }, command, NOW), null);

const receipt = merge.normalizeReceipt({
  receipt: { operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, merged: true, sha: OTHER_SHA }
}, command);
assert.deepEqual(receipt, { prNumber: 238, sha: OTHER_SHA });
assert.equal(merge.normalizeReceipt({ receipt: { operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 239, merged: true, sha: OTHER_SHA } }, command), null);
assert.equal(merge.normalizeReceipt({ receipt: { operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, merged: false, sha: OTHER_SHA } }, command), null);
assert.equal(merge.normalizeReceipt({ receipt: { operation: 'pr.merge', repository: 'other/repo', prNumber: 238, merged: true, sha: OTHER_SHA } }, command), null);
assert.equal(merge.normalizeReceipt({ receipt: { operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, merged: true, sha: 'bad' } }, command), null);

assert.match(merge.errorMessage(409), /head/i);
assert.match(merge.errorMessage(410), /süresi/i);
assert.match(merge.errorMessage(401), /oturum/i);

console.log('github PR merge helper tests passed');
