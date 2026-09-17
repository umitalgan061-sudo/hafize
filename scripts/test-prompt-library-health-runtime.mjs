import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleUrl = `file://${path.join(root, 'public', 'prompt-library-health.js')}?runtime=${Date.now()}`;
await import(moduleUrl);

const api = globalThis.HafizePromptLibraryHealth;
assert.equal(typeof api.diagnose, 'function');
assert.equal(typeof api.repair, 'function');
assert.equal(typeof api.exportReport, 'function');
assert.equal(typeof api.mount, 'function');
assert.equal(typeof api.similarity, 'function');
assert.equal(api.PROMPT_KEY, 'hafize.prompt-library.v1');
assert.equal(api.COLLECTION_KEY, 'hafize.prompt-library.collections.v1');
assert.equal(api.REVISION_KEY, 'hafize.prompt-library.revisions.v1');
assert.equal(api.HEALTH_STATE_KEY, 'hafize.prompt-library.health.v1');
console.log('prompt library health runtime: ok');
