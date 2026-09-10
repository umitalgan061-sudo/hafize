import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public/message-workspace.js'), 'utf8');

const requiredFunctions = [
  'loadRecords',
  'saveRecords',
  'loadState',
  'saveState',
  'findRecord',
  'findRecordOrCreate',
  'ensureActionBar',
  'updateActionState',
  'decorateArticle',
  'decorateAll',
  'mutateRecord',
  'toggleSaved',
  'setFeedback',
  'editNote',
  'editTags',
  'openMessageMenu',
  'recordEntries',
  'matchesRecord',
  'sortEntries',
  'buildPanel',
  'renderResults',
  'focusMessage',
  'removeRecord',
  'exportSelected',
  'handleShortcut',
  'onStorage',
  'setupObserver',
  'init'
];

for (const functionName of requiredFunctions) {
  assert.match(source, new RegExp(`function ${functionName}\\(`), `missing function ${functionName}`);
}

const selectors = [
  '#messages',
  '#toast',
  '.conversation-row.active .conversation-open',
  '.message[data-message-id]',
  '.content',
  '#messageWorkspacePanel'
];
for (const selector of selectors) assert.ok(source.includes(selector), `missing selector: ${selector}`);

const actions = [
  'message-save',
  'message-feedback-up',
  'message-feedback-down',
  'message-note',
  'message-tag',
  'message-more'
];
for (const action of actions) assert.ok(source.includes(action));

const ariaContracts = [
  'aria-label',
  'aria-pressed',
  'aria-live',
  'role\',\'status\''
];
for (const token of ariaContracts) assert.ok(source.includes(token), `missing accessibility contract: ${token}`);

assert.equal((source.match(/localStorage/g) || []).length >= 4, true);
assert.equal((source.match(/CustomEvent/g) || []).length >= 1, true);
assert.equal((source.match(/MutationObserver/g) || []).length >= 1, true);
assert.equal((source.match(/setTimeout/g) || []).length >= 2, true);
assert.equal((source.match(/setInterval/g) || []).length >= 1, true);

const boundedCalls = [
  'slice(0, MAX_RECORDS)',
  'slice(0, MAX_EXPORT)',
  'slice(0, MAX_QUERY)',
  'slice(0, MAX_TAGS)',
  'slice(0,12000)'
];
for (const token of boundedCalls) assert.ok(source.includes(token), `missing bound: ${token}`);

// Kod-şekli iddiaları biçimlendirme boşluklarına duyarlı olmamalıdır.
const compactSource = source.replace(/\s+/g, '');
const hasSource = (needle) => compactSource.includes(needle.replace(/\s+/g, ''));
assert.ok(hasSource('record.saved || record.feedback || record.note || record.tags.length'));
assert.ok(hasSource('pruneEmptyRecord'));
assert.ok(hasSource('runtime.records = runtime.records.filter'));
assert.ok(hasSource('runtime.state.selected = runtime.state.selected.filter'));
assert.ok(hasSource('new Set(runtime.state.selected)'));

assert.ok(hasSource('new Blob'));
assert.ok(hasSource('URL.createObjectURL'));
assert.ok(hasSource('URL.revokeObjectURL'));
assert.ok(hasSource('application/json'));
assert.ok(hasSource('download=`hafize-messages-'));

assert.ok(hasSource('article.scrollIntoView'));
assert.ok(hasSource('message-workspace-focus'));
assert.ok(hasSource('scrollIntoView({ behavior:\'smooth\', block:\'center\' })'));

assert.ok(hasSource('window.clearTimeout(runtime.refreshTimer)'));
assert.ok(hasSource('runtime.refreshTimer=window.setTimeout'));
assert.ok(hasSource('runtime.observer.observe(ui.messages'));

const listenerContracts = [
  "window.addEventListener('storage'",
  "window.addEventListener(STORAGE_EVENT",
  "window.addEventListener('hafize:conversation-workspace-changed'",
  "document.addEventListener('keydown'"
];
for (const token of listenerContracts) assert.ok(source.includes(token));

for (const forbidden of ['navigator.clipboard.writeText', 'navigator.clipboard.write', 'location.href =', 'window.open(', 'sendBeacon(']) {
  assert.equal(source.includes(forbidden), false, `unexpected side effect: ${forbidden}`);
}

const panelLabels = [
  'Mesaj çalışma alanı',
  'Kayıtlı mesajlarda ara…',
  'Tümü',
  'Kaydedilen',
  'Geri bildirimli',
  'Notlu',
  'Senin mesajların',
  'Hafize yanıtları',
  'Etiketli',
  'Güncellenen',
  'Etkileşimli',
  'JSON dışa aktar'
];
for (const label of panelLabels) assert.ok(source.includes(label), `missing UI text: ${label}`);

console.log('message workspace runtime boundary tests passed');
