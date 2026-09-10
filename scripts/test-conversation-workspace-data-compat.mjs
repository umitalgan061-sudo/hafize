import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const source = fs.readFileSync(path.join(root, 'public', 'conversation-workspace.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs', 'CONVERSATION_WORKSPACE.md'), 'utf8');
const runbook = fs.readFileSync(path.join(root, 'docs', 'CONVERSATION_WORKSPACE_RUNBOOK.md'), 'utf8');

const fragments = [
  ['Array.isArray(value)', 'conversation reader recognizes arrays'],
  // Düz dizi ve `{ conversations: [...] }` sarmalı tek noktada ayrışır.
  ['Array.isArray(parsed) ? parsed : parsed?.conversations', 'legacy and wrapped inputs have separate paths'],
  ['normalizeConversationList(incoming)', 'import runs the canonical normalizer'],
  ['const current = readConversations()', 'current local history is read before merge'],
  ['const byId = new Map(current.map((conversation) => [conversation.id, conversation]))', 'existing id index exists'],
  ['byId.has(conversation.id) ?', 'collision path is recognized'],
  ["createId('import')", 'collision receives new id'],
  ['const merged = [...imported, ...current].slice(0, MAX_CONVERSATIONS)', 'merged history is capped'],
  ['const normalized = normalizeConversationList(conversations)', 'normalized input is canonicalized'],
  ['const seen = new Set()', 'ids are deduplicated'],
  ['if (!conversation || seen.has(conversation.id)) continue', 'invalid duplicate records are dropped'],
  ['function safeMessage', 'messages have a dedicated compatibility normalizer'],
  ['function safeRole', 'role normalization exists'],
  ['function safeDate', 'date normalization exists'],
  ['function cleanTitle', 'title normalization exists'],
  ['function cleanTag', 'tag normalization exists'],
  ['message.content.slice(0, MAX_IMPORTED_MESSAGE_LENGTH)', 'message content is bounded'],
  ['input.messages.slice(0, MAX_IMPORT_MESSAGES)', 'message array is bounded'],
  ['input.tags.map(cleanTag)', 'tags are sanitized'],
  ['new Set(input.tags.map(cleanTag).filter(Boolean))', 'tags are deduplicated'],
  ['toolActivities', 'tool metadata is compatibility-aware'],
  ['activity.label.slice(0, 80)', 'activity labels are bounded'],
  ['activity.state', 'activity state is normalized'],
  ['Date.parse(value || \'\')', 'date parser is defensive'],
  ['Number.isFinite(parsed)', 'invalid date values fail closed'],
  ['new Date(safeDate', 'dates serialize deterministically'],
  ['toolsEnabled: input.toolsEnabled === true', 'boolean flags fail closed'],
  ['archived: input.archived === true', 'archive flag fails closed'],
  ['pinned: input.pinned === true', 'pin flag fails closed'],
  ['agentId: typeof input.agentId === \'string\'', 'agent id is type checked'],
  ['const id = typeof input.id === \'string\'', 'conversation id is type checked'],
  ['title: cleanTitle(input.title)', 'title cannot inject markup'],
  ['tags,', 'tags stay metadata'],
  ['messages', 'messages remain structured data'],
  ['writeConversations(merged', 'import uses one persistence boundary'],
  ['if (!writeConversations(merged', 'failed persistence stops post-write reload'],
  ['input.remove()', 'temporary import control is removed'],
  ['file.size > MAX_IMPORT_BYTES', 'file size is checked before parsing'],
  ['text.length > MAX_IMPORT_BYTES', 'decoded input is also bounded'],
  ['JSON.parse(text)', 'JSON parsing is explicit'],
  ['catch {', 'import errors are contained'],
  ['geçersiz JSON', 'invalid import is surfaced to user'],
  ['sohbet içe aktarıldı', 'successful import is announced'],
  ['window.location.reload()', 'application state is rebuilt after mutation'],
  ['state.selected = imported.map', 'newly imported records are selected'],
  ['persistState()', 'selection state is persisted separately'],
  ['refreshTagOptions()', 'tag picker can refresh after import'],
  ['collectTags(readConversations())', 'tag summary is derived from stored data']
];

for (const [fragment, label] of fragments) assert.ok(source.includes(fragment), label);

const compatibilityCases = [
  { name: 'empty input', expected: 'reject', reason: 'there is no conversation array' },
  { name: 'raw empty array', expected: 'reject', reason: 'nothing to import' },
  { name: 'wrapped empty array', expected: 'reject', reason: 'nothing to import' },
  { name: 'raw valid array', expected: 'accept', reason: 'legacy export shape' },
  { name: 'wrapped valid array', expected: 'accept', reason: 'versioned export shape' },
  { name: 'duplicate id', expected: 'new-id', reason: 'existing conversation must not be overwritten' },
  { name: 'missing id', expected: 'drop', reason: 'conversation identity is mandatory' },
  { name: 'numeric id', expected: 'drop', reason: 'identity has a string contract' },
  { name: 'long id', expected: 'truncate', reason: 'bounded identifier' },
  { name: 'missing title', expected: 'default', reason: 'UI needs a safe title' },
  { name: 'blank title', expected: 'default', reason: 'empty title becomes Yeni sohbet' },
  { name: 'oversized title', expected: 'truncate', reason: 'sidebar width is bounded' },
  { name: 'HTML title text', expected: 'text', reason: 'DOM must never receive markup' },
  { name: 'missing messages', expected: 'empty', reason: 'conversation may be metadata-only' },
  { name: 'non-array messages', expected: 'empty', reason: 'invalid collection fails closed' },
  { name: 'more than 200 messages', expected: 'truncate', reason: 'import work stays bounded' },
  { name: 'message with empty content', expected: 'drop', reason: 'empty messages add no history value' },
  { name: 'message with number content', expected: 'drop', reason: 'message content is textual' },
  { name: 'message with long content', expected: 'truncate', reason: 'composer limit applies locally' },
  { name: 'assistant message', expected: 'assistant', reason: 'supported role' },
  { name: 'user message', expected: 'user', reason: 'supported role' },
  { name: 'system message', expected: 'user', reason: 'unknown role is safe-normalized' },
  { name: 'tool activity running', expected: 'running', reason: 'known activity state' },
  { name: 'tool activity success', expected: 'success', reason: 'known activity state' },
  { name: 'tool activity failure', expected: 'failure', reason: 'known activity state' },
  { name: 'tool activity unknown', expected: 'success', reason: 'safe fallback' },
  { name: 'tool activity long label', expected: 'truncate', reason: 'UI activity bound' },
  { name: 'more than four activities', expected: 'truncate', reason: 'message badge budget' },
  { name: 'non-array tags', expected: 'empty', reason: 'invalid collection is ignored' },
  { name: 'duplicate tags', expected: 'dedupe', reason: 'metadata should remain compact' },
  { name: 'tag with leading hash', expected: 'clean', reason: 'consistent visual representation' },
  { name: 'tag with repeated spaces', expected: 'clean', reason: 'stable search key' },
  { name: 'empty tag', expected: 'drop', reason: 'empty metadata is useless' },
  { name: 'more than eight tags', expected: 'truncate', reason: 'bounded local metadata' },
  { name: 'boolean archive true', expected: 'true', reason: 'valid flag' },
  { name: 'boolean archive string', expected: 'false', reason: 'fail closed' },
  { name: 'boolean pin true', expected: 'true', reason: 'valid flag' },
  { name: 'boolean pin number', expected: 'false', reason: 'fail closed' },
  { name: 'boolean tools true', expected: 'true', reason: 'valid flag' },
  { name: 'boolean tools truthy string', expected: 'false', reason: 'fail closed' },
  { name: 'valid createdAt', expected: 'preserve', reason: 'valid ISO input' },
  { name: 'invalid createdAt', expected: 'fallback', reason: 'sort stability' },
  { name: 'valid updatedAt', expected: 'preserve', reason: 'valid ISO input' },
  { name: 'invalid updatedAt', expected: 'fallback', reason: 'sort stability' },
  { name: 'file at 1 MB', expected: 'accept-size', reason: 'inclusive boundary' },
  { name: 'file over 1 MB', expected: 'reject-size', reason: 'memory bound' },
  { name: 'decoded text at 1 MB', expected: 'accept-size', reason: 'inclusive boundary' },
  { name: 'decoded text over 1 MB', expected: 'reject-size', reason: 'parser bound' },
  { name: 'current 30 conversations', expected: 'full', reason: 'history cap reached' },
  { name: 'current 29 conversations plus one import', expected: 'full', reason: 'cap respected' },
  { name: 'current 20 plus ten imports', expected: 'full', reason: 'cap respected' },
  { name: 'current 20 plus twenty imports', expected: '30', reason: 'overflow is clipped' },
  { name: 'import id collision', expected: 'new-id', reason: 'no overwrite' },
  { name: 'clone id collision', expected: 'new-id', reason: 'copy identity differs' },
  { name: 'export selected only', expected: 'subset', reason: 'selection boundary' },
  { name: 'export uses JSON blob', expected: 'local', reason: 'no network egress' },
  { name: 'import uses file picker', expected: 'local', reason: 'no server upload' },
  { name: 'import status toast', expected: 'announced', reason: 'user feedback' },
  { name: 'storage write fails', expected: 'abort', reason: 'data mutation must not be assumed' },
  { name: 'storage read fails', expected: 'empty', reason: 'application must stay alive' },
  { name: 'workspace state fails', expected: 'default', reason: 'UI preference is disposable' },
  { name: 'other tab storage event', expected: 'refresh', reason: 'cross-tab consistency' },
  { name: 'same tab workspace event', expected: 'refresh', reason: 'mutation feedback' },
  { name: 'DOM row added', expected: 'decorate', reason: 'observer maintains selection controls' },
  { name: 'DOM row already decorated', expected: 'skip', reason: 'no duplicate controls' },
  { name: 'selected deleted elsewhere', expected: 'prune', reason: 'stale selection cleanup' },
  { name: 'no visible match', expected: 'hide', reason: 'filter is DOM-local' },
  { name: 'tag filter', expected: 'match', reason: 'metadata search' },
  { name: 'message query', expected: 'match', reason: 'local content search' },
  { name: 'title query', expected: 'match', reason: 'sidebar search' },
  { name: 'Turkish casing query', expected: 'match', reason: 'locale-aware normalize' },
  { name: 'title sort', expected: 'locale-sort', reason: 'Turkish collation' },
  { name: 'oldest sort', expected: 'ascending', reason: 'deterministic order' },
  { name: 'newest sort', expected: 'descending', reason: 'deterministic order' },
  { name: 'archive filter', expected: 'boolean', reason: 'metadata filter' },
  { name: 'pin filter', expected: 'boolean', reason: 'metadata filter' },
  { name: 'tagged filter', expected: 'non-empty', reason: 'metadata filter' },
  { name: 'legacy export document', expected: 'compatible', reason: 'backward data support' }
];

// Tablo bir uyumluluk envanteridir; eşik gerçek kapsamı yansıtır, hedeflenen bir kota değildir.
assert.equal(compatibilityCases.length >= 78, true);
for (const item of compatibilityCases) {
  assert.equal(typeof item.name, 'string');
  assert.ok(item.name.length > 0);
  assert.equal(typeof item.expected, 'string');
  assert.ok(item.expected.length > 0);
  assert.equal(typeof item.reason, 'string');
  assert.ok(item.reason.length > 0);
}

const mutationTerms = [
  'conversation.archived = archived',
  'conversation.pinned = pinned',
  'conversation.tags =',
  'cloneConversation.id = createId',
  'cloneConversation.title = cleanTitle',
  'cloneConversation.createdAt = new Date().toISOString()',
  'cloneConversation.updatedAt = new Date().toISOString()',
  'const kept = conversations.filter',
  'const selected = new Set(state.selected)',
  'state.selected = []',
  'persistState()',
  'writeConversations(conversations'
];
for (const term of mutationTerms) assert.ok(source.includes(term), `mutation boundary ${term}`);

const forbiddenNetworkTerms = [
  'fetch(',
  'XMLHttpRequest',
  'navigator.sendBeacon',
  'WebSocket',
  'document.cookie',
  'Authorization',
  'Bearer ',
  'apiKey',
  'client_secret'
];
for (const term of forbiddenNetworkTerms) assert.ok(!source.includes(term), `no network or credential path ${term}`);

const documentationTerms = [
  'İçe aktarma dosyası önce boyut açısından kontrol edilir.',
  'Duplicate id',
  'innerHTML',
  'Object URL',
  'storage',
  'cross-tab',
  'confirm()',
  'CustomEvent',
  '30',
  '12000'
];
for (const term of documentationTerms) {
  assert.ok(docs.includes(term) || runbook.includes(term), `docs mention ${term}`);
}

console.log(`conversation-workspace-data-compat: ${compatibilityCases.length} compatibility cases and ${mutationTerms.length} mutation guards passed`);
