import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
assert.match(source,/MAX_SELECTION\s*=\s*40/);
assert.ok(source.includes('if (next.size >= MAX_SELECTION) return false;'));
assert.ok(source.includes('.slice(0, MAX_SELECTION)'));
console.log('scheduled task bulk selection limit ok');
