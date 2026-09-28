import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-duplicate.js', import.meta.url), 'utf8');

for (const state of ['scheduled', 'completed', 'failed', 'cancelled']) assert.match(js, new RegExp(state));
assert.match(js, /status !== 'scheduled'/);
assert.match(js, /data-agent-id/);
assert.match(js, /data-max-attempts/);
assert.match(js, /data-run-at/);
console.log('scheduled-task-duplicate-states: ok');
