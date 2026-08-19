import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const focus = require('../public/reading-focus.js');
const swPolicy = require('../public/sw-policy.js');

assert.equal(focus.STORAGE_KEY, 'hafize.reading-focus.v1');
assert.equal(focus.MAX_BOOKMARKS, 200);
assert.equal(focus.MAX_MESSAGE_ID_CHARS, 160);
assert.equal(focus.MAX_CONVERSATION_ID_CHARS, 120);
assert.equal(focus.BOOKMARK_SEPARATOR, '|');

assert.equal(focus.normalizeMessageId('abc-123'), 'abc-123');
assert.equal(focus.normalizeMessageId(' msg:1 '), 'msg:1');
assert.equal(focus.normalizeMessageId(''), null);
assert.equal(focus.normalizeMessageId('with space'), null);
assert.equal(focus.normalizeConversationId(' conversation-1 '), 'conversation-1');
assert.equal(focus.normalizeConversationId('../bad'), null);
assert.equal(focus.bookmarkKey('conversation-1', 'msg:1'), 'conversation-1|msg:1');
assert.deepEqual(focus.parseBookmarkKey('conversation-1|msg:1'), {
  conversationId: 'conversation-1', messageId: 'msg:1', key: 'conversation-1|msg:1'
});
assert.equal(focus.parseBookmarkKey('conversation-1|msg:1|extra'), null);
assert.equal(focus.parseBookmarkKey('legacy-message'), null);

assert.deepEqual(
  focus.normalizeBookmarkIds(['c1|a', 'c1|a', 'bad id', 'c2|a', null, 'c1|b']),
  ['c1|a', 'c2|a', 'c1|b']
);
assert.deepEqual(focus.normalizeLegacyBookmarkIds(['a', 'a', 'c1|a', 'bad id', 'b']), ['a', 'b']);
assert.equal(focus.normalizeBookmarkIds(Array.from({ length: 230 }, (_, index) => `c|id-${index}`)).length, 200);

assert.deepEqual(focus.normalizeState(null), { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] });
assert.deepEqual(
  focus.normalizeState({ focusMode: true, bookmarkIds: ['c1|a', 'a', 'c1|a', 'b'] }),
  { focusMode: true, bookmarkIds: ['c1|a'], legacyBookmarkIds: ['a', 'b'] }
);
assert.deepEqual(focus.parseState('{broken'), { focusMode: false, bookmarkIds: [], legacyBookmarkIds: [] });
assert.deepEqual(
  focus.parseState(JSON.stringify({ focusMode: true, bookmarkIds: ['c1|a', 'legacy-a'] })),
  { focusMode: true, bookmarkIds: ['c1|a'], legacyBookmarkIds: ['legacy-a'] }
);

assert.equal(
  focus.serializeState({ focusMode: true, bookmarkIds: ['c1|a', 'c1|a', 'c2|b'] }),
  JSON.stringify({ focusMode: true, bookmarkIds: ['c1|a', 'c2|b'] })
);
assert.deepEqual(focus.nextBookmarkIds(['c1|a', 'c2|b'], 'c1|a', false), ['c2|b']);
assert.deepEqual(focus.nextBookmarkIds(['c1|a'], 'c2|b', true), ['c1|a', 'c2|b']);
assert.deepEqual(focus.nextBookmarkIds(['c1|a'], 'legacy-a', true), ['c1|a']);
const bounded = focus.nextBookmarkIds(Array.from({ length: 200 }, (_, index) => `c|old-${index}`), 'c|new', true);
assert.equal(bounded.length, 200);
assert.equal(bounded.at(-1), 'c|new');
assert.equal(bounded.includes('c|old-0'), false);

const conversations = [
  { id: 'c1', messages: [{ id: 'unique' }, { id: 'shared' }] },
  { id: 'c2', messages: [{ id: 'shared' }, { id: 'other' }] }
];
const index = focus.bookmarkIndexFromConversations(conversations);
assert.equal(index.validKeys.has('c1|shared'), true);
assert.equal(index.validKeys.has('c2|shared'), true);
assert.equal(index.legacyMatches.get('unique'), 'c1|unique');
assert.equal(index.legacyMatches.get('shared'), null, 'legacy duplicate message ids must be ambiguous');
assert.deepEqual(focus.migrateLegacyBookmarkIds(['unique', 'shared', 'missing'], index), ['c1|unique']);
const messageIds = focus.messageIdsFromConversations(conversations);
assert.deepEqual([...messageIds].sort(), ['other', 'shared', 'unique']);
assert.deepEqual(focus.pruneBookmarkIds(['c1|shared', 'c2|other', 'unique', 'shared'], messageIds), [
  'c1|shared', 'c2|other', 'c1|unique'
]);

const sourcePath = fileURLToPath(new URL('../public/reading-focus.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/reading-focus.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/READING_FOCUS_BOOKMARKS_CONTRACT.md', import.meta.url));

const [source, css, loader, policySource, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'), readFile(cssPath, 'utf8'), readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'), readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

for (const forbidden of [
  /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /\bEventSource\b/,
  /sendBeacon\s*\(/, /navigator\.clipboard/, /document\.cookie/, /Authorization/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/, /\.textContent\s*;\s*storage/i, /innerHTML\s*=/
]) {
  assert.equal(forbidden.test(source), false, `reading focus must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("const STORAGE_KEY = 'hafize.reading-focus.v1'"), true);
assert.equal(source.includes('const MAX_BOOKMARKS = 200'), true);
assert.equal(source.includes("const BOOKMARK_SEPARATOR = '|'"), true);
assert.equal(source.includes("link.href = '/reading-focus.css'"), true);
assert.equal(source.includes("observer?.observe(messages, { childList: true, subtree: true })"), true);
assert.equal(source.includes("attributeFilter: ['class', 'data-conversation-organize-id']"), true);
assert.equal(source.includes("root.addEventListener?.('storage', onStorage)"), true);
assert.equal(source.includes("root.removeEventListener?.('storage', onStorage)"), true);

assert.equal(loader.includes("loadShellEnhancement('HafizeReadingFocus', '/reading-focus.js', 'data-hafize-reading-focus')"), true);
assert.equal(loader.split("'/reading-focus.js'").length - 1, 1, 'reading focus loader must be exact-once');
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v108');
assert.equal(swPolicy.SHELL_ASSETS.includes('/reading-focus.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/reading-focus.css'), true);
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/reading-focus.js', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({ method: 'GET', url: 'https://hafize.example/api/chat', headers: {}, mode: 'cors' }, 'https://hafize.example'), 'network-only');

assert.match(css, /body\.reading-focus-mode \.utility-rail/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /\.message\.reading-bookmark-current/);

assert.match(doc, /mesaj metnini/i);
assert.match(doc, /conversation/i);
assert.match(doc, /benzersiz/i);
assert.match(doc, /200/);
assert.match(doc, /backend/i);

console.log('reading focus and bookmark tests passed');
