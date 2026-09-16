import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
for(const token of ['MAX_SELECTION = 40','toggleSelection','bulkPostpone','bulkCancel','bulk-postpone-15','bulk-postpone-60','bulk-cancel','Seçilenleri iptal et']) assert.ok(source.includes(token),`missing bulk token ${token}`);
assert.ok(source.includes('selectedIds.clear()'));
console.log('scheduled task bulk action contract ok');
