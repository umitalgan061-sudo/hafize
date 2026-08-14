import assert from 'node:assert/strict';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGitHubWriteApprovalBoundary } from '../lib/github-write-approval.mjs';
import { createGitHubWriteExecutionBoundary } from '../lib/github-write-execution.mjs';

const principal = { authenticated: true, subject: 'owner@example.com' };
let nonce = 0;
const approval = createGitHubWriteApprovalBoundary({
  secret: Buffer.alloc(32, 5),
  allowedRepositories: new Set(['umitalgan061-sudo/hafize']),
  ownerResolver: createConnectorOwnerResolver({ key: Buffer.alloc(32, 4) }),
  randomBytesImpl: (size) => Buffer.alloc(size, ++nonce),
  now: () => 2_000_000_000_000
});
const calls = [];
const writer = {
  async createBranch(command, context) { calls.push(['branch', command, context]); return { sha: 'a'.repeat(40), token: 'never expose' }; },
  async createPullRequest(command, context) { calls.push(['pr', command, context]); return { prNumber: 128, internal: '/secret/path' }; },
  async mergePullRequest(command, context) { calls.push(['merge', command, context]); return { merged: true, sha: 'b'.repeat(40), token: 'never expose' }; }
};
const execution = createGitHubWriteExecutionBoundary({ approvalBoundary: approval, writer });

const branch = { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/exact', baseRef: 'main' };
const branchToken = approval.prepare(branch, { principal }).approvalToken;
assert.deepEqual(await execution.execute(branch, { principal, approvalToken: branchToken }), {
  operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/exact', sha: 'a'.repeat(40)
});
assert.equal(JSON.stringify(calls[0]).includes(branchToken), false);
assert.equal(JSON.stringify(calls[0]).includes(principal.subject), false);

const pr = { operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'hafize/exact', base: 'main', title: 'feat: exact', draft: true };
const prToken = approval.prepare(pr, { principal }).approvalToken;
assert.deepEqual(await execution.execute(pr, { principal, approvalToken: prToken }), {
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', prNumber: 128,
  url: 'https://github.com/umitalgan061-sudo/hafize/pull/128'
});

const merge = { operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 128, expectedHeadSha: 'c'.repeat(40) };
const mergeToken = approval.prepare(merge, { principal }).approvalToken;
assert.deepEqual(await execution.execute(merge, { principal, approvalToken: mergeToken }), {
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 128, merged: true, sha: 'b'.repeat(40)
});

const aborted = approval.prepare({ ...branch, branch: 'hafize/cancelled' }, { principal }).approvalToken;
const controller = new AbortController();
controller.abort();
await assert.rejects(() => execution.execute({ ...branch, branch: 'hafize/cancelled' }, { principal, approvalToken: aborted, signal: controller.signal }), /GITHUB_WRITE_CANCELLED/);
assert.equal(calls.length, 3);

const failing = approval.prepare({ ...branch, branch: 'hafize/fails' }, { principal }).approvalToken;
writer.createBranch = async () => { throw new Error('provider path /Users/private/token'); };
await assert.rejects(() => execution.execute({ ...branch, branch: 'hafize/fails' }, { principal, approvalToken: failing }), /GITHUB_WRITE_EXECUTION_FAILED/);
await assert.rejects(() => execution.execute({ ...branch, branch: 'hafize/fails' }, { principal, approvalToken: failing }), /GITHUB_WRITE_APPROVAL_REPLAYED/);

console.log('github write execution tests passed');
