import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const fn=source.indexOf('function buildRepairPreview');
const apply=source.indexOf('function applySafeRepair');
assert.ok(fn>=0 && apply>fn);
assert.doesNotMatch(source.slice(fn,apply),/setItem/);
console.log('prompt-library-repair-preview-no-write: ok');
