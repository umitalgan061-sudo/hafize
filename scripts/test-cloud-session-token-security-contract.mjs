import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tokenSource = await readFile(new URL('../lib/cloud-session-token-contract.mjs', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../lib/cloud-session-auth.mjs', import.meta.url), 'utf8');
const revocationSource = await readFile(new URL('../lib/cloud-session-revocable-auth.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(tokenSource, /MAX_COOKIE_HEADER_BYTES = 4096/);
assert.match(tokenSource, /MAX_TOKEN_BYTES = 2048/);
assert.match(tokenSource, /MAX_ENCODED_PAYLOAD_BYTES = 1024/);
assert.match(tokenSource, /PAYLOAD_KEYS = Object\.freeze\(\['v', 'sub', 'iat', 'exp', 'n'\]\)/);
assert.match(tokenSource, /NONCE_PATTERN = \/\^\[A-Za-z0-9_-\]\{24\}\$\//);
assert.match(tokenSource, /bytes\.toString\('base64url'\) !== encodedPayload/);
assert.match(tokenSource, /canonicalEncodedPayload\(payload\) !== encodedPayload/);
assert.match(tokenSource, /matches\.length !== 1/);

assert.match(authSource, /readCloudSessionCookieToken/);
assert.match(authSource, /splitCloudSessionToken/);
assert.match(authSource, /decodeCloudSessionPayload/);
assert.match(authSource, /encodeCloudSessionPayload/);
assert.doesNotMatch(authSource, /JSON\.parse\(Buffer\.from\(parts\[0\]/);
assert.doesNotMatch(authSource, /raw\.split\(';'/);

assert.match(revocationSource, /readCloudSessionCookieToken/);
assert.match(revocationSource, /CLOUD_SESSION_TOKEN_CONTRACT\.maxTokenBytes/);
assert.doesNotMatch(revocationSource, /function cookieHeader/);
assert.doesNotMatch(revocationSource, /\.split\('; '\)/);

for (const source of [tokenSource, authSource, revocationSource]) {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|navigator\.clipboard/i);
  assert.doesNotMatch(source, /child_process|execSync|spawnSync|shell\s*:\s*true/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
  assert.doesNotMatch(source, /GITHUB_TOKEN|GOOGLE_CLIENT_SECRET|CANVA_CLIENT_SECRET|NVIDIA_API_KEY/);
}

assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy.default, 'deny', `${agent.id} must remain default-deny`);
}

const minimal = registry.agents.find((agent) => agent.id === 'minimal-engineer');
assert.ok(minimal);
assert.ok(minimal.toolPolicy.deny.includes('repo.merge'));
assert.ok(minimal.toolPolicy.deny.includes('external.send'));
assert.ok(minimal.toolPolicy.deny.includes('external.write'));

console.log('cloud session token security contract tests passed');
