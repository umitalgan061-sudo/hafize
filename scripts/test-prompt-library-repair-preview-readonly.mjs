import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-safety.js','utf8');
const start=source.indexOf('function buildRepairPreview');
const end=source.indexOf('function createRepairCheckpoint');
assert.ok(start>=0 && end>start);
assert.doesNotMatch(source.slice(start,end),/setItem/);
assert.doesNotMatch(source.slice(start,end),/saveItems/);
console.log('prompt-library-repair-preview-readonly: ok');
