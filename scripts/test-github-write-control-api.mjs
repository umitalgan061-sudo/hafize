import assert from 'node:assert/strict';
import { createGitHubWriteControlApi, GITHUB_WRITE_CONTROL_PATHS } from '../lib/github-write-control-api.mjs';

const alice = Object.freeze({ authenticated: true, subject: 'alice@example.com' });
const calls = [];
const authenticator = {
  authenticate({ headers } = {}) {
    return headers?.authorization === 'Bearer valid-token'
      ? { ok: true, principal: alice }
      : { ok: false, error: 'AUTH_REQUIRED' };
  }
};
const approvalBoundary = {
  prepare(command, { principal }) {
    calls.push(['prepare', command, principal]);
    if (command.operation === 'repo.delete') {
      const error = new Error('INVALID_GITHUB_WRITE_OPERATION'); error.code = 'INVALID_GITHUB_WRITE_OPERATION'; throw error;
    }
    return {
      approvalToken: 'gw1.test.signature',
      expiresAt: '2033-05-18T03:34:00.000Z',
      command: Object.freeze({ ...command, content: command.content })
    };
  }
};
const executionBoundary = {
  async execute(command, context) {
    calls.push(['execute', command, context]);
    if (context.approvalToken === 'gw1.expired.signature') {
      const error = new Error('internal /secret/path'); error.code = 'GITHUB_WRITE_APPROVAL_EXPIRED'; throw error;
    }
    if (context.approvalToken === 'gw1.provider.signature') throw new Error('provider leaked token ghp_secret');
    return Object.freeze({ operation: command.operation, repository: command.repository, branch: command.branch, sha: 'a'.repeat(40) });
  }
};
const readJson = async (request) => request.body;
const api = createGitHubWriteControlApi({ authenticator, approvalBoundary, executionBoundary, readJson });

assert.deepEqual(await api.handle({ method: 'POST', pathname: '/other' }), { matched: false });
assert.deepEqual(await api.handle({ method: 'GET', pathname: GITHUB_WRITE_CONTROL_PATHS.prepare }), {
  matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' }, headers: { 'Cache-Control': 'no-store' }
});

const command = {
  operation: 'file.update', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/feature',
  path: 'lib/example.mjs', expectedBlobSha: 'b'.repeat(40), commitMessage: 'fix: example', content: 'super-sensitive-user-code'
};
const unauthorized = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.prepare,
  headers: {}, request: { body: { explicitUserIntent: true, command } }
});
assert.equal(unauthorized.status, 401);
assert.equal(calls.length, 0);

for (const body of [
  { command },
  { explicitUserIntent: false, command },
  { explicitUserIntent: true, command, approvalToken: 'not-allowed-on-prepare' },
  { explicitUserIntent: true, command, ownerId: 'owner_attacker' },
  { explicitUserIntent: true, command, token: 'ghp_attacker' }
]) {
  const result = await api.handle({
    method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.prepare,
    headers: { authorization: 'Bearer valid-token' }, request: { body }
  });
  assert.equal(result.status, 400);
}
assert.equal(calls.length, 0);

const prepared = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.prepare,
  headers: { authorization: 'Bearer valid-token' }, request: { body: { explicitUserIntent: true, command } }
});
assert.equal(prepared.status, 200);
assert.equal(prepared.body.approvalToken, 'gw1.test.signature');
assert.deepEqual(prepared.body.command, {
  operation: 'file.update', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/feature', path: 'lib/example.mjs'
});
assert.equal(JSON.stringify(prepared).includes(command.content), false);
assert.equal(JSON.stringify(prepared).includes(command.expectedBlobSha), false);
assert.equal(JSON.stringify(prepared).includes(command.commitMessage), false);
assert.equal(calls[0][2], alice);

const invalidOperation = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.prepare,
  headers: { authorization: 'Bearer valid-token' },
  request: { body: { explicitUserIntent: true, command: { operation: 'repo.delete', repository: 'umitalgan061-sudo/hafize' } } }
});
assert.deepEqual(invalidOperation.body, { error: 'INVALID_GITHUB_WRITE_OPERATION' });
assert.equal(invalidOperation.status, 400);

for (const body of [
  { explicitUserIntent: true, command },
  { explicitUserIntent: true, command, approvalToken: '' },
  { explicitUserIntent: false, command, approvalToken: 'gw1.test.signature' },
  { explicitUserIntent: true, command, approvalToken: 'gw1.test.signature', ownerId: 'owner_attacker' }
]) {
  const result = await api.handle({
    method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.execute,
    headers: { authorization: 'Bearer valid-token' }, request: { body }
  });
  assert.equal(result.status, 400);
}
assert.equal(calls.filter(([kind]) => kind === 'execute').length, 0);

const executed = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.execute,
  headers: { authorization: 'Bearer valid-token' },
  request: { body: { explicitUserIntent: true, command: { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/x', baseRef: 'main' }, approvalToken: 'gw1.test.signature' } }
});
assert.equal(executed.status, 200);
assert.equal(executed.body.receipt.sha, 'a'.repeat(40));
const executeCall = calls.find(([kind]) => kind === 'execute');
assert.equal(executeCall[2].principal, alice);
assert.equal(executeCall[2].approvalToken, 'gw1.test.signature');
assert.equal('approvalToken' in executed.body.receipt, false);

const controller = new AbortController(); controller.abort();
const cancelled = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.execute,
  headers: { authorization: 'Bearer valid-token' }, signal: controller.signal,
  request: { body: { explicitUserIntent: true, command, approvalToken: 'gw1.test.signature' } }
});
assert.equal(cancelled.status, 409);
assert.equal(cancelled.body.error, 'GITHUB_WRITE_CANCELLED');

const expired = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.execute,
  headers: { authorization: 'Bearer valid-token' },
  request: { body: { explicitUserIntent: true, command, approvalToken: 'gw1.expired.signature' } }
});
assert.equal(expired.status, 409);
assert.deepEqual(expired.body, { error: 'GITHUB_WRITE_APPROVAL_EXPIRED' });
assert.equal(JSON.stringify(expired).includes('/secret/path'), false);

const providerFailure = await api.handle({
  method: 'POST', pathname: GITHUB_WRITE_CONTROL_PATHS.execute,
  headers: { authorization: 'Bearer valid-token' },
  request: { body: { explicitUserIntent: true, command, approvalToken: 'gw1.provider.signature' } }
});
assert.equal(providerFailure.status, 500);
assert.deepEqual(providerFailure.body, { error: 'GITHUB_WRITE_CONTROL_FAILED' });
assert.equal(JSON.stringify(providerFailure).includes('ghp_secret'), false);

assert.throws(() => createGitHubWriteControlApi(), /INVALID_GITHUB_WRITE_CONTROL_AUTH/);
console.log('github write control API tests passed');
