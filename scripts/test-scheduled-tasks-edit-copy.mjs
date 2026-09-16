import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
assert.ok(source.includes('duplicateTask'));
assert.ok(source.includes("method:'POST'"));
assert.ok(source.includes('entry.task'));
assert.ok(source.includes('entry.agentId'));
assert.ok(source.includes('Görev yeni zamanla tekrar planlandı.'));
assert.ok(source.includes('localDateTimeValue(10)'));
console.log('scheduled task repeat-plan workflow contract ok');
