import assert from 'node:assert/strict';
import { createGitHubWriteHttpApi } from '../lib/github-write-http-api.mjs';

let providerBoundaryCalls = 0;
const authenticator = {
  authenticate() {
    return { ok: true, principal: Object.freeze({ authenticated: true, subject: 'user:browser' }) };
  }
};
const approvalBoundary = {
  prepare(command) {
    providerBoundaryCalls += 1;
    return { approvalToken: 'token', expiresAt: '2099-01-01T00:00:00.000Z', command };
  }
};
const executionBoundary = {
  async execute() {
    providerBoundaryCalls += 1;
    return { operation: 'branch.create' };
  }
};

function apiWithBody(body) {
  return createGitHubWriteHttpApi({
    authenticator,
    approvalBoundary,
    executionBoundary,
    async readJson() { return body; }
  });
}

{
  const api = apiWithBody({ command: {} });
  const result = await api.handle({ method: 'GET', pathname: '/api/github/write/prepare', headers: {} });
  assert.deepEqual(result, { matched: true, status: 405, body: { error: 'METHOD_NOT_ALLOWED' } });
  assert.equal(providerBoundaryCalls, 0);
}

{
  const api = apiWithBody({ command: {}, unexpected: true });
  const result = await api.handle({ method: 'POST', pathname: '/api/github/write/prepare', headers: {} });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_GITHUB_WRITE_HTTP_BODY');
  assert.equal(providerBoundaryCalls, 0);
}

{
  const api = apiWithBody({ command: {} });
  const result = await api.handle({ method: 'POST', pathname: '/api/github/write/execute', headers: {} });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_GITHUB_WRITE_HTTP_BODY');
  assert.equal(providerBoundaryCalls, 0);
}

{
  const api = apiWithBody({ command: {}, approvalToken: 'x', extra: 'no' });
  const result = await api.handle({ method: 'POST', pathname: '/api/github/write/execute', headers: {} });
  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'INVALID_GITHUB_WRITE_HTTP_BODY');
  assert.equal(providerBoundaryCalls, 0);
}

{
  const api = apiWithBody({ command: {} });
  const result = await api.handle({ method: 'POST', pathname: '/api/github/read', headers: {} });
  assert.deepEqual(result, { matched: false });
  assert.equal(providerBoundaryCalls, 0);
}

console.log('GitHub write cloud-session HTTP failure tests passed');
