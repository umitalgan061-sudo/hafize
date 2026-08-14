import assert from 'node:assert/strict';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGitHubWriteApprovalBoundary } from '../lib/github-write-approval.mjs';
import { createGitHubWriteExecutionBoundary } from '../lib/github-write-execution.mjs';

const principal = { authenticated: true, subject: 'owner@example.com' };
let nonce = 0;
const approval = createGitHubWriteApprovalBoundary({
  secret: Buffer.alloc(32, 5), allowedRepositories: new Set(['umitalgan061-sudo/hafize']),
  ownerResolver: createConnectorOwnerResolver({ key: Buffer.alloc(32, 4) }),
  randomBytesImpl: (size) => Buffer.alloc(size, ++nonce), now: () => 2_000_000_000_000
});
const calls = [];
const writer = {
  async createBranch(command, context) { calls.push(['branch', command, context]); return { sha: 'a'.repeat(40), token: 'never expose' }; },
  async updateFile(command, context) { calls.push(['file', command, context]); return { commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40), raw: '/secret/path' }; },
  async createPullRequest(command, context) { calls.push(['pr', command, context]); return { prNumber: 129, internal: '/secret/path' }; },
  async mergePullRequest(command, context) { calls.push(['merge', command, context]); return { merged: true, sha: 'd'.repeat(40), token: 'never expose' }; }
};
const execution = createGitHubWriteExecutionBoundary({ approvalBoundary: approval, writer });
const repository = 'umitalgan061-sudo/hafize';

const branch = { operation: 'branch.create', repository, branch: 'hafize/exact', baseRef: 'main' };
const branchToken = approval.prepare(branch, { principal }).approvalToken;
assert.deepEqual(await execution.execute(branch, { principal, approvalToken: branchToken }), {
  operation: 'branch.create', repository, branch: 'hafize/exact', sha: 'a'.repeat(40)
});
assert.equal(JSON.stringify(calls[0]).includes(branchToken), false);
assert.equal(JSON.stringify(calls[0]).includes(principal.subject), false);

const file = {
  operation: 'file.update', repository, branch: branch.branch, path: 'lib/exact.mjs', expectedBlobSha: 'e'.repeat(40),
  commitMessage: 'fix: approved update', content: 'export const exact = true;\n'
};
const fileToken = approval.prepare(file, { principal }).approvalToken;
const fileReceipt = await execution.execute(file, { principal, approvalToken: fileToken });
assert.deepEqual(fileReceipt, {
  operation: 'file.update', repository, branch: branch.branch, path: file.path,
  commitSha: 'b'.repeat(40), blobSha: 'c'.repeat(40)
});
assert.equal(calls[1][1].content, file.content);
assert.equal(JSON.stringify(fileReceipt).includes('/secret/path'), false);

const pr = { operation: 'pr.create', repository, head: branch.branch, base: 'main', title: 'feat: exact', draft: true };
const prToken = approval.prepare(pr, { principal }).approvalToken;
assert.deepEqual(await execution.execute(pr, { principal, approvalToken: prToken }), {
  operation: 'pr.create', repository, prNumber: 129, url: `https://github.com/${repository}/pull/129`
});

const merge = { operation: 'pr.merge', repository, prNumber: 129, expectedHeadSha: 'f'.repeat(40) };
const mergeToken = approval.prepare(merge, { principal }).approvalToken;
assert.deepEqual(await execution.execute(merge, { principal, approvalToken: mergeToken }), {
  operation: 'pr.merge', repository, prNumber: 129, merged: true, sha: 'd'.repeat(40)
});

const cancelledFile = { ...file, path: 'lib/cancelled.mjs' };
const cancelledToken = approval.prepare(cancelledFile, { principal }).approvalToken;
const controller = new AbortController();
controller.abort();
await assert.rejects(() => execution.execute(cancelledFile, { principal, approvalToken: cancelledToken, signal: controller.signal }), /GITHUB_WRITE_CANCELLED/);
assert.equal(calls.length, 4);

const failing = { ...file, path: 'lib/fails.mjs' };
const failingToken = approval.prepare(failing, { principal }).approvalToken;
writer.updateFile = async () => { throw new Error('provider path /Users/private/token'); };
await assert.rejects(() => execution.execute(failing, { principal, approvalToken: failingToken }), /GITHUB_WRITE_EXECUTION_FAILED/);
await assert.rejects(() => execution.execute(failing, { principal, approvalToken: failingToken }), /GITHUB_WRITE_APPROVAL_REPLAYED/);

console.log('github write execution tests passed');
