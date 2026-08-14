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
assert.equal(JSON.stringify(prepared).includes(Buffer.alloc(32, 9).toString('hex')), false);
assert.deepEqual(approval.consume(branch, { principal: alice, approvalToken: prepared.approvalToken }), branch);
assert.throws(() => approval.consume(branch, { principal: alice, approvalToken: prepared.approvalToken }), /GITHUB_WRITE_APPROVAL_REPLAYED/);

const pr = {
  operation: 'pr.create', repository: 'umitalgan061-sudo/hafize', head: 'hafize/feature-a', base: 'main', title: 'feat: exact approval', draft: true
};
const prToken = approval.prepare(pr, { principal: alice }).approvalToken;
assert.throws(() => approval.consume({ ...pr, title: 'feat: changed after approval' }, { principal: alice, approvalToken: prToken }), /GITHUB_WRITE_APPROVAL_MISMATCH/);
assert.throws(() => approval.consume(pr, { principal: bob, approvalToken: prToken }), /GITHUB_WRITE_APPROVAL_MISMATCH/);
assert.deepEqual(approval.consume(pr, { principal: alice, approvalToken: prToken }), pr);

const merge = {
  operation: 'pr.merge', repository: 'umitalgan061-sudo/hafize', prNumber: 127,
  expectedHeadSha: '0123456789abcdef0123456789abcdef01234567'
};
const expiring = approval.prepare(merge, { principal: alice }).approvalToken;
clock += 60_000;
assert.throws(() => approval.consume(merge, { principal: alice, approvalToken: expiring }), /GITHUB_WRITE_APPROVAL_EXPIRED/);
clock -= 60_000;

const forged = approval.prepare(branch, { principal: alice }).approvalToken.replace(/.$/, 'A');
assert.throws(() => approval.consume(branch, { principal: alice, approvalToken: forged }), /GITHUB_WRITE_APPROVAL_INVALID/);
assert.throws(() => approval.prepare({ ...branch, approvalGranted: true }, { principal: alice }), /INVALID_GITHUB_WRITE_FIELD/);
assert.throws(() => approval.prepare({ ...branch, repository: 'attacker/repo' }, { principal: alice }), /GITHUB_WRITE_REPOSITORY_NOT_ALLOWED/);
assert.throws(() => approval.prepare(branch, { principal: { authenticated: false, subject: alice.subject } }), /CONNECTOR_AUTH_REQUIRED/);

console.log('github write approval tests passed');
