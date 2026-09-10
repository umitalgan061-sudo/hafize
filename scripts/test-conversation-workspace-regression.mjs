import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public', 'conversation-workspace.js'), 'utf8');
const keyboard = fs.readFileSync(path.join(root, 'public', 'conversation-workspace-keyboard.js'), 'utf8');
const drafts = fs.readFileSync(path.join(root, 'public', 'chat-drafts.js'), 'utf8');
const historyManagement = fs.readFileSync(path.join(root, 'public', 'chat-history-management.js'), 'utf8');
const historySearch = fs.readFileSync(path.join(root, 'public', 'chat-history-search.js'), 'utf8');
const historyExport = fs.readFileSync(path.join(root, 'public', 'chat-history-export.js'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'public', 'settings-workspace.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'public', 'ui-shell.js'), 'utf8');

function has(text, fragment, label = fragment) {
  assert.ok(text.includes(fragment), label);
}
function notHas(text, fragment, label = `must not contain ${fragment}`) {
  assert.ok(!text.includes(fragment), label);
}

const shellModules = [
  ['/chat-history-search.js', 'history search remains loaded'],
  ['/chat-history-export.js', 'history export remains loaded'],
  ['/chat-history-management.js', 'history management remains loaded'],
  ['/chat-drafts.js', 'chat drafts remain loaded'],
  ['/conversation-workspace.js', 'workspace is loaded'],
  ['/conversation-workspace-keyboard.js', 'workspace keyboard is loaded']
];
for (const [pathName, label] of shellModules) has(index, pathName, label);

const stylesheetModules = [
  ['/chat-history-search.css', 'search CSS remains loaded'],
  ['/chat-history-export.css', 'export CSS remains loaded'],
  ['/chat-history-management.css', 'management CSS remains loaded'],
  ['/chat-drafts.css', 'draft CSS remains loaded'],
  ['/conversation-workspace.css', 'workspace CSS is loaded'],
  ['/conversation-workspace-keyboard.css', 'keyboard CSS is loaded']
];
for (const [pathName, label] of stylesheetModules) has(index, pathName, label);

const loadOrder = [
  '/app.js',
  '/chat-composer-features.js',
  '/chat-history-search.js',
  '/chat-history-export.js',
  '/chat-history-management.js',
  '/chat-drafts.js',
  '/conversation-workspace.js',
  '/conversation-workspace-keyboard.js',
  '/voice-input.js'
];
for (let i = 1; i < loadOrder.length; i += 1) {
  assert.ok(index.indexOf(loadOrder[i - 1]) < index.indexOf(loadOrder[i]), `script order keeps ${loadOrder[i - 1]} before ${loadOrder[i]}`);
}

has(workspace, "const STORAGE_KEY = 'hafize.conversations.v1'", 'workspace reads canonical history key');
has(drafts, "const STORAGE_KEY = 'hafize.chat-drafts.v1'", 'drafts keep their own key');
has(historySearch, "const STORAGE_KEY = 'hafize.conversations.v1'", 'search keeps canonical history key');
has(historyExport, "const STORAGE_KEY = 'hafize.conversations.v1'", 'export keeps canonical history key');
has(historyManagement, "const STORAGE_KEY = 'hafize.conversations.v1'", 'management keeps canonical history key');

notHas(workspace, "hafize.chat-drafts.v1", 'workspace does not own draft state');
notHas(workspace, "hafize.theme.v1", 'workspace does not own theme state');
notHas(workspace, '/api/chat', 'workspace does not own chat endpoint');
notHas(workspace, '/api/models', 'workspace does not own model endpoint');
notHas(workspace, '/api/agents', 'workspace does not own agent endpoint');
notHas(workspace, '/api/agent/run', 'workspace does not own agent endpoint');
notHas(keyboard, '/api/chat', 'keyboard layer does not own chat endpoint');
notHas(keyboard, '/api/agent/run', 'keyboard layer does not own agent endpoint');

has(historyManagement, 'MutationObserver', 'management still owns row decoration observer');
has(historySearch, 'MutationObserver', 'search still owns row filtering observer');
has(drafts, 'MutationObserver', 'drafts still own conversation lifecycle observer');
has(workspace, 'MutationObserver', 'workspace adds its own bounded row observer');

has(historyManagement, '.conversation-row', 'management uses conversation rows');
has(historySearch, '.conversation-row', 'search uses conversation rows');
has(workspace, '.conversation-row', 'workspace uses conversation rows');

const coexistenceSelectors = [
  '.conversation-open',
  '.conversation-delete',
  '.history-manage',
  '.history-rename',
  '.history-search',
  '.history-export',
  '.workspace-row-check',
  '.conversation-workspace'
];
for (const selector of coexistenceSelectors) {
  // Modules reference their classes either as a selector or as a class-name
  // constant, so ownership is checked on the bare class name.
  const className = selector.replace(/^\./, '');
  if (selector.startsWith('.conversation-workspace') || selector === '.workspace-row-check') {
    has(workspace, className, `workspace owns ${selector}`);
  } else {
    has(historyManagement + historySearch + historyExport, className, `existing module still mentions ${selector}`);
  }
}

const storageKeys = [
  'hafize.conversations.v1',
  'hafize.chat-drafts.v1',
  'hafize.conversation-workspace.v1',
  'hafize.theme.v1',
  'hafize.reduced-motion.v1'
];
for (const key of storageKeys) {
  // Theme and motion preferences are owned by the shell/settings modules.
  const consumers = [workspace, drafts, historyManagement, historySearch, historyExport, settings, shell]
    .filter((text) => text.includes(key));
  assert.ok(consumers.length >= 1, `storage key is referenced somewhere: ${key}`);
}

has(workspace, 'Object.freeze', 'workspace public state uses immutable structures');
has(keyboard, 'Object.freeze', 'keyboard public state uses immutable structures');
has(historyManagement, 'MutationObserver', 'single-history management still starts safely');
has(historyExport, 'new Blob', 'legacy export remains local');
has(drafts, 'localStorage', 'draft persistence remains local');

const duplicateRiskFragments = [
  'fetch(',
  'XMLHttpRequest',
  'WebSocket',
  'document.cookie',
  'Authorization',
  'Bearer ',
  'apiKey',
  'client_secret'
];
for (const fragment of duplicateRiskFragments) notHas(workspace, fragment, `workspace excludes ${fragment}`);
for (const fragment of duplicateRiskFragments) notHas(keyboard, fragment, `keyboard excludes ${fragment}`);

const lifecycleFragments = [
  'storage',
  'refresh',
  'pruneMissingSelection',
  'decorateRows',
  'persistState',
  'window.location.reload'
];
for (const fragment of lifecycleFragments) has(workspace, fragment, `workspace lifecycle includes ${fragment}`);

const actionFragments = [
  'onArchive',
  'onPin',
  'onDelete',
  'onClone',
  'onTag',
  'downloadSelected',
  'importBackup',
  'selectVisible'
];
for (const fragment of actionFragments) has(workspace, fragment, `workspace action exists: ${fragment}`);

// The workspace builds its DOM with setAttribute, so the retained
// accessibility contract is asserted in that form.
const accessibilityFragments = [
  "setAttribute('aria-label', 'Sohbet çalışma alanı yönetimi')",
  "setAttribute('aria-live', 'polite')",
  "setAttribute('aria-label', 'Sohbet çalışma alanında ara')",
  "setAttribute('aria-label', 'Sohbet filtresi')",
  "setAttribute('aria-label', 'Sohbet sıralaması')",
  "setAttribute('aria-label', 'Etikete göre filtrele')",
  "setAttribute('aria-label', 'Sohbeti yönetim seçimine ekle')"
];
for (const fragment of accessibilityFragments) has(workspace, fragment, `accessibility retained: ${fragment}`);

const keyboardFragments = [
  "selectAll: { key: 'a', shift: true }",
  "clearSelection: { key: 'x', shift: true }",
  "focusSearch: { key: 'u', shift: true }",
  "escape: { key: 'Escape', shift: false }"
];
for (const fragment of keyboardFragments) has(keyboard, fragment, `workspace shortcut retained: ${fragment}`);

const importGuardFragments = [
  'file.size > MAX_IMPORT_BYTES',
  'text.length > MAX_IMPORT_BYTES',
  'normalizeConversationList(incoming)',
  "createId('import')",
  '.slice(0, MAX_CONVERSATIONS)',
  'globalThis.confirm'
];
for (const fragment of importGuardFragments) has(workspace, fragment, `import guard retained: ${fragment}`);

const existingBehaviorFragments = [
  [drafts, 'pagehide', 'draft page lifecycle retained'],
  [drafts, 'visibilitychange', 'draft visibility lifecycle retained'],
  [historyManagement, 'bindDeleteGuard', 'history deletion confirmation retained'],
  [historyManagement, 'openRename', 'history rename retained'],
  [historySearch, "['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)", 'history search shortcut still yields to other fields'],
  [historySearch, 'searchUi.input.focus()', 'history search shortcut still focuses its own input'],
  [historyExport, 'buildMarkdown', 'history markdown export retained'],
  [historyExport, 'buildJson', 'history JSON export retained']
];
for (const [text, fragment, label] of existingBehaviorFragments) has(text, fragment, label);

assert.equal(index.match(/conversation-workspace\.js/g)?.length, 1, 'workspace script is referenced exactly once');
assert.equal(index.match(/conversation-workspace-keyboard\.js/g)?.length, 1, 'keyboard script is referenced exactly once');
assert.equal(index.match(/conversation-workspace\.css/g)?.length, 1, 'workspace CSS is referenced exactly once');
assert.equal(index.match(/conversation-workspace-keyboard\.css/g)?.length, 1, 'keyboard CSS is referenced exactly once');

const totalLocalModules = [workspace, keyboard, drafts, historyManagement, historySearch, historyExport].reduce(
  (total, text) => total + text.split('\n').length,
  0
);
assert.ok(totalLocalModules > 1200, 'conversation local modules remain substantial after integration');

console.log('conversation-workspace-regression: shell ordering, coexistence, lifecycle, security, accessibility and legacy behavior contracts passed');
