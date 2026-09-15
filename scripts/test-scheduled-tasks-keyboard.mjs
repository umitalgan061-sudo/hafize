import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/scheduled-tasks-keyboard.js', import.meta.url), 'utf8');
assert.match(source, /ctrlKey \|\| event\.metaKey/);
assert.match(source, /event\.shiftKey/);
assert.match(source, /event\.key\.toLowerCase\(\) !== 't'/);
assert.match(source, /input,textarea,select/);
assert.match(source, /ScheduledTasksWorkspace/);
assert.match(source, /preventDefault\(\)/);
assert.match(source, /beforeunload/);
console.log('scheduled task keyboard shortcut: ok');
