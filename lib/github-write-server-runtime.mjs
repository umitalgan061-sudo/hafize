import { createConnectorOwnerResolver } from './connector-owner-principal.mjs';
import { parseGitHubRepoAllowlist } from './github-read.mjs';
import { createGitHubWriteApprovalBoundary } from './github-write-approval.mjs';
import { createGitHubWriteClient } from './github-write-client.mjs';
import { createGitHubWriteExecutionBoundary } from './github-write-execution.mjs';
import { createGitHubWriteHttpApi } from './github-write-http-api.mjs';
import { createGitHubWriteReplayStore } from './github-write-replay-store.mjs';
import { createBearerPrincipalAuthenticator } from './server-auth.mjs';

function fail(field) {
  throw new Error(`INVALID_GITHUB_WRITE_SERVER_RUNTIME:${field}`);
}

function decodeKey(value, field, minimum = 32, exact = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) fail(field);
  let bytes;
  try { bytes = Buffer.from(text, 'base64url'); } catch { fail(field); }
  if ((exact && bytes.length !== minimum) || (!exact && bytes.length < minimum)) fail(field);
  return bytes;
}

export function createGitHubWriteServerRuntime({
  env = process.env,
  readJson,
  fetchImpl = globalThis.fetch,
  createRedisClient
} = {}) {
  if (typeof readJson !== 'function') fail('readJson');
  const writeConfig = [
    env.HAFIZE_GITHUB_WRITE_REPOS,
    env.HAFIZE_GITHUB_WRITE_APPROVAL_SECRET,
    env.HAFIZE_GITHUB_WRITE_AUTH_TOKEN,
    env.HAFIZE_GITHUB_WRITE_AUTH_SUBJECT,
    env.HAFIZE_GITHUB_WRITE_OWNER_KEY,
    env.HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL
  ].map((value) => typeof value === 'string' ? value.trim() : '');
  if (writeConfig.every((value) => !value)) {
    return Object.freeze({
      configured: false,
      async handle() { return { matched: false }; },
      async close() {}
    });
  }
  if (writeConfig.some((value) => !value) || !String(env.GITHUB_TOKEN || '').trim()) fail('configuration');

  const repositories = parseGitHubRepoAllowlist(writeConfig[0]);
  if (!repositories.length) fail('repositories');
  const allowedRepositories = new Set(repositories);
  const authenticator = createBearerPrincipalAuthenticator({
    token: writeConfig[2],
    subject: writeConfig[3]
  });
  const ownerResolver = createConnectorOwnerResolver({ key: decodeKey(writeConfig[4], 'ownerKey', 32, true) });
  const replayStore = createGitHubWriteReplayStore({
    redisUrl: writeConfig[5],
    createClient: createRedisClient
  });
  const approvalBoundary = createGitHubWriteApprovalBoundary({
    secret: decodeKey(writeConfig[1], 'approvalSecret'),
    allowedRepositories,
    ownerResolver,
    replayStore
  });
  const writer = createGitHubWriteClient({
    token: env.GITHUB_TOKEN,
    allowedRepositories,
    fetchImpl
  });
  const executionBoundary = createGitHubWriteExecutionBoundary({ approvalBoundary, writer });
  const api = createGitHubWriteHttpApi({ authenticator, approvalBoundary, executionBoundary, readJson });

  return Object.freeze({
    configured: true,
    handle(input) { return api.handle(input); },
    close() { return replayStore.close(); }
  });
}
