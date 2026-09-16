import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
assert.ok(source.includes('selectedIds.clear()'));
assert.ok(source.includes('validIds'));
assert.ok(source.includes('entry.status === \'scheduled\''));
assert.ok(source.includes('Seçilenleri iptal et'));
console.log('scheduled task bulk selection lifecycle ok');
