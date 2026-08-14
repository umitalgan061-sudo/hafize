import assert from 'node:assert/strict';
import { GITHUB_WRITE_LIMITS, GITHUB_WRITE_OPERATIONS, normalizeGitHubWriteRequest } from '../lib/github-write-contract.mjs';

const allowedRepositories = new Set(['umitalgan061-sudo/hafize']);
const approve = (input) => normalizeGitHubWriteRequest(input, { allowedRepositories, approvalGranted: true });
const sha = '0123456789abcdef0123456789abcdef01234567';

assert.deepEqual(GITHUB_WRITE_OPERATIONS, ['branch.create', 'file.update', 'pr.create', 'pr.merge']);
assert.equal(GITHUB_WRITE_LIMITS.branchPrefix, 'hafize/');
assert.equal(GITHUB_WRITE_LIMITS.maxFileBytes, 64 * 1024);

assert.deepEqual(approve({
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/auto-test', baseRef: 'main'
}), {
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/auto-test', baseRef: 'main'
});

const fileUpdate = {
  operation: 'file.update', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/auto-test',
  path: 'lib/example.mjs', expectedBlobSha: sha, commitMessage: 'fix: exact file update', content: 'export const ok = true;\n'
};
assert.deepEqual(approve(fileUpdate), fileUpdate);

assert.deepEqual(approve({
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize',
  head: 'hafize/auto-test', base: 'main', title: 'feat: güvenli test', draft: true
}), {
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize',
  head: 'hafize/auto-test', base: 'main', title: 'feat: güvenli test', draft: true
});

assert.deepEqual(approve({
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 128, expectedHeadSha: sha
}), {
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 128, expectedHeadSha: sha
});

for (const [input, code] of [
  [{ ...fileUpdate, approvalGranted: true }, 'INVALID_GITHUB_WRITE_FIELD'],
  [{ ...fileUpdate, repository: 'attacker/repo' }, 'GITHUB_WRITE_REPOSITORY_NOT_ALLOWED'],
  [{ ...fileUpdate, branch: 'main' }, 'GITHUB_WRITE_BRANCH_NOT_ALLOWED'],
  [{ ...fileUpdate, branch: 'feature/x' }, 'GITHUB_WRITE_BRANCH_NOT_ALLOWED'],
  [{ ...fileUpdate, path: '../secret.txt' }, 'INVALID_GITHUB_WRITE_PATH'],
  [{ ...fileUpdate, path: '.env.production' }, 'SENSITIVE_GITHUB_WRITE_PATH_BLOCKED'],
  [{ ...fileUpdate, path: 'config/api-token.json' }, 'SENSITIVE_GITHUB_WRITE_PATH_BLOCKED'],
  [{ ...fileUpdate, path: '.github/workflows/ci.yml' }, 'GITHUB_WORKFLOW_WRITE_BLOCKED'],
  [{ ...fileUpdate, expectedBlobSha: 'main' }, 'INVALID_GITHUB_WRITE_BLOB_SHA'],
  [{ ...fileUpdate, commitMessage: '' }, 'INVALID_GITHUB_WRITE_COMMIT_MESSAGE'],
  [{ ...fileUpdate, content: '' }, 'INVALID_GITHUB_WRITE_CONTENT'],
  [{ ...fileUpdate, content: 'x'.repeat(GITHUB_WRITE_LIMITS.maxFileBytes + 1) }, 'GITHUB_WRITE_CONTENT_TOO_LARGE'],
  [{ operation: 'branch.create', repository: fileUpdate.repository, branch: 'main', baseRef: 'dev' }, 'GITHUB_WRITE_BRANCH_NOT_ALLOWED'],
  [{ operation: 'pr.create', repository: fileUpdate.repository, head: 'feature/x', base: 'main', title: 'x', draft: true }, 'GITHUB_WRITE_BRANCH_NOT_ALLOWED'],
  [{ operation: 'repo.delete', repository: fileUpdate.repository }, 'INVALID_GITHUB_WRITE_OPERATION']
]) {
  assert.throws(() => approve(input), new RegExp(code));
}

assert.throws(() => normalizeGitHubWriteRequest(fileUpdate, { allowedRepositories }), /GITHUB_WRITE_APPROVAL_REQUIRED/);
assert.throws(() => normalizeGitHubWriteRequest(null, { allowedRepositories, approvalGranted: true }), /INVALID_GITHUB_WRITE_REQUEST/);

console.log('github write contract tests passed');
