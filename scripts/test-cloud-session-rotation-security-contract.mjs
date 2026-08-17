import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [authSource, revocationSource, serverSource, privilegedSource, scheduleSource, registryText] = await Promise.all([
  readFile(new URL('../lib/cloud-session-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/cloud-session-revocable-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/cloud-session-node-server-runtime.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/privileged-principal-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../lib/schedule-session-auth.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../agents/registry.json', import.meta.url), 'utf8')
]);
const registry = JSON.parse(registryText);
const changedSources = [authSource, revocationSource, serverSource, privilegedSource, scheduleSource].join('\n');

assert.match(authSource, /maxVerificationSigningKeys:\s*2/);
assert.match(authSource, /previousSigningKey/);
assert.match(authSource, /signingKeySlot/);
assert.doesNotMatch(authSource, /previousSigningKeys|signingKeyRing|keyRing/i, 'rotation must remain a one-previous-key contract');

assert.match(serverSource, /HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY/);
assert.match(privilegedSource, /HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY/);
assert.match(scheduleSource, /HAFIZE_CLOUD_SESSION_PREVIOUS_SIGNING_KEY/);
assert.match(privilegedSource, /requestOrigin\(headers\) !== cloud\.origin/);
assert.match(scheduleSource, /requireSessionOrigin/);
assert.match(revocationSource, /FINGERPRINT_DOMAIN/);
assert.match(revocationSource, /signingKeySlot === 'previous'/);

for (const forbidden of [
  /shell\s*=\s*true/i,
  /child_process/,
  /exec\s*\(/,
  /spawn\s*\(/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /console\.log\([^)]*signingKey/i
]) {
  assert.doesNotMatch(changedSources, forbidden);
}

assert.equal(registry.denyByDefault, true);
assert.equal(Array.isArray(registry.agents), true);
assert.equal(registry.agents.length, 4, 'rotation must not change the four-profile agent roster');
const selectors = registry.agents.filter((agent) => agent.role === 'selector');
const specialists = registry.agents.filter((agent) => agent.role === 'specialist');
assert.equal(selectors.length, 2);
assert.equal(specialists.length, 2);

const allTools = registry.agents.flatMap((agent) => agent.allowedTools || []);
assert.equal(allTools.some((tool) => /merge|send|write/i.test(String(tool))), false, 'rotation must not expand agent external-write permissions');

for (const source of [serverSource, privilegedSource, scheduleSource]) {
  assert.doesNotMatch(source, /sendJson\([^\n]*previousSigningKey/);
  assert.doesNotMatch(source, /body:\s*\{[^}]*previousSigningKey/s);
}

console.log('cloud session rotation security contract tests passed');
