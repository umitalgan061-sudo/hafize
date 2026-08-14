import assert from 'node:assert/strict';
import { createGitHubWriteHttpApi } from '../lib/github-write-http-api.mjs';

const principal = Object.freeze({ authenticated: true, subject: 'owner@example.com' });
const prepared = [];
const executed = [];
let body = {};
const api = createGitHubWriteHttpApi({
  authenticator: {
    authenticate({ headers }) {
      return headers?.authorization === 'Bearer valid-user-token' ? { ok: true, principal } : { ok: false, error: 'AUTH_REQUIRED' };
    }
  },
  approvalBoundary: {
    prepare(command, context) {
      prepared.push([command, context]);
      if (command.operation === 'bad') {
        const error = new Error('INVALID_GITHUB_WRITE_OPERATION');
        error.code = error.message;
        throw error;
      }
      return { approvalToken: 'gw1.safe-token', expiresAt: '2030-01-01T00:00:00.000Z', command };
    }
  },
  executionBoundary: {
    async execute(command, context) {
      executed.push([command, context]);
      if (context.approvalToken === 'replayed') {
        const error = new Error('GITHUB_WRITE_APPROVAL_REPLAYED');
        error.code = error.message;
        throw error;
      }
      return { operation: command.operation, repository: command.repository, sha: 'a'.repeat(40) };
    }
  },
  async readJson() { return body; }
});

assert.deepEqual(await api.handle({ method: 'GET', pathname: '/elsewhere' }), { matched: false });
assert.deepEqual(await api.handle({ method: 'GET', pathname: '/api/github/write/prepare' }), {
  matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' }
});
assert.deepEqual(await api.handle({
  method: 'POST', pathname: '/api/github/write/prepare', headers: {}
}), { matched: true, status: 401, body: { error: 'AUTH_REQUIRED' } });
assert.equal(prepared.length, 0);

const command = {
  operation: 'branch.create',
  repository: 'umitalgan061-sudo/hafize',
  branch: 'hafize/approved',
  baseRef: 'main'
};
body = { command };
const prepareResponse = await api.handle({
  method: 'POST', pathname: '/api/github/write/prepare',
  headers: { authorization: 'Bearer valid-user-token' }
});
assert.equal(prepareResponse.status, 200);
assert.equal(prepareResponse.body.approvalToken, 'gw1.safe-token');
assert.deepEqual(prepareResponse.body.command, command);
assert.equal(prepared[0][1].principal, principal);

body = { command, approvalToken: 'gw1.safe-token' };
const controller = new AbortController();
const executeResponse = await api.handle({
  method: 'POST', pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer valid-user-token' }, signal: controller.signal
});
assert.equal(executeResponse.status, 200);
assert.equal(executeResponse.body.receipt.operation, 'branch.create');
assert.equal(executed[0][1].principal, principal);
assert.equal(executed[0][1].approvalToken, 'gw1.safe-token');
assert.equal(executed[0][1].signal, controller.signal);

body = { command, approvalToken: 'replayed' };
const replay = await api.handle({
  method: 'POST', pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer valid-user-token' }
});
assert.deepEqual(replay, { matched: true, status: 409, body: { error: 'GITHUB_WRITE_APPROVAL_REPLAYED' } });

body = { command, approvalToken: 'gw1.safe-token', injected: true };
const unknownField = await api.handle({
  method: 'POST', pathname: '/api/github/write/execute',
  headers: { authorization: 'Bearer valid-user-token' }
});
assert.deepEqual(unknownField, { matched: true, status: 400, body: { error: 'INVALID_GITHUB_WRITE_HTTP_BODY' } });

body = { command: { operation: 'bad' } };
const invalid = await api.handle({
  method: 'POST', pathname: '/api/github/write/prepare',
  headers: { authorization: 'Bearer valid-user-token' }
});
assert.deepEqual(invalid, { matched: true, status: 400, body: { error: 'INVALID_GITHUB_WRITE_OPERATION' } });

const exploding = createGitHubWriteHttpApi({
  authenticator: { authenticate: () => ({ ok: true, principal }) },
  approvalBoundary: { prepare() { throw new Error('/Users/private/token=secret'); } },
  executionBoundary: { execute: async () => ({}) },
  readJson: async () => ({ command })
});
const sanitized = await exploding.handle({ method: 'POST', pathname: '/api/github/write/prepare', headers: {} });
assert.deepEqual(sanitized, { matched: true, status: 400, body: { error: 'GITHUB_WRITE_REQUEST_FAILED' } });
assert.equal(JSON.stringify(sanitized).includes('secret'), false);

console.log('github write HTTP API tests passed');
