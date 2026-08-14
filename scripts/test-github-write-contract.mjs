import assert from 'node:assert/strict';
import { GITHUB_WRITE_OPERATIONS, normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';

const allowedRepositories = new Set(['umitalgan061-sudo/hafize']);
const approved = { allowedRepositories, approvalGranted: true };

assert.deepEqual(GITHUB_WRITE_OPERATIONS, ['branch.create', 'pr.create', 'pr.merge']);
assert.deepEqual(normalizeGitHubWriteRequest({
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/auto-test', baseRef: 'main'
}, approved), {
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/auto-test', baseRef: 'main'
});
assert.deepEqual(normalizeGitHubWriteRequest({
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'hafize/auto-test', base: 'main', title: 'feat: güvenli test', draft: true
}, approved), {
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'hafize/auto-test', base: 'main', title: 'feat: güvenli test', draft: true
});
assert.deepEqual(normalizeGitHubWriteRequest({
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 80,
  expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
}, approved), {
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 80,
  expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
});

assert.throws(() => normalizeGitHubWriteRequest({
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/x', baseRef: 'main', approvalGranted: true
}, approved), /INVALID_GITHUB_WRITE_FIELD/);
assert.throws(() => normalizeGitHubWriteRequest({
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/x', baseRef: 'main'
}, { allowedRepositories }), /GITHUB_WRITE_APPROVAL_REQUIRED/);

for (const input of [
  { operation: 'branch.create', repository: 'other/repo', branch: 'hafize/x', baseRef: 'main' },
  { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: '../escape', baseRef: 'main' },
  { operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'same', base: 'same', title: 'x', draft: true },
  { operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'hafize/x', base: 'main', title: 'x', draft: false },
  { operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 0, expectedHeadSha: '0123456789abcdef0123456789abcdef01234567' },
  { operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 1, expectedHeadSha: 'main' }
]) assert.throws(() => normalizeGitHubWriteRequest(input, approved));

assert.throws(() => normalizeGitHubWriteRequest({ operation: 'repo.delete', repository: 'umitalgan061-sudo/hafize' }, approved), /INVALID_GITHUB_WRITE_OPERATION/);
assert.throws(() => normalizeGitHubWriteRequest(null, approved), /INVALID_GITHUB_WRITE_REQUEST/);
console.log('github write contract tests passed');
