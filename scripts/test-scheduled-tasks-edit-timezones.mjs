import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../public/scheduled-tasks.js',import.meta.url),'utf8');
assert.ok(source.includes('toISOString()'));
assert.ok(source.includes("type = 'datetime-local'"));
assert.ok(source.includes('localInputFromIso'));
assert.ok(source.includes('Date.parse(runAt) <= Date.now()'));
console.log('scheduled task edit time conversion contract ok');
