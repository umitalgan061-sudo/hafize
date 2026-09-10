import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const source = fs.readFileSync(path.join(root, 'public', 'conversation-workspace.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs', 'CONVERSATION_WORKSPACE.md'), 'utf8');

function must(fragment, label = fragment) {
  assert.ok(source.includes(fragment), label);
}
function mustNot(fragment, label = `forbidden ${fragment}`) {
  assert.ok(!source.includes(fragment), label);
}

const securityAssertions = [
  ['localStorage.getItem(STORAGE_KEY)', 'history read uses local storage'],
  ['localStorage.setItem(STORAGE_KEY', 'history write uses local storage'],
  ['localStorage.setItem(WORKSPACE_KEY', 'workspace state stays local'],
  ['JSON.parse(text)', 'import parses JSON explicitly'],
  ['file.size > MAX_IMPORT_BYTES', 'oversized import is rejected'],
  ['text.length > MAX_IMPORT_BYTES', 'oversized decoded text is rejected'],
  ['MAX_IMPORT_CONVERSATIONS', 'import count is bounded'],
  ['MAX_IMPORT_MESSAGES', 'message count is bounded'],
  ['MAX_IMPORT_BYTES', 'file size budget exists'],
  ['normalizeConversationList(incoming)', 'incoming records are normalized'],
  ['new Map(current.map((conversation) => [conversation.id, conversation]))', 'existing ids are indexed before merge'],
  ["createId('import')", 'id collision produces a fresh id'],
  ["createId('copy')", 'copy produces a fresh id'],
  ['globalThis.confirm', 'destructive mutation requires confirmation'],
  ['globalThis.prompt', 'tag mutation requires explicit entry'],
  ['URL.revokeObjectURL(url)', 'export object URL is released'],
  ['anchor.rel = \'noopener\'', 'export anchor is isolated'],
  ['new Blob([payload]', 'export stays local'],
  ['window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT', 'same-tab change event is explicit'],
  ["window.addEventListener('storage'", 'cross-tab history sync exists'],
  ['new MutationObserver', 'sidebar mutations are observed'],
  ['String(value ?? \'\')', 'tag/title conversion is explicit'],
  ["replace(/\\s+/g, ' ').trim()", 'whitespace is normalized'],
  ['replace(/^#+/', '')', 'tag marker input is normalized'],
  ['slice(0, MAX_TAG)', 'tag length is bounded'],
  ['slice(0, MAX_TITLE)', 'title length is bounded'],
  ['slice(0, MAX_IMPORTED_MESSAGE_LENGTH)', 'message length is bounded'],
  ['slice(0, MAX_IMPORT_MESSAGES)', 'message count is bounded at ingestion'],
  ['slice(0, MAX_TAGS)', 'tag count is bounded at ingestion'],
  ['new Set(input.tags.map(cleanTag)', 'import tags are deduplicated'],
  ['seen.has(conversation.id)', 'duplicate conversations are removed'],
  ['safeRole(message.role)', 'message role is normalized'],
  ['safeDate(input.createdAt', 'created timestamp is normalized'],
  ['safeDate(input.updatedAt', 'updated timestamp is normalized'],
  ['structuredCloneSafe(conversation)', 'copy mutation uses a clone'],
  ['structuredClone(value)', 'native structured clone is preferred'],
  ['JSON.parse(JSON.stringify(value))', 'clone fallback is bounded to serializable data'],
  ['Object.freeze({', 'exported workspace API is immutable'],
  ['Object.freeze({\n        STORAGE_KEY', 'constant view is immutable'],
  ['MAX_CONVERSATIONS: 30', 'public constants report conversation cap']
];

for (const [fragment, label] of securityAssertions) must(fragment, label);

const forbidden = [
  ['fetch(', 'no network request is performed'],
  ['XMLHttpRequest', 'no legacy network request is performed'],
  ['navigator.sendBeacon', 'no beacon can exfiltrate history'],
  ['document.cookie', 'cookies are never read'],
  ['Authorization', 'authorization headers are not created'],
  ['Bearer ', 'bearer credentials are not created'],
  ['apiKey', 'API keys never enter the workspace'],
  ['client_secret', 'OAuth secrets never enter the workspace'],
  ['privateKey', 'private key material never enters the workspace'],
  ['innerHTML =', 'untrusted strings are not rendered as HTML'],
  ['outerHTML =', 'DOM serialization is not assigned'],
  ['insertAdjacentHTML', 'HTML string insertion is not used'],
  ['document.write', 'document.write is not used'],
  ['eval(', 'eval is prohibited'],
  ['new Function(', 'dynamic code generation is prohibited']
];
for (const [fragment, label] of forbidden) mustNot(fragment, label);

const modelChecks = [
  [/const\s+MAX_CONVERSATIONS\s*=\s*30/, 'conversation cap is literal'],
  [/const\s+MAX_TITLE\s*=\s*80/, 'title cap is literal'],
  [/const\s+MAX_TAG\s*=\s*24/, 'tag cap is literal'],
  [/const\s+MAX_TAGS\s*=\s*8/, 'tag count cap is literal'],
  [/const\s+MAX_IMPORT_BYTES\s*=\s*1024\s*\*\s*1024/, 'import byte cap is literal'],
  [/const\s+MAX_IMPORT_CONVERSATIONS\s*=\s*30/, 'import conversation cap is literal'],
  [/const\s+MAX_IMPORT_MESSAGES\s*=\s*200/, 'import message cap is literal'],
  [/const\s+MAX_IMPORTED_MESSAGE_LENGTH\s*=\s*12000/, 'import message character cap is literal'],
  [/const\s+VALID_SORTS\s*=\s*new\s+Set/, 'sort allowlist exists'],
  [/const\s+VALID_FILTERS\s*=\s*new\s+Set/, 'filter allowlist exists'],
  [/function\s+normalizeConversation\s*\(/, 'conversation normalization function exists'],
  [/function\s+normalizeConversationList\s*\(/, 'list normalization function exists'],
  [/function\s+conversationMatches\s*\(/, 'filter predicate exists'],
  [/function\s+collectTags\s*\(/, 'tag index exists'],
  [/function\s+writeConversations\s*\(/, 'persistence boundary exists'],
  [/function\s+importBackup\s*\(/, 'import boundary exists'],
  [/function\s+downloadSelected\s*\(/, 'export boundary exists'],
  [/function\s+onDelete\s*\(/, 'destructive boundary exists']
];
for (const [pattern, label] of modelChecks) assert.match(source, pattern, label);

const docsChecks = [
  '## Amaç',
  '## Yerel veri modeli',
  '## Sınırlar',
  '## Filtreleme ve sıralama',
  '## Toplu seçim',
  '## Arşivleme',
  '## Sabitleme',
  '## Etiketler',
  '## Çoğaltma',
  '## Silme',
  '## JSON dışa aktarma',
  '## JSON içe aktarma',
  '## Güvenlik',
  '## PWA',
  '## Çoklu sekme',
  '## Erişilebilirlik',
  '## Performans',
  '## Hata davranışı',
  '## Test sözleşmesi',
  '## Geri alma'
];
for (const heading of docsChecks) assert.ok(docs.includes(heading), `docs contains ${heading}`);

const capTerms = [
  '30',
  '80 karakter',
  '24 karakter',
  '8 / sohbet',
  '1 MB',
  '200 / sohbet',
  '12000 karakter'
];
for (const term of capTerms) assert.ok(docs.includes(term), `docs includes bounded value ${term}`);

const threatTerms = [
  'innerHTML',
  'outerHTML',
  'Authorization',
  'fetch()',
  'confirm()',
  'prompt()',
  'storage',
  'CustomEvent'
];
for (const term of threatTerms) assert.ok(docs.includes(term), `docs explains ${term}`);

const lineCount = source.split('\n').length;
assert.ok(lineCount >= 600, 'workspace source remains substantial enough for the feature boundary');
assert.ok(docs.split('\n').length >= 150, 'workspace documentation is detailed enough for maintenance');

console.log(`conversation-workspace-adversarial: ${securityAssertions.length} security assertions, ${forbidden.length} forbidden-pattern guards, ${modelChecks.length} regex contracts, ${docsChecks.length} documentation sections`);
