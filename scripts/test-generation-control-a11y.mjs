import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const control = await readFile(new URL('../public/typed/generation-control.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/generation-control.css', import.meta.url), 'utf8');

assert.match(control, /role', 'group'/);
assert.match(control, /role', 'status'/);
assert.match(control, /aria-live', 'polite'/);
assert.match(control, /aria-label', 'Devam eden Hafize yanıt üretimini durdur'/);
assert.match(control, /aria-controls', 'hafizeGenerationHistoryList'/);
assert.match(control, /event\.key\.toLowerCase\(\) !== 'x'/);
assert.match(control, /isEditingTarget/);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);
assert.match(css, /max-width:700px/);
console.log('generation-control accessibility: OK');
