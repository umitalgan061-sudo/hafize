import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const merge = require('../public/github-pr-merge.js');
const contract = await import('../lib/github-write-contract.mjs');
const execution = await import('../lib/github-write-execution.mjs');

const source = await readFile(new URL('../public/github-pr-merge.js', import.meta.url), 'utf8');
const contractSource = await readFile(new URL('../lib/github-write-contract.mjs', import.meta.url), 'utf8');
const executionSource = await readFile(new URL('../lib/github-write-execution.mjs', import.meta.url), 'utf8');
const SHA = '1'.repeat(40);

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /indexedDB/i,
  /document\.cookie/,
  /navigator\.clipboard/,
  /api\.github\.com/i,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/i,
  /innerHTML/,
  /shell\s*=\s*true/i,
  /child_process/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `merge UI must not expose forbidden surface: ${forbidden}`);
}

for (const secret of [
  'GITHUB_TOKEN',
  'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  'HAFIZE_GITHUB_WRITE_APPROVAL_SECRET',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY',
  'REDIS_URL'
]) {
  assert.equal(source.includes(secret), false, `merge UI must not reference ${secret}`);
}

assert.equal(source.includes("operation: 'pr.merge'"), true);
assert.equal(source.includes("credentials: 'same-origin'"), true);
assert.equal(source.includes("cache: 'no-store'"), true);
assert.equal(source.includes("method: 'POST'"), true);
assert.equal(source.includes("'hafize:github-pr-merged'"), true);
assert.equal(source.includes("detail: { operation: 'pr.merge', repository: REPOSITORY, prNumber: receipt.prNumber }"), true);
assert.equal(source.includes('expectedHeadSha'), true);
assert.equal(source.includes('merged: true'), false, 'UI must validate receipt rather than invent merge receipt');

assert.equal(contractSource.includes("'pr.merge'"), true);
assert.equal(contractSource.includes("'expectedHeadSha'"), true);
assert.equal(executionSource.includes('writer.mergePullRequest'), true);
assert.equal(executionSource.includes('result.merged !== true'), true);

const allowedRepositories = new Set([merge.REPOSITORY]);
const normalized = contract.normalizeGitHubWriteRequest({
  operation: 'pr.merge',
  repository: merge.REPOSITORY,
  prNumber: 238,
  expectedHeadSha: SHA
}, { allowedRepositories, approvalGranted: true });
assert.deepEqual(normalized, {
  operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, expectedHeadSha: SHA
});

assert.throws(() => contract.normalizeGitHubWriteRequest({
  operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, expectedHeadSha: 'bad'
}, { allowedRepositories, approvalGranted: true }), /INVALID_GITHUB_WRITE_HEAD_SHA/);
assert.throws(() => contract.normalizeGitHubWriteRequest({
  operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, expectedHeadSha: SHA, mergeMethod: 'merge'
}, { allowedRepositories, approvalGranted: true }), /INVALID_GITHUB_WRITE_FIELD/);
assert.throws(() => contract.normalizeGitHubWriteRequest({
  operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, expectedHeadSha: SHA
}, { allowedRepositories, approvalGranted: false }), /GITHUB_WRITE_APPROVAL_REQUIRED/);

let mergeCalls = 0;
const approvalBoundary = {
  async consume(input) { return contract.normalizeGitHubWriteRequest(input, { allowedRepositories, approvalGranted: true }); }
};
const writer = {
  async createBranch() { throw new Error('unexpected'); },
  async updateFile() { throw new Error('unexpected'); },
  async createPullRequest() { throw new Error('unexpected'); },
  async mergePullRequest(command) {
    mergeCalls += 1;
    assert.equal(command.expectedHeadSha, SHA);
    return { merged: true, sha: '2'.repeat(40) };
  }
};
const boundary = execution.createGitHubWriteExecutionBoundary({ approvalBoundary, writer });
const receipt = await boundary.execute(normalized, { principal: { subject: 'user' }, approvalToken: 'opaque' });
assert.equal(mergeCalls, 1);
assert.deepEqual(receipt, {
  operation: 'pr.merge', repository: merge.REPOSITORY, prNumber: 238, merged: true, sha: '2'.repeat(40)
});

const badBoundary = execution.createGitHubWriteExecutionBoundary({
  approvalBoundary,
  writer: { ...writer, async mergePullRequest() { return { merged: false, sha: '2'.repeat(40) }; } }
});
await assert.rejects(() => badBoundary.execute(normalized, { principal: { subject: 'user' }, approvalToken: 'opaque' }), /INVALID_GITHUB_WRITE_RECEIPT/);

console.log('github PR merge security boundary tests passed');
