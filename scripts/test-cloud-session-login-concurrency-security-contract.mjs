import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../lib/cloud-session-auth.mjs', import.meta.url), 'utf8');
const httpSource = await readFile(new URL('../lib/cloud-session-http-api.mjs', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8');
const gateSource = await readFile(new URL('../lib/cloud-session-login-concurrency.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

assert.match(authSource, /Path=\/; Max-Age=\$\{maxAgeSeconds\}; HttpOnly; Secure; SameSite=Strict/);
assert.match(authSource, /CLOUD_SESSION_TOKEN_CONTRACT\.cookieName/);
assert.equal(authSource.includes('SameSite=None'), false);
assert.equal(authSource.includes('Domain='), false, '__Host- cookie must remain host-only');

assert.match(httpSource, /requireSameOrigin\(headers\)/);
assert.match(httpSource, /SESSION_AUTH_BUSY/);
assert.match(httpSource, /countFailure: countFailure !== false/);
assert.match(serverSource, /request\?\.socket\?\.remoteAddress/);
assert.equal(/x-forwarded-for/i.test(serverSource), false, 'client-controlled forwarding header must not become peer identity');
assert.match(serverSource, /defaultLoginConcurrency: DEFAULT_LOGIN_CONCURRENCY/);
assert.match(serverSource, /maxLoginConcurrency: CLOUD_SESSION_LOGIN_CONCURRENCY_LIMITS\.maxConcurrent/);

for (const source of [gateSource, httpSource, serverSource]) {
  assert.equal(/child_process|execSync|spawnSync|shell\s*:\s*true/.test(source), false);
  assert.equal(/localStorage|sessionStorage|indexedDB/.test(source), false);
  assert.equal(/GITHUB_TOKEN|NVIDIA_API_KEY|GOOGLE_CLIENT_SECRET|CANVA_CLIENT_SECRET/.test(source), false);
}
assert.equal(/setTimeout|setInterval/.test(gateSource), false, 'global admission is fail-fast, not an unbounded queue');
assert.equal(/Promise|queue|wait/i.test(gateSource), false, 'gate must not accumulate waiting login work');

assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
assert.equal(registry.agents.length, 4);
assert.deepEqual(registry.agents.map((agent) => agent.id).sort(), [
  'agency-code-reviewer',
  'handyman-advisor',
  'minimal-engineer',
  'movie-coordinator'
]);
for (const agent of registry.agents) assert.equal(agent.toolPolicy.default, 'deny');

process.stdout.write('cloud session login concurrency security contract tests passed\n');
