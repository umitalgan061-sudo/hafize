import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(index, /scheduled-tasks\.css/);
assert.match(index, /scheduled-tasks\.js/);
assert.match(index, /scheduled-tasks-enhancements\.js/);
assert.match(index, /id="scheduledTasksWorkspace"|scheduledTasksWorkspace/);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v3[0-9]+`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task PWA policy: ok');
