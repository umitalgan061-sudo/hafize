import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const workspace = require('../public/workspace-navigation.js');
const shell = require('../public/ui-shell.js');
const sw = require('../public/sw-policy.js');
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN = 'https://hafize.example';

assert.deepEqual(workspace.WORKSPACES, ['chat', 'tasks', 'connections']);
assert.equal(Object.isFrozen(workspace.WORKSPACES), true);
assert.deepEqual(workspace.NAV_INDEX, { chat: 0, tasks: 1, connections: 2 });
assert.equal(Object.isFrozen(workspace.NAV_INDEX), true);
assert.equal(workspace.normalizeWorkspace('tasks'), 'tasks');
assert.equal(workspace.normalizeWorkspace('connections'), 'connections');
for (const unsafe of ['', 'settings', 'TASKS', null, {}, '__proto__']) {
  assert.equal(workspace.normalizeWorkspace(unsafe), 'chat');
}

assert.deepEqual(workspace.allowedCardIds('tasks'), ['scheduleRuntimeCard', 'scheduleListCard']);
assert.deepEqual(workspace.allowedCardIds('connections'), [
  'accountConnectionCard', 'canvaConnectionCard', 'githubWriteReadinessCard'
]);
assert.deepEqual(workspace.allowedCardIds('chat'), []);
assert.equal(workspace.isWorkspaceCard({ id: 'scheduleListCard' }, 'tasks'), true);
assert.equal(workspace.isWorkspaceCard({ id: 'accountConnectionCard' }, 'connections'), true);
for (const node of [
  { id: 'scheduleListCard-evil' },
  { id: 'memoryCard' },
  { id: 'voiceCard' },
  { id: '__proto__' },
  {},
  null
]) {
  assert.equal(workspace.isWorkspaceCard(node, 'tasks'), false);
}
assert.equal(workspace.workspaceCopy('chat'), null);
assert.equal(workspace.workspaceCopy('tasks')?.title, 'Görevler');
assert.match(workspace.workspaceCopy('connections')?.description || '', /Gmail.*Canva.*GitHub/);

assert.equal(shell.WORKSPACE_NAVIGATION_SCRIPT, '/workspace-navigation.js');
assert.equal(typeof shell.installWorkspaceNavigation, 'function');
assert.equal(sw.SHELL_ASSETS.includes('/workspace-navigation.js'), true);
assert.equal(sw.SHELL_ASSETS.includes('/workspace-navigation.css'), true);
for (const path of ['/workspace-navigation.js', '/workspace-navigation.css']) {
  assert.equal(sw.classifyRequest({ url: `${ORIGIN}${path}`, method: 'GET', mode: 'same-origin', headers: {} }, ORIGIN), 'shell');
}

const source = await readFile(join(ROOT, 'public', 'workspace-navigation.js'), 'utf8');
assert.doesNotMatch(source, /\bfetch\s*\(/, 'workspace navigation must not introduce network calls');
assert.doesNotMatch(source, /localStorage|sessionStorage/, 'workspace choice is intentionally not persisted silently');
assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|document\.write/, 'workspace navigation must not use HTML string injection');
assert.doesNotMatch(source, /\/api\//, 'workspace navigation must not own an API boundary');
assert.doesNotMatch(source, /tools?\.(allow|deny)|toolPolicy/, 'workspace presentation must not redefine backend tool permissions');
assert.match(source, /nav\.tasks\.disabled = false/);
assert.match(source, /nav\.connections\.disabled = false/);
assert.match(source, /isWorkspaceCard\(node, current\)/);

const indexSource = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
assert.match(indexSource, /<button class="nav-item" type="button" disabled>◷ Görevler<\/button>/);
assert.match(indexSource, /<button class="nav-item" type="button" disabled>⌘ Bağlantılar<\/button>/);

const cssSource = await readFile(join(ROOT, 'public', 'workspace-navigation.css'), 'utf8');
assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(cssSource, /@media \(forced-colors: active\)/);
assert.match(cssSource, /\.nav-item\[aria-current="page"\]/);

console.log('workspace navigation security OK: fail-closed activation, exact card allowlists, shell-only PWA assets and no new network/tool boundary');
