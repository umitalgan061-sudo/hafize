import assert from 'node:assert/strict';
import { createConnectorOwnerResolver } from '../lib/connector-owner-principal.mjs';
import { createGitHubWriteApprovalBoundary } from '../lib/github-write-approval.mjs';

const allowedRepositories = new Set(['umitalgan061-sudo/hafize']);
const ownerResolver = createConnectorOwnerResolver({ key: Buffer.alloc(32, 7) });
let clock = 2_000_000_000_000;
let nonce = 0;
const approval = createGitHubWriteApprovalBoundary({
  secret: Buffer.alloc(32, 9), allowedRepositories, ownerResolver,
  ttlMs: 60_000, now: () => clock,
  randomBytesImpl: (size) => Buffer.alloc(size, ++nonce)
});
const alice = { authenticated: true, subject: 'alice@example.com' };
const bob = { authenticated: true, subject: 'bob@example.com' };
const branch = { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/feature-a', baseRef: 'main' };

const prepared = approval.prepare(branch, { principal: alice });
assert.match(prepared.approvalToken, /^gw1\./);
assert.equal(prepared.expiresAt, new Date(clock + 60_000).toISOString());
assert.deepEqual(prepared.command, branch);
assert.equal(JSON.stringify(prepared).includes(alice.subject), false);
assert.deepEqual(approval.consume(branch, { principal: alice, approvalToken: prepared.approvalToken }), branch);
assert.throws(() => approval.consume(branch, { principal: alice, approvalToken: prepared.approvalToken }), /GITHUB_WRITE_APPROVAL_REPLAYED/);

const file = {
  operation: 'file.update', repository: branch.repository, branch: branch.branch, path: 'lib/exact.mjs',
  expectedBlobSha: 'a'.repeat(40), commitMessage: 'fix: exact content', content: 'export const value = 1;\n'
};
const fileToken = approval.prepare(file, { principal: alice }).approvalToken;
for (const changed of [
  { ...file, content: 'export const value = 2;\n' },
  { ...file, path: 'lib/other.mjs' },
  { ...file, expectedBlobSha: 'b'.repeat(40) },
  { ...file, commitMessage: 'fix: changed message' }
]) {
  assert.throws(() => approval.consume(changed, { principal: alice, approvalToken: fileToken }), /GITHUB_WRITE_APPROVAL_MISMATCH/);
}
assert.throws(() => approval.consume(file, { principal: bob, approvalToken: fileToken }), /GITHUB_WRITE_APPROVAL_MISMATCH/);
assert.deepEqual(approval.consume(file, { principal: alice, approvalToken: fileToken }), file);

const merge = { operation: 'pr.merge', repository: branch.repository, prNumber: 128, expectedHeadSha: 'c'.repeat(40) };
const expiring = approval.prepare(merge, { principal: alice }).approvalToken;
clock += 60_000;
assert.throws(() => approval.consume(merge, { principal: alice, approvalToken: expiring }), /GITHUB_WRITE_APPROVAL_EXPIRED/);
clock -= 60_000;

const genuine = approval.prepare(branch, { principal: alice }).approvalToken;
const forged = `${genuine.slice(0, -1)}${genuine.endsWith('A') ? 'B' : 'A'}`;
assert.throws(() => approval.consume(branch, { principal: alice, approvalToken: forged }), /GITHUB_WRITE_APPROVAL_INVALID/);
assert.throws(() => approval.prepare({ ...branch, approvalGranted: true }, { principal: alice }), /INVALID_GITHUB_WRITE_FIELD/);
assert.throws(() => approval.prepare(branch, { principal: { authenticated: false, subject: alice.subject } }), /CONNECTOR_AUTH_REQUIRED/);

console.log('github write approval tests passed');
