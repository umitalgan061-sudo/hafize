import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const css=await readFile(new URL('../public/scheduled-tasks.css',import.meta.url),'utf8');
assert.ok(css.includes('@media (max-width:650px)'));
assert.ok(css.includes('.scheduled-tasks-form-actions>*{flex:1 1 140px}'));
assert.ok(css.includes('.scheduled-task-actions>*{flex:1 1 110px}'));
console.log('scheduled task mobile edit UX contract ok');
