import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
assert.match(source,/MAX_SELECTION\s*=\s*40/);
assert.ok(source.includes('[...selectedIds].slice(0, MAX_SELECTION)'));
assert.ok(source.includes('selectedIds = new Set()'));
console.log('scheduled task bounded bulk mutation ok');
