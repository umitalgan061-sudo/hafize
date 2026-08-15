import { createGitHubWriteNodeHttpRoute } from './github-write-node-http-route.mjs';
import { createGitHubWriteServerRuntime } from './github-write-server-runtime.mjs';

function fail(field) {
  throw new Error(`INVALID_GITHUB_WRITE_NODE_SERVER_RUNTIME:${field}`);
}

export function createGitHubWriteNodeServerRuntime({
  env = process.env,
  readJson,
  sendJson,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof readJson !== 'function') fail('readJson');
  if (typeof sendJson !== 'function') fail('sendJson');
  const runtime = createGitHubWriteServerRuntime({ env, readJson, fetchImpl });
  const route = createGitHubWriteNodeHttpRoute({ runtime, sendJson });
  return Object.freeze({
    configured: runtime.configured === true,
    handle(input) { return route.handle(input); }
  });
}
