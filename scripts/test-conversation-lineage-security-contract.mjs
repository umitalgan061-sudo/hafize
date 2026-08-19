import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/conversation-branch-lineage.js', import.meta.url), 'utf8');
const registry = JSON.parse(await readFile(new URL('../agents/registry.json', import.meta.url), 'utf8'));

for (const forbidden of [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'sendBeacon',
  'document.cookie',
  'sessionStorage',
  'indexedDB',
  'navigator.clipboard',
  'child_process',
  'shell=True',
  'exec(',
  'spawn('
]) {
  assert.equal(source.includes(forbidden), false, `lineage must not gain forbidden surface: ${forbidden}`);
}

for (const secretName of [
  'NVIDIA_API_KEY',
  'GITHUB_TOKEN',
  'GOOGLE_CLIENT_SECRET',
  'CANVA_CLIENT_SECRET',
  'HAFIZE_CLOUD_SESSION_SIGNING_KEY'
]) {
  assert.equal(source.includes(secretName), false, `lineage must not read secret: ${secretName}`);
}

assert.ok(source.includes("const MAX_ENTRIES = 60"), 'lineage persistence remains bounded');
assert.ok(source.includes("const MAX_DEPTH = 12"), 'ancestry traversal remains bounded');
assert.ok(source.includes("const MAX_STORAGE_CHARS = 64 * 1024"), 'raw lineage parsing remains bounded');
assert.ok(source.includes('sourceMessageExists'), 'source-retention guard remains wired');
assert.ok(source.includes('sessionRecorded'), 'cross-tab reconciliation remains session-only');
assert.ok(source.includes('sessionRecorded.clear()'), 'destroy clears session-only reconciliation state');

assert.equal(registry.agents.length, 4, 'selective roster remains exactly four profiles');
assert.equal(registry.routing?.denyByDefault, true, 'backend/tool routing remains default-deny');
assert.equal(registry.routing?.externalWritesRequireApproval, true, 'external writes still require explicit approval');
assert.equal(registry.routing?.secretsInAgentContext, false, 'secrets never enter agent context');

console.log('conversation lineage security contract: ok');
