import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const serverSource = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
const toolRuntimeSource = await readFile(new URL('../lib/tool-runtime.mjs', import.meta.url), 'utf8');

assert.match(
  serverSource,
  /createGitHubWriteNodeServerRuntime\(\{[\s\S]*?env: process\.env,[\s\S]*?readJson,[\s\S]*?sendJson,[\s\S]*?fetchImpl: fetch[\s\S]*?\}\)/,
  'production server must compose the explicit-opt-in GitHub write runtime server-side'
);
assert.match(serverSource, /githubWriteConfigured: GITHUB_WRITE_NODE_SERVER_RUNTIME\.configured/);
assert.match(serverSource, /pathname === '\/api\/github\/write\/prepare'/);
assert.match(serverSource, /pathname === '\/api\/github\/write\/execute'/);

const allowedToolsCall = serverSource.match(/getAllowedNvidiaTools\(agent, \{([\s\S]*?)\}\);/);
assert.ok(allowedToolsCall, 'agent tool allowlist wiring must remain visible');
assert.equal(
  /GITHUB_WRITE|githubWrite|writeRuntime|approvalToken/.test(allowedToolsCall[1]),
  false,
  'GitHub write runtime must not enter the model-visible tool allowlist context'
);

const executionCalls = [...serverSource.matchAll(/executeNvidiaToolCall\(agent, call, \{([\s\S]*?)\}\);/g)];
assert.equal(executionCalls.length, 1, 'production server should keep one centralized tool execution boundary');
assert.equal(
  /GITHUB_WRITE|githubWrite|writeRuntime|approvalToken/.test(executionCalls[0][1]),
  false,
  'GitHub write runtime must not enter agent tool execution context'
);
assert.match(executionCalls[0][1], /approvalGranted: false/);

assert.equal(
  /github\.write|repo\.write_branch|branch\.create/.test(toolRuntimeSource),
  false,
  'generic NVIDIA tool runtime must not silently register GitHub write operations'
);
assert.match(toolRuntimeSource, /github\.read_file/);

const publicDirectoryMentions = [...serverSource.matchAll(/GITHUB_WRITE_NODE_SERVER_RUNTIME/g)].length;
assert.equal(publicDirectoryMentions >= 3, true);
assert.equal(
  /HAFIZE_GITHUB_WRITE_(?:AUTH_TOKEN|APPROVAL_SECRET|OWNER_KEY)/.test(serverSource),
  false,
  'production composition must pass env by reference instead of copying write secrets into server constants'
);

console.log('GitHub write production tool isolation tests passed');
