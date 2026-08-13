import assert from 'node:assert/strict';
import { GITHUB_WRITE_OPERATIONS, normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';

const allowedRepositories = new Set(['umitalgan061-sudo/hafize']);

assert.deepEqual(GITHUB_WRITE_OPERATIONS, ['branch.create', 'pr.create', 'pr.merge']);

assert.deepEqual(
  normalizeGitHubWriteRequest({
    operation: 'branch.create',
    repository: 'umitalgan061-sudo/hafize',
    approvalGranted: true,
    branch: 'hafize/auto-test',
    baseRef: 'main'
  }, { allowedRepositories }),
  {
    operation: 'branch.create',
    repository: 'umitalgan061-sudo/hafize',
    branch: 'hafize/auto-test',
    baseRef: 'main'
  }
);

assert.deepEqual(
  normalizeGitHubWriteRequest({
    operation: 'pr.create',
    repository: 'umitalgan061-sudo/hafize',
    approvalGranted: true,
    head: 'hafize/auto-test',
    base: 'main',
    title: 'feat: güvenli test',
    draft: true
  }, { allowedRepositories }),
  {
    operation: 'pr.create',
    repository: 'umitalgan061-sudo/hafize',
    head: 'hafize/auto-test',
    base: 'main',
    title: 'feat: güvenli test',
    draft: true
  }
);

assert.deepEqual(
  normalizeGitHubWriteRequest({
    operation: 'pr.merge',
    repository: 'umitalgan061-sudo/hafize',
    approvalGranted: true,
    prNumber: 80,
    expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
  }, { allowedRepositories }),
  {
    operation: 'pr.merge',
    repository: 'umitalgan061-sudo/hafize',
    prNumber: 80,
    expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
  }
);

for (const input of [
  {
    operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', approvalGranted: false,
    branch: 'hafize/x', baseRef: 'main'
  },
  {
    operation: 'branch.create', repository: 'other/repo', approvalGranted: true,
    branch: 'hafize/x', baseRef: 'main'
  },
  {
    operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    branch: '../escape', baseRef: 'main'
  },
  {
    operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    head: 'same', base: 'same', title: 'x', draft: true
  },
  {
    operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    head: 'hafize/x', base: 'main', title: 'x', draft: false
  },
  {
    operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    prNumber: 0, expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
  },
  {
    operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    prNumber: 1, expectedHeadSha: 'main'
  },
  {
    operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', approvalGranted: true,
    prNumber: 1, expectedHeadSha: '0123456789abcdef0123456789abcdef01234567', token: 'secret'
  }
]) {
  assert.throws(() => normalizeGitHubWriteRequest(input, { allowedRepositories }));
}

assert.throws(
  () => normalizeGitHubWriteRequest({ operation: 'repo.delete', repository: 'umitalgan061-sudo/hafize', approvalGranted: true }, { allowedRepositories }),
  /INVALID_GITHUB_WRITE_OPERATION/
);
assert.throws(
  () => normalizeGitHubWriteRequest(null, { allowedRepositories }),
  /INVALID_GITHUB_WRITE_REQUEST/
);

console.log('github write contract tests passed');
