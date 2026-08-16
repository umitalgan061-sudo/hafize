import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [serverSource, nodeRuntimeSource, serverRuntimeSource, replaySource] = await Promise.all([
  readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/github-write-node-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/github-write-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/github-write-replay-store.mjs', import.meta.url), 'utf8')
]);

const httpClose = serverSource.indexOf('await httpClose;');
const githubClose = serverSource.indexOf('await GITHUB_WRITE_NODE_SERVER_RUNTIME.close();');
assert.ok(httpClose >= 0, 'production shutdown must await HTTP drain');
assert.ok(githubClose > httpClose, 'GitHub replay Redis must close only after active HTTP requests drain');
assert.match(serverSource, /Hafize GitHub write shutdown failed/);
assert.match(serverSource, /process\.exitCode = 1/);

assert.match(nodeRuntimeSource, /close\(\) \{ return runtime\.close\(\); \}/);
assert.match(serverRuntimeSource, /close\(\) \{ return replayStore\.close\(\); \}/);
assert.match(replaySource, /socket:\s*\{ connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false \}/);
assert.match(replaySource, /closed = true/);
assert.match(replaySource, /GITHUB_WRITE_REPLAY_STORE_UNAVAILABLE/);

assert.doesNotMatch(serverSource, /console\.(?:log|error)\([^\n]*HAFIZE_GITHUB_WRITE_REPLAY_REDIS_URL/);
assert.doesNotMatch(serverSource, /console\.(?:log|error)\([^\n]*GITHUB_TOKEN/);

console.log('GitHub write shutdown wiring tests passed');
