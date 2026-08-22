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
  /(?<![.\w$])exec(?:File)?(?:Sync)?\s*\(/,
  /(?<![.\w$])spawn(?:Sync)?\s*\(/,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/i,
  /document\.cookie/,
  /console\.log\([^)]*signingKey/i
]) {
  assert.doesNotMatch(changedSources, forbidden);
}

assert.equal(Array.isArray(registry.agents), true);
assert.equal(registry.agents.length, 4, 'rotation must not change the four-profile agent roster');
for (const agent of registry.agents) {
  assert.equal(agent.toolPolicy?.default, 'deny', `${agent.id} must remain default-deny`);
}
const selectors = registry.agents.filter((agent) => agent.kind === 'selector');
const specialists = registry.agents.filter((agent) => agent.kind === 'specialist');
assert.equal(selectors.length, 2);
assert.equal(specialists.length, 2);

const allTools = new Set(registry.agents.flatMap((agent) => agent.toolPolicy?.allow || []));
for (const forbiddenTool of ['repo.merge', 'external.send', 'external.write']) {
  assert.equal(allTools.has(forbiddenTool), false, `rotation must not allow ${forbiddenTool}`);
}

for (const source of [serverSource, privilegedSource, scheduleSource]) {
  assert.doesNotMatch(source, /sendJson\([^\n]*previousSigningKey/);
  assert.doesNotMatch(source, /body:\s*\{[^}]*previousSigningKey/s);
}

console.log('cloud session rotation security contract tests passed');
