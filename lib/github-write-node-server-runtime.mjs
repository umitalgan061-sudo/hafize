import { createClient as createRedisClientDefault } from 'redis';
import { createGitHubWriteNodeHttpRoute } from './github-write-node-http-route.mjs';
import { createGitHubWriteServerRuntime } from './github-write-server-runtime.mjs';

function fail(field) {
  throw new Error(`INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:${field}`);
}

function readEnabled(env) {
  const value = typeof env?.HAFIZE_GITHUB_WRITE_ENABLED === 'string'
    ? env.HAFIZE_GITHUB_WRITE_ENABLED.trim()
    : '';
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  fail('enabled');
}

export function createGitHubWriteNodeServerRuntime({
  env = process.env,
  readJson,
  sendJson,
  fetchImpl = globalThis.fetch,
  createRedisClient = createRedisClientDefault
} = {}) {
  if (typeof readJson !== 'function') fail('readJson');
  if (typeof sendJson !== 'function') fail('sendJson');
  if (!readEnabled(env)) {
    return Object.freeze({
      configured: false,
      async handle() { return { matched: false }; },
      async close() {}
    });
  }
  const runtime = createGitHubWriteServerRuntime({ env, readJson, fetchImpl, createRedisClient });
  if (runtime.configured !== true || typeof runtime.close !== 'function') fail('configuration');
  const route = createGitHubWriteNodeHttpRoute({ runtime, sendJson });
  return Object.freeze({
    configured: true,
    handle(input) { return route.handle(input); },
    close() { return runtime.close(); }
  });
}
