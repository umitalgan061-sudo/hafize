import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/scheduled-task-preview.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-preview.css', import.meta.url), 'utf8');

for (const token of ['role', 'aria-modal', 'aria-labelledby', 'aria-describedby', 'trapFocus', 'previousFocus']) assert.match(js, new RegExp(token));
assert.match(js, /event\.key === 'Escape'/);
assert.match(js, /event\.key === 'Tab'/);
assert.match(js, /event\.key === 'Enter'/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
console.log('scheduled-task-preview-a11y: ok');
