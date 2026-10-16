import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-preview.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-preview.css', import.meta.url), 'utf8');

assert.match(js, /countdownText/);
assert.match(js, /T-/);
assert.match(js, /startCountdown/);
assert.match(js, /setInterval/);
assert.match(js, /clearInterval/);
assert.match(css, /scheduled-task-preview-countdown/);
console.log('scheduled-task-preview-countdown: ok');
