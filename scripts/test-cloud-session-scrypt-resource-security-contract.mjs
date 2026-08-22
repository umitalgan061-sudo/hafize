import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const authSource = await readFile(new URL('../lib/cloud-session-auth.mjs', import.meta.url), 'utf8');
const serverSource = await readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

// Combined resource policy must be explicit and bounded in the auth module.
assert.match(authSource, /MAX_SCRYPT_MEMORY_BYTES\s*=\s*256\s*\*\s*1024\s*\*\s*1024/);
assert.match(authSource, /MAX_SCRYPT_WORK_UNITS\s*=\s*4\s*\*\s*1024\s*\*\s*1024/);
assert.match(authSource, /SCRYPT_MEMORY_OVERHEAD_BYTES\s*=\s*1024\s*\*\s*1024/);
assert.match(authSource, /const memoryBytes = 128 \* N \* r/);
assert.match(authSource, /const workUnits = N \* r \* p/);
assert.match(authSource, /maxmem > MAX_SCRYPT_MEMORY_BYTES \|\| workUnits > MAX_SCRYPT_WORK_UNITS/);
assert.match(authSource, /INVALID_CLOUD_SESSION_AUTH:passwordHash\.cost/);

// The validated maxmem must be the value passed to node:crypto, rather than recalculated
// from untrusted config inside the login path.
assert.match(authSource, /maxmem:\s*passwordConfig\.maxmem/);
assert.doesNotMatch(authSource, /maxmem:\s*Math\.max\([^\n]+passwordConfig\.N/);

// Cost validation occurs while parsing startup configuration, before login's async scrypt call.
const parseIndex = authSource.indexOf('function parsePasswordHash');
const costIndex = authSource.indexOf('validateScryptCost(N, r, p)', parseIndex);
const factoryIndex = authSource.indexOf('export function createCloudSessionAuth');
const loginIndex = authSource.indexOf('async function login', factoryIndex);
const scryptIndex = authSource.indexOf('await scrypt(', loginIndex);
assert.ok(parseIndex >= 0 && costIndex > parseIndex);
assert.ok(factoryIndex > costIndex);
assert.ok(loginIndex > factoryIndex && scryptIndex > loginIndex);

// Existing crypto and cookie hardening must remain intact.
for (const required of [
  'timingSafeEqual',
  'HttpOnly',
  'Secure',
  'SameSite=Strict',
  "createHmac('sha256'",
  'randomBytesImpl(18)'
]) {
  assert.ok(authSource.includes(required), `missing cloud-session security primitive: ${required}`);
}
assert.doesNotMatch(authSource, /console\.(log|debug|info)\s*\(/);
assert.doesNotMatch(authSource, /process\.env/);
assert.doesNotMatch(authSource, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
for (const forbidden of [
  /child_process/,
  /shell\s*:\s*true/,
  /(?<![.\w$])exec(?:File)?(?:Sync)?\s*\(/,
  /(?<![.\w$])spawn(?:Sync)?\s*\(/
]) {
  assert.doesNotMatch(authSource, forbidden);
}

// Server runtime still keeps secrets server-side and creates auth before exposing handlers.
assert.match(serverSource, /HAFIZE_CLOUD_SESSION_PASSWORD_HASH/);
assert.match(serverSource, /HAFIZE_CLOUD_SESSION_SIGNING_KEY/);
assert.match(serverSource, /const auth = createAuth\(/);
assert.doesNotMatch(serverSource, /sendJson\([^\n]*(passwordHash|signingKey)/);

// Selective four-agent architecture and backend least privilege remain unchanged.
assert.equal(registry.agents.length, 4);
assert.equal(registry.policy.externalWritesRequireApproval, true);
assert.equal(registry.policy.secretsNeverEnterAgentContext, true);
assert.equal(registry.policy.sharedTraceIdRequired, true);
assert.deepEqual(
  registry.agents.map((agent) => agent.id).sort(),
  ['growth-strategist', 'minimal-engineer', 'security-engineer', 'test-engineer'].sort()
);
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy.default, 'deny');
  assert.ok(!agent.toolPolicy.allow?.includes('secret.read'));
}

console.log('cloud session scrypt resource security contract: ok');
