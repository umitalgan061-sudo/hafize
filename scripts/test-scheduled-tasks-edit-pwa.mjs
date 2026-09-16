import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.ok(index.includes('/scheduled-tasks.css'));
assert.ok(index.includes('/scheduled-tasks.js'));
assert.ok(sw.includes("'/scheduled-tasks.css'"));
assert.ok(sw.includes("'/scheduled-tasks.js'"));
assert.ok(!sw.includes("'/api/schedules'"));
console.log('scheduled task edit PWA contract ok');
