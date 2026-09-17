import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

const index = await read('public/index.html');
const sw = await read('public/sw-policy.js');
const rules = await read('HAFIZE_RULES.md');
const readme = await read('README.md');
const health = await read('public/prompt-library-health.js');
const extra = await read('public/prompt-library-health-enhancements.js');

assert.match(rules, /3000\+ anlamlı değişiklik/);
assert.match(index, /prompt-library-health\.css/);
assert.match(index, /prompt-library-health\.js/);
assert.match(index, /prompt-library-health-enhancements\.js/);
assert.match(sw, /v38/);
assert.match(sw, /prompt-library-health\.css/);
assert.match(sw, /prompt-library-health-enhancements\.js/);
assert.match(readme, /Kütüphane Kalite Merkezi|kalite merkezi/i);
assert.match(health, /HafizePromptLibraryHealth/);
assert.match(extra, /HafizePromptLibraryHealthEnhancements/);
assert.match(extra, /downloadReport/);
assert.match(extra, /downloadProblems/);
console.log('prompt library health release: ok');
