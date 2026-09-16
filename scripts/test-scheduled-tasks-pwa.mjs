import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');

assert.match(index, /scheduled-tasks\.css/);
assert.match(index, /scheduled-tasks\.js/);
assert.match(index, /scheduled-tasks-enhancements\.js/);
// The panel is built on demand by the module, so the shell only has to load it.
assert.match(workspace, /PANEL_ID = 'scheduledTasksWorkspace'/);
assert.match(sw, /\/scheduled-tasks\.css/);
assert.match(sw, /\/scheduled-tasks\.js/);
assert.match(sw, /\/scheduled-tasks-enhancements\.js/);
assertVersionedCacheDeclaration(sw);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task PWA policy: ok');
