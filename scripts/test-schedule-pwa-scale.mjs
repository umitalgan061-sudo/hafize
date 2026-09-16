import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/scheduled-tasks.css', import.meta.url), 'utf8');

assert.match(html, /scheduled-tasks\.js/);
assert.match(html, /scheduled-tasks-stats\.js/);
assert.match(html, /scheduled-tasks-enhancements\.js/);
assert.match(sw, /scheduled-tasks-stats\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v34`/);
assert.match(sw, /\/api\//);
assert.match(css, /scheduled-tasks-controls/);
assert.match(css, /scheduled-tasks-load-more/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /forced-colors/);

console.log('schedule PWA scale tests passed');
