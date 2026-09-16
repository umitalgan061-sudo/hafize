import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
for (const token of ['postponeTask', 'postpone-15', 'postpone-60', 'Görev 15 dk ertelendi', 'Görev 60 dk ertelendi', "method: 'PATCH'"]) {
  assert.ok(source.includes(token), `missing postpone contract: ${token}`);
}
assert.ok(source.includes('Date.now() + minutes * 60_000'));
console.log('scheduled task quick postpone contract ok');
