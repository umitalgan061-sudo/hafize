import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShellAssets, assertVersionedCacheDeclaration } from './shell-cache-contract.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../public/scheduled-tasks.js', import.meta.url), 'utf8');

assert.match(index, /scheduled-tasks\.css/);
assert.match(index, /scheduled-tasks\.js/);
assert.match(index, /scheduled-tasks-enhancements\.js/);

// The panel is built by the module rather than shipped in the markup, so the
// id contract belongs to the script.
assert.match(workspace, /PANEL_ID = 'scheduledTasksWorkspace'/);
assert.match(workspace, /panel\.id = PANEL_ID/);

assertShellAssets([
  '/scheduled-tasks.css',
  '/scheduled-tasks.js',
  '/scheduled-tasks-enhancements.js',
  '/scheduled-tasks-keyboard.js',
  '/typed-build/scheduled-tasks-countdown.js'
], 'scheduled tasks asset');
assertVersionedCacheDeclaration(sw);

// Schedule responses carry task content, so they stay off the shell cache.
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /network-only/);
console.log('scheduled task PWA policy: ok');
