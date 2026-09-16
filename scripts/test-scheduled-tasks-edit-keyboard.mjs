import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const keyboard = await readFile(new URL('../public/scheduled-tasks-keyboard.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');
assert.ok(keyboard.includes("event.key.toLowerCase() !== 't'"));
assert.ok(keyboard.includes('event.target?.matches?.'));
assert.ok(workspace.includes("event.key === 'Escape'"));
assert.ok(workspace.includes("type = 'button'"));
assert.ok(workspace.includes('Düzenle'));
console.log('scheduled task edit keyboard contract ok');
