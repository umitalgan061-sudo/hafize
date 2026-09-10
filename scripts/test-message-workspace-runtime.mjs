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
// One dispatch plus one listener, both bound to the same event constant.
assert.ok(source.includes('new CustomEvent(STORAGE_EVENT'));
assert.ok(source.includes('window.addEventListener(STORAGE_EVENT'));
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

assert.ok(source.includes('record.saved || record.feedback || record.note || record.tags.length'));
assert.ok(source.includes('pruneEmptyRecord'));
assert.match(source, /runtime\.records\s*=\s*runtime\.records\.filter/);
assert.match(source, /runtime\.state\.selected\s*=\s*runtime\.state\.selected\.filter/);
assert.ok(source.includes('new Set(runtime.state.selected)'));

assert.ok(source.includes('new Blob'));
assert.ok(source.includes('URL.createObjectURL'));
assert.ok(source.includes('URL.revokeObjectURL'));
assert.ok(source.includes('application/json'));
assert.ok(source.includes('download=`hafize-messages-'));

assert.ok(source.includes('article.scrollIntoView'));
assert.ok(source.includes('message-workspace-focus'));
assert.ok(source.includes('scrollIntoView({ behavior:\'smooth\', block:\'center\' })'));

assert.ok(source.includes('window.clearTimeout(runtime.refreshTimer)'));
assert.ok(source.includes('runtime.refreshTimer=window.setTimeout'));
assert.ok(source.includes('runtime.observer.observe(ui.messages'));

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
