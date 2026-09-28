import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-duplicate.js', import.meta.url), 'utf8');
const typed = await readFile(new URL('../public/typed/scheduled-tasks.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-duplicate.css', import.meta.url), 'utf8');

assert.match(js, /ScheduledTaskDuplicate/);
assert.match(js, /ScheduledTasksWorkspace\.open/);
assert.match(js, /ScheduledTaskPreview/);
assert.match(js, /data-scheduled-duplicate/);
assert.match(js, /data-agent-id/);
assert.match(js, /data-max-attempts/);
assert.match(js, /5 \* 60 \* 1000/);
assert.doesNotMatch(js, /fetch\(/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.match(typed, /dataset\.agentId/);
assert.match(typed, /dataset\.maxAttempts/);
assert.match(css, /scheduled-task-duplicate-button/);
console.log('scheduled-task-duplicate: ok');
