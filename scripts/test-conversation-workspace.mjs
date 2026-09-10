import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readShellCacheVersion } from './check-support.mjs';

const shellVersion = readShellCacheVersion();

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sourcePath = path.join(root, 'public', 'conversation-workspace.js');
const cssPath = path.join(root, 'public', 'conversation-workspace.css');
const indexPath = path.join(root, 'public', 'index.html');
const swPath = path.join(root, 'public', 'sw-policy.js');
const rulesPath = path.join(root, 'HAFIZE_RULES.md');

const source = fs.readFileSync(sourcePath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');
const rules = fs.readFileSync(rulesPath, 'utf8');

const checks = [];
function check(name, condition) {
  assert.equal(Boolean(condition), true, name);
  checks.push(name);
}
function includes(text, fragment, name = fragment) {
  check(name, text.includes(fragment));
}
function excludes(text, fragment, name = `must exclude ${fragment}`) {
  check(name, !text.includes(fragment));
}

check('workspace source is non-empty', source.length > 1000);
check('workspace stylesheet is non-empty', css.length > 500);
check('workspace has no import statements', !/^\s*import\s/m.test(source));
check('workspace has no eval', !/\beval\s*\(/.test(source));
check('workspace has no Function constructor', !/new\s+Function\s*\(/.test(source));
check('workspace uses strict mode', source.includes("'use strict'"));
check('workspace uses conversation storage key', source.includes("hafize.conversations.v1"));
check('workspace uses separate UI state key', source.includes("hafize.conversation-workspace.v1"));
check('workspace defines public event', source.includes("hafize:conversation-workspace-changed"));
check('workspace defines 30 conversation bound', source.includes('MAX_CONVERSATIONS = 30'));
check('workspace defines 80 title bound', source.includes('MAX_TITLE = 80'));
check('workspace defines 24 tag bound', source.includes('MAX_TAG = 24'));
check('workspace defines 8 tag bound', source.includes('MAX_TAGS = 8'));
check('workspace defines 1 MB import bound', source.includes('MAX_IMPORT_BYTES = 1024 * 1024'));
check('workspace limits import conversations', source.includes('MAX_IMPORT_CONVERSATIONS = 30'));
check('workspace limits imported messages', source.includes('MAX_IMPORT_MESSAGES = 200'));
check('workspace limits message length', source.includes('MAX_MESSAGE_LENGTH = 12000'));
check('workspace limits imported message length', source.includes('MAX_IMPORTED_MESSAGE_LENGTH = 12000'));
check('workspace defines valid sorts', source.includes("updated-desc") && source.includes("title-asc"));
check('workspace defines valid filters', source.includes("archived") && source.includes("pinned") && source.includes("tagged"));
check('workspace has immutable defaults', source.includes('Object.freeze({ filter:'));
check('workspace normalizes persisted state', source.includes('function normalizeState'));
check('workspace reads persisted state defensively', source.includes('function readWorkspace'));
check('workspace persists UI state defensively', source.includes('function writeWorkspace'));
check('workspace parses JSON inside try/catch', source.includes('JSON.parse(localStorage.getItem(WORKSPACE_KEY) ||'));
check('workspace reads conversations defensively', source.includes('function readConversations'));
check('workspace catches malformed conversation JSON', source.includes('catch {\n      return [];\n    }'));
check('workspace cleans titles', source.includes('function cleanTitle'));
check('workspace cleans tags', source.includes('function cleanTag'));
check('workspace has safe date parser', source.includes('function safeDate'));
check('workspace has safe role parser', source.includes('function safeRole'));
check('workspace validates imported messages', source.includes('function safeMessage'));
check('workspace validates imported conversations', source.includes('function normalizeConversation'));
check('workspace validates imported lists', source.includes('function normalizeConversationList'));
check('workspace limits message count per import', source.includes('slice(0, MAX_IMPORT_MESSAGES)'));
check('workspace limits tag count', source.includes('slice(0, MAX_TAGS)'));
check('workspace deduplicates imported ids', source.includes('const seen = new Set()'));
check('workspace deduplicates tags', source.includes('new Set(input.tags.map(cleanTag)'));
check('workspace truncates arbitrary titles', source.includes('slice(0, MAX_TITLE)'));
check('workspace truncates arbitrary tags', source.includes('slice(0, MAX_TAG)'));
check('workspace truncates arbitrary message content', source.includes('slice(0, MAX_IMPORTED_MESSAGE_LENGTH)'));
check('workspace accepts assistant messages only as assistant role', source.includes("value === 'assistant' ? 'assistant' : 'user'"));
check('workspace preserves tool activity in imported data', source.includes('toolActivities'));
check('workspace caps tool activities', source.includes('.slice(0, 4)'));
check('workspace whitelists tool activity states', source.includes("['running', 'success', 'failure']"));
check('workspace uses local-only persistence', source.includes('localStorage'));
check('workspace does not use fetch', !/\bfetch\s*\(/.test(source));
check('workspace does not expose network endpoint', !/\/api\//.test(source));
check('workspace uses same-origin UI only', !/https?:\/\//i.test(source));
check('workspace renders through DOM APIs', source.includes('document.createElement'));
check('workspace does not write user data as HTML', !/innerHTML\s*=/.test(source));
check('workspace does not write imported text with outerHTML', !/outerHTML\s*=/.test(source));
check('workspace uses textContent for status', source.includes('textContent'));
check('workspace has accessible live status', source.includes('aria-live'));
check('workspace has accessible search', source.includes('aria-label',));
check('workspace has keyboard-safe search escape', source.includes("event.key === 'Escape'"));
check('workspace supports select all', source.includes('selectVisible(true)'));
check('workspace supports clear selection', source.includes('state.selected = []'));
check('workspace supports archive', source.includes('conversation.archived = archived'));
check('workspace supports pin', source.includes('conversation.pinned = pinned'));
check('workspace supports clone', source.includes("createId('copy')"));
check('workspace supports bulk tags', source.includes('function onTag'));
check('workspace supports permanent deletion confirmation', source.includes('Bu işlem geri alınamaz'));
check('workspace supports selected JSON export', source.includes('format: \'hafize-conversations\''));
check('workspace supports JSON import', source.includes('function importBackup'));
check('workspace accepts legacy raw arrays on import', source.includes('Array.isArray(parsed) ? parsed : parsed?.conversations'));
check('workspace regenerates id on collision', source.includes("createId('import')"));
check('workspace bounds imported dataset', source.includes('.slice(0, MAX_CONVERSATIONS)'));
check('workspace creates a blob for selected export', source.includes('new Blob([payload]'));
check('workspace revokes export object URL', source.includes('URL.revokeObjectURL(url)'));
check('workspace marks generated anchor noopener', source.includes('anchor.rel = \'noopener\''));
check('workspace removes generated import input', source.includes('input.remove()'));
check('workspace rejects oversized import files', source.includes('file.size > MAX_IMPORT_BYTES'));
check('workspace rejects oversized imported text', source.includes('text.length > MAX_IMPORT_BYTES'));
check('workspace handles invalid JSON import', source.includes('geçersiz JSON'));
check('workspace announces import result', source.includes('sohbet içe aktarıldı'));
check('workspace announces archive state', source.includes('arşivlendi'));
check('workspace announces pin state', source.includes('sabitlendi'));
check('workspace announces delete count', source.includes('sohbet silindi'));
check('workspace announces clone count', source.includes('sohbet kopyalandı'));
check('workspace announces tag state', source.includes('Etiket seçili sohbetlere eklendi'));
check('workspace supports tag counts', source.includes('collectTags'));
check('workspace uses Turkish collator', source.includes("Intl.Collator('tr-TR'"));
check('workspace supports title sorting', source.includes("sort === 'title-asc'"));
check('workspace supports time sorting', source.includes('safeDate(sort.startsWith'));
check('workspace filters by text query', source.includes('haystack.includes(nextState.query)'));
check('workspace filters by tag query', source.includes('normalizeText(tag) === nextState.tag'));
check('workspace checks archived filter', source.includes("filter === 'archived'"));
check('workspace checks pinned filter', source.includes("filter === 'pinned'"));
check('workspace checks tagged filter', source.includes("filter === 'tagged'"));
check('workspace exposes public API', source.includes('globalThis.HafizeConversationWorkspace'));
check('workspace exposes immutable API', source.includes('Object.freeze({'));
check('workspace exposes safe read function', source.includes('readConversations,'));
check('workspace exposes safe normalization function', source.includes('normalizeConversation,'));
check('workspace exposes state getter', source.includes('getState: () => cloneState(state)'));
check('workspace exposes refresh function', source.includes('refresh,'));
check('workspace exposes constants', source.includes('constants: Object.freeze'));
check('workspace has MutationObserver', source.includes('new MutationObserver'));
check('workspace observes history mutations', source.includes('observer.observe(ui.history'));
check('workspace reacts to localStorage changes', source.includes("event.key === STORAGE_KEY || event.key === WORKSPACE_KEY"));
check('workspace reacts to own event', source.includes(`window.addEventListener(WORKSPACE_EVENT`));
check('workspace decorates conversation rows', source.includes('function decorateRows'));
check('workspace adds checkbox controls', source.includes('workspace-row-check'));
check('workspace prevents checkbox click navigation', source.includes('event.stopPropagation()'));
check('workspace uses checked state from persistent selection', source.includes('state.selected.includes(id)'));
check('workspace removes stale selection ids', source.includes('pruneMissingSelection'));
check('workspace reports quota', source.includes('estimateStorage(conversations)'));
check('workspace exposes progress value', source.includes('aria-valuenow'));
check('workspace stores progress semantics', source.includes('role',));
check('workspace disables destructive controls without selection', source.includes('button.disabled = disabled'));
check('workspace uses global confirm', source.includes('globalThis.confirm'));
check('workspace uses global prompt only for tag input', source.includes('globalThis.prompt'));
check('workspace has max 8 tags per conversation', source.includes('MAX_TAGS'));
check('workspace uses cloned object before mutation', source.includes('structuredCloneSafe'));
check('workspace has structuredClone fallback', source.includes('JSON.parse(JSON.stringify(value))'));
check('workspace creates unique clone ids', source.includes("createId('copy')"));
check('workspace creates unique import ids', source.includes("createId('import')"));
check('workspace includes createdAt in clone', source.includes('cloneConversation.createdAt'));
check('workspace includes updatedAt in clone', source.includes('cloneConversation.updatedAt'));
check('workspace writes normalized conversations', source.includes('writeConversations'));
check('workspace dispatches change event after write', source.includes('window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT'));
check('workspace schedules reload after data mutation', source.includes('window.location.reload()'));
check('workspace uses small reload delay', source.includes('window.setTimeout(() => window.location.reload(), 50)'));
check('workspace has mobile breakpoint', css.includes('@media (max-width: 760px)'));
check('workspace has small mobile breakpoint', css.includes('@media (max-width: 460px)'));
check('workspace has reduced motion support', css.includes('@media (prefers-reduced-motion: reduce)'));
check('workspace supports app reduced motion flag', css.includes("html[data-reduced-motion='true']"));
check('workspace supports forced colors', css.includes('@media (forced-colors: active)'));
check('workspace uses theme variables', css.includes('var(--line)') && css.includes('var(--ink)'));
check('workspace controls do not overflow', css.includes('min-width: 0'));
check('workspace filter grid collapses', css.includes('grid-template-columns: 1fr 1fr'));
check('workspace search spans mobile grid', css.includes('grid-column: 1 / -1'));
check('workspace quota uses progress bar', css.includes('.workspace-quota-fill'));
check('workspace selected row has visible state', css.includes('.conversation-row.workspace-selected'));
check('workspace checkbox uses accent color', css.includes('accent-color: var(--accent-strong)'));
check('workspace hidden rows stay hidden', css.includes('.conversation-row[hidden]'));
check('workspace has disabled visual treatment', css.includes('opacity: .45'));
check('workspace has destructive styling', css.includes('.workspace-danger'));
check('workspace has focus styling', css.includes('.workspace-search:focus'));
check('index references workspace stylesheet', index.includes('/conversation-workspace.css'));
check('index references workspace script', index.includes('/conversation-workspace.js'));
check('workspace script loads after chat drafts', index.indexOf('/chat-drafts.js') < index.indexOf('/conversation-workspace.js'));
check('workspace remains before voice modules', index.indexOf('/conversation-workspace.js') < index.indexOf('/voice-input.js'));
check('service worker has workspace stylesheet', sw.includes('/conversation-workspace.css'));
check('service worker has workspace script', sw.includes('/conversation-workspace.js'));
check('service worker cache version is explicit', sw.includes(`CURRENT_CACHE = \`\${CACHE_PREFIX}${shellVersion}\``));
check('rules advertise 3000 line budget', rules.includes('Tur değişiklik bütçesi — 3000 satır'));
check('rules define 3000 max diff', rules.includes('en fazla 3000 değişen satır'));

const dangerous = [
  'document.cookie',
  'localStorage.setItem(\'token\'',
  'Authorization:',
  'Bearer ',
  '.env',
  'private_key',
  'apiKey'
];
for (const fragment of dangerous) excludes(source, fragment, `workspace excludes secret-like ${fragment}`);

const requiredLabels = [
  'Sohbet çalışma alanı',
  'Tümünü seç',
  'Seçimi temizle',
  'Arşivle',
  'Arşivden çıkar',
  'Sabitle',
  'Sabitlemeyi kaldır',
  'Kopyala',
  'Etiket ekle',
  'Sil',
  'Seçilenleri dışa aktar',
  'Yedek içe aktar',
  'Tüm sohbetler',
  'Arşivlenmiş',
  'Sabitlenmiş',
  'Etiketli'
];
for (const label of requiredLabels) includes(source, label, `workspace exposes label ${label}`);

assert.match(source, /const\s+WORKSPACE_KEY\s*=\s*'hafize\.conversation-workspace\.v1'/);
assert.match(source, /const\s+MAX_CONVERSATIONS\s*=\s*30/);
assert.match(source, /const\s+MAX_IMPORT_BYTES\s*=\s*1024\s*\*\s*1024/);
assert.match(source, /const\s+VALID_SORTS\s*=\s*new\s+Set/);
assert.match(source, /const\s+VALID_FILTERS\s*=\s*new\s+Set/);
assert.match(source, /function\s+conversationMatches/);
assert.match(source, /function\s+collectTags/);
assert.match(source, /function\s+buildToolbar/);
assert.match(source, /function\s+decorateRows/);
assert.match(source, /function\s+structuredCloneSafe/);
assert.match(source, /function\s+createId/);
assert.match(source, /function\s+pruneMissingSelection/);
assert.match(source, /function\s+refresh/);
assert.match(source, /function\s+expose/);

// The panel is built with DOM APIs, so the accessibility contract lives in
// setAttribute calls rather than HTML attribute strings.
for (const fragment of [
  "setAttribute('role', 'status')",
  "setAttribute('aria-label', 'Sohbet çalışma alanı yönetimi')",
  "setAttribute('aria-label', 'Sohbet filtresi')",
  "setAttribute('aria-label', 'Sohbet sıralaması')",
  "setAttribute('aria-label', 'Etikete göre filtrele')",
  "setAttribute('aria-valuemin', '0')",
  "setAttribute('aria-valuemax', '100')"
]) includes(source, fragment, `accessibility contract ${fragment}`);

for (const fragment of [
  '.conversation-workspace {',
  '.conversation-workspace-head',
  '.conversation-workspace-filters',
  '.conversation-workspace-batch',
  '.conversation-workspace-io',
  '.conversation-workspace-quota',
  '.workspace-search',
  '.workspace-select',
  '.workspace-row-check',
  '.workspace-selected',
  '.workspace-danger'
]) includes(css, fragment, `stylesheet contract ${fragment}`);

const summary = {
  checks: checks.length,
  sourceBytes: Buffer.byteLength(source),
  cssBytes: Buffer.byteLength(css),
  testBytes: fs.statSync(new URL(import.meta.url)).size,
  shellVersion
};

console.log(`conversation-workspace contract: ${summary.checks} checks passed`);
console.log(JSON.stringify(summary, null, 2));
