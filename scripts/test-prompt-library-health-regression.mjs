import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const health = await read('public/prompt-library-health.js');
const extra = await read('public/prompt-library-health-enhancements.js');
const css = await read('public/prompt-library-health.css');
const index = await read('public/index.html');
const sw = await read('public/sw-policy.js');

assert.equal((health.match(/function inspectPrompts/g) || []).length, 1);
assert.equal((health.match(/function inspectCollections/g) || []).length, 1);
assert.equal((health.match(/function inspectRevisions/g) || []).length, 1);
assert.equal((health.match(/function diagnose/g) || []).length, 1);
assert.equal((health.match(/function repair/g) || []).length, 1);
assert.equal((health.match(/function mount/g) || []).length, 1);
assert.match(health, /issueCounts: counts/);
assert.match(health, /healthy: health/);
assert.match(health, /issues: issues\.slice\(0, MAX_ISSUES\)/);
assert.match(extra, /function problematicPrompts/);
assert.match(extra, /function reportPayload/);
assert.match(extra, /function appendControls/);
assert.match(css, /prompt-library-health-extra-actions/);
assert.match(index, /prompt-library-health\.js/);
assert.match(index, /prompt-library-health-enhancements\.js/);
assert.match(sw, /prompt-library-health\.js/);
assert.match(sw, /prompt-library-health-enhancements\.js/);
assert.match(sw, /v38/);

console.log('prompt library health regression: ok');
