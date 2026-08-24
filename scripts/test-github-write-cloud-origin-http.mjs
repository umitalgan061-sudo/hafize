import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { createGitHubWriteHttpApi } from '../lib/github-write-http-api.mjs';
import { createPrivilegedPrincipalAuthenticator } from '../lib/privileged-principal-auth.mjs';
import { createRevocableCloudSessionAuth } from '../lib/cloud-session-revocable-auth.mjs';

const password = 'github write origin password';
const salt = Buffer.alloc(16, 81);
const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
const signingKey = Buffer.alloc(32, 82).toString('base64url');
const origin = 'https://hafize.example';
const bearerToken = 'github-service-token-0123456789abcdef';
const env = {
  HAFIZE_CLOUD_SESSION_PASSWORD_HASH: `scrypt$16384$8$1$${salt.toString('base64url')}$${digest.toString('base64url')}`,
  HAFIZE_CLOUD_SESSION_SIGNING_KEY: signingKey,
  HAFIZE_CLOUD_SESSION_SUBJECT: 'user:github-write',
  HAFIZE_CLOUD_SESSION_ORIGIN: origin,
  HAFIZE_GITHUB_WRITE_AUTH_TOKEN: bearerToken,
  HAFIZE_GITHUB_WRITE_AUTH_SUBJECT: 'service:github-write'
};
const issuer = createRevocableCloudSessionAuth({
  passwordHash: env.HAFIZE_CLOUD_SESSION_PASSWORD_HASH,
  signingKey,
  subject: env.HAFIZE_CLOUD_SESSION_SUBJECT
});
const login = await issuer.login({ password });
const cookie = login.setCookie.split(';', 1)[0];
const authenticator = createPrivilegedPrincipalAuthenticator({
  env,
  tokenEnv: 'HAFIZE_GITHUB_WRITE_AUTH_TOKEN',
  subjectEnv: 'HAFIZE_GITHUB_WRITE_AUTH_SUBJECT'
});

let prepareCalls = 0;
let executeCalls = 0;
let readCalls = 0;
const command = { operation: 'branch.create', repository: 'umitalgan061-sudo/hafize', branch: 'hafize/example', fromRef: 'main' };
const api = createGitHubWriteHttpApi({
  authenticator,
  approvalBoundary: {
    prepare(input, { principal }) {
      prepareCalls += 1;
      return { approvalToken: `approval-for-${principal.subject}`, expiresAt: Date.now() + 60_000, command: input };
    }
  },
  executionBoundary: {
    async execute(input, { principal, approvalToken }) {
      executeCalls += 1;
      return { operation: input.operation, subject: principal.subject, approvalToken };
    }
  },
  async readJson(request) {
    readCalls += 1;
    return request.body;
  }
});

async function prepare(headers) {
  return api.handle({
    request: { body: { command } },
    method: 'POST',
    pathname: '/api/github/write/prepare',
    headers
  });
}

// Cookie-authenticated privileged writes must fail before body parsing without exact Origin.
assert.equal((await prepare({ cookie })).status, 401);
assert.equal((await prepare({ cookie, origin: 'https://evil.example' })).status, 401);
assert.equal(readCalls, 0);
assert.equal(prepareCalls, 0);

const cloudPrepared = await prepare({ cookie, origin });
assert.equal(cloudPrepared.status, 200);
assert.equal(cloudPrepared.body.command.operation, 'branch.create');
assert.equal(prepareCalls, 1);
assert.equal(readCalls, 1);

// Bearer remains valid for automation/server-to-server clients without Origin.
const bearerPrepared = await prepare({ authorization: `Bearer ${bearerToken}` });
assert.equal(bearerPrepared.status, 200);
assert.equal(prepareCalls, 2);
assert.equal(readCalls, 2);

const execute = await api.handle({
  request: { body: { command, approvalToken: cloudPrepared.body.approvalToken } },
  method: 'POST',
  pathname: '/api/github/write/execute',
  headers: { cookie, origin }
});
assert.equal(execute.status, 200);
assert.equal(executeCalls, 1);

// Once the session is revoked, the same exact-origin HTTP path is denied before command execution.
assert.equal(issuer.revoke({ headers: { cookie } }).ok, true);
const replay = await prepare({ cookie, origin });
assert.equal(replay.status, 401);
assert.equal(prepareCalls, 2);
assert.equal(readCalls, 3); // execute parsed once; replay did not.
assert.equal(executeCalls, 1);

assert.deepEqual(await api.handle({ method: 'GET', pathname: '/api/github/write/prepare', headers: {} }), {
  matched: true,
  status: 405,
  body: { error: 'METHOD_NOT_ALLOWED' }
});

console.log('GitHub write cloud origin HTTP tests passed');