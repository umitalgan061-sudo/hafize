import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  privilegedSource,
  scheduleSessionSource,
  scheduleHttpSource,
  revocationSource,
  githubRuntimeSource,
  githubNodeSource,
  registryText
] = await Promise.all([
  readFile(new URL('../lib/privileged-principal-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/schedule-session-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/schedule-http-api.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/cloud-session-revocable-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/github-write-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/github-write-node-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);

// Privileged cookie fallback must use revocable auth and exact configured Origin.
assert.match(privilegedSource, /createRevocableCloudSessionAuth/);
assert.doesNotMatch(privilegedSource, /import \{ createCloudSessionAuth \} from/);
assert.match(privilegedSource, /requestOrigin\(headers\) !== cloud\.origin/);
assert.match(privilegedSource, /if \(bearer\)[\s\S]*bearer\.authenticate/);
assert.match(privilegedSource, /cloudSessionAuthenticator/);

// Schedule mutations distinguish browser cookie authority from bearer automation authority.
assert.match(scheduleSessionSource, /createRevocableCloudSessionAuth/);
assert.match(scheduleSessionSource, /requireSessionOrigin/);
assert.match(scheduleSessionSource, /requestOrigin\(headers\) !== sessionAuthenticator\.allowedOrigin/);
assert.match(scheduleHttpSource, /requireSessionOrigin: verb === 'POST' \|\| verb === 'PATCH' \|\| verb === 'DELETE'/);
assert.doesNotMatch(scheduleHttpSource, /requireSessionOrigin: verb === 'GET'/);

// Production-default auth instances share only bounded process-local revocation fingerprints.
assert.match(revocationSource, /SHARED_PROCESS_REVOCATIONS/);
assert.match(revocationSource, /DEFAULT_MAX_REVOCATIONS = 4096/);
assert.match(revocationSource, /fingerprintCloudSessionToken/);
assert.match(revocationSource, /createHmac\('sha256'/);
assert.doesNotMatch(revocationSource, /localStorage|sessionStorage|indexedDB|document\.cookie/i);

// GitHub runtime supports injection of the canonical revocable authenticator without weakening approvals.
assert.match(githubRuntimeSource, /cloudSessionAuthenticator/);
assert.match(githubRuntimeSource, /createGitHubWriteApprovalBoundary/);
assert.match(githubRuntimeSource, /createGitHubWriteExecutionBoundary/);
assert.match(githubNodeSource, /cloudSessionAuthenticator/);
assert.doesNotMatch(githubRuntimeSource, /approvalGranted\s*:\s*true/);

// No prohibited general command execution or secret-file loading is introduced by this boundary.
for (const source of [privilegedSource, scheduleSessionSource, scheduleHttpSource, revocationSource]) {
  assert.doesNotMatch(source, /shell\s*[:=]\s*true|child_process|execSync|spawnSync|dotenv|['"`]\.env(?:\.[^'"`]+)?['"`]/);
  assert.doesNotMatch(source, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
}

const registry = JSON.parse(registryText);
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.denyByDefault, true);

console.log('privileged cloud session security contract tests passed');
