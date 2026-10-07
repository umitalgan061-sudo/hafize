import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../public/typed/legacy/scheduled-task-preview.ts', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-task-preview.css', import.meta.url), 'utf8');

assert.match(js, /addEventListener\('submit', intercept, true\)/);
assert.match(js, /stopImmediatePropagation\(\)/);
assert.match(js, /requestSubmit\?\.\(\)|requestSubmit\(\)/);
assert.match(js, /data-preview-submit-bypass/);
assert.match(js, /role', 'dialog'/);
assert.match(js, /aria-modal/);
assert.match(js, /event\.key === 'Escape'/);
assert.match(js, /event\.key === 'Tab'/);
assert.match(js, /event\.key === 'Enter' && \(event\.ctrlKey \|\| event\.metaKey\)/);
assert.doesNotMatch(js, /root\.fetch/);
assert.doesNotMatch(js, /XMLHttpRequest/);
assert.doesNotMatch(js, /sendBeacon/);
assert.match(js, /Date\.parse\(data\.localWhen\)/);
assert.match(js, /Görev planlama önizlemesi/);
assert.match(css, /scheduled-task-preview-overlay/);
assert.match(css, /forced-colors/);
assert.match(css, /prefers-reduced-motion/);

console.log('scheduled-task-preview: ok');
