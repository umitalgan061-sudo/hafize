import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../lib/cloud-session-revocable-auth.mjs', import.meta.url), 'utf8');
const httpSource = await readFile(new URL('../lib/cloud-session-http-api.mjs', import.meta.url), 'utf8');
const nodeSource = await readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(authSource, /createHmac\('sha256'/);
assert.match(authSource, /hafize-session-revocation-v1/);
assert.match(authSource, /DEFAULT_MAX_REVOCATIONS = 4096/);
assert.match(authSource, /expiresAt <= current/);
assert.match(authSource, /SESSION_REVOCATION_UNAVAILABLE/);
assert.match(authSource, /store\.isRevoked\(fingerprint\)/);
assert.match(authSource, /store\.revoke\(\{ fingerprint, expiresAt: current\.expiresAt \}\)/);

// The store is fingerprint -> expiry only. It must not retain raw cookie/token values.
assert.doesNotMatch(authSource, /revoked\.set\([^,]+,\s*token\b/);
assert.doesNotMatch(authSource, /revoked\.set\([^,]+,\s*headers\b/);
assert.doesNotMatch(authSource, /revoked\.set\([^,]+,\s*cookie\b/);
assert.doesNotMatch(authSource, /JSON\.stringify\([^)]*token/);
assert.doesNotMatch(authSource, /console\.(?:log|info|warn|error)\s*\(/);

// Revocation must happen before the clearing cookie is returned.
const revokeIndex = httpSource.indexOf("auth.revoke({ headers })");
const logoutCookieIndex = httpSource.indexOf("'set-cookie': auth.logoutCookie()");
assert.ok(revokeIndex >= 0 && logoutCookieIndex > revokeIndex);
assert.match(httpSource, /SESSION_REVOCATION_UNAVAILABLE/);
assert.match(httpSource, /return response\(503, \{ authenticated: true, error: 'SESSION_REVOCATION_UNAVAILABLE' \}\)/);
assert.match(httpSource, /requireSameOrigin\(headers\)/);

// Production node runtime uses revocable auth by default, not an opt-in prompt convention.
assert.match(nodeSource, /createAuth = createRevocableCloudSessionAuth/);
assert.match(nodeSource, /typeof auth\?\.revoke !== 'function'/);
assert.doesNotMatch(nodeSource, /X-Forwarded-For/i);

// No new external execution or client-side persistence surface is introduced.
for (const source of [authSource, httpSource, nodeSource]) {
  assert.doesNotMatch(source, /child_process|execSync|spawnSync|shell\s*:\s*true/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|clipboard/i);
  assert.doesNotMatch(source, /GITHUB_TOKEN|NVIDIA_API_KEY|CANVA_.*TOKEN|GOOGLE_.*SECRET/);
}

// Selective agency architecture remains exactly four profiles and default-deny.
assert.equal(registry.agents.length, 4);
assert.equal(registry.security?.denyByDefault, true);
const modes = registry.agents.map((agent) => agent.mode).sort();
assert.deepEqual(modes, ['selector', 'selector', 'specialist', 'specialist']);
for (const agent of registry.agents) {
  assert.ok(Array.isArray(agent.tools));
  assert.ok(Array.isArray(agent.approvals));
}

console.log('cloud session revocation security contract tests passed');
