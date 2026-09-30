import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('public/prompt-library-smart-views-safety.js','utf8');
assert.match(source,/function analyze/);
assert.match(source,/function normalizeRepair/);
assert.match(source,/function applyRepair/);
assert.match(source,/function undoRepair/);
assert.match(source,/CHECKPOINT_KEY/);
assert.match(source,/MAX_CHECKPOINT = 300000/);
assert.match(source,/new root\.CustomEvent/);
console.log('smart-view safety contract: ok');