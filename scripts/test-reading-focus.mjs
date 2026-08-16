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

assert.equal(focus.normalizeMessageId('abc-123'), 'abc-123');
assert.equal(focus.normalizeMessageId(' msg:1 '), 'msg:1');
assert.equal(focus.normalizeMessageId(''), null);
assert.equal(focus.normalizeMessageId(null), null);
assert.equal(focus.normalizeMessageId('with space'), null);
assert.equal(focus.normalizeMessageId('x'.repeat(161)), null);
assert.equal(focus.normalizeMessageId('<script>'), null);

assert.deepEqual(
  focus.normalizeBookmarkIds(['a', 'a', 'bad id', 'b', null, 'c']),
  ['a', 'b', 'c']
);
assert.deepEqual(focus.normalizeBookmarkIds('a'), []);
assert.equal(focus.normalizeBookmarkIds(Array.from({ length: 230 }, (_, index) => `id-${index}`)).length, 200);

assert.deepEqual(focus.normalizeState(null), { focusMode: false, bookmarkIds: [] });
assert.deepEqual(
  focus.normalizeState({ focusMode: true, bookmarkIds: ['a', 'a', 'b'] }),
  { focusMode: true, bookmarkIds: ['a', 'b'] }
);
assert.deepEqual(focus.parseState('{broken'), { focusMode: false, bookmarkIds: [] });
assert.deepEqual(focus.parseState(''), { focusMode: false, bookmarkIds: [] });
assert.deepEqual(
  focus.parseState(JSON.stringify({ focusMode: true, bookmarkIds: ['a', 'bad id', 'b'] })),
  { focusMode: true, bookmarkIds: ['a', 'b'] }
);

assert.equal(
  focus.serializeState({ focusMode: true, bookmarkIds: ['a', 'a', 'b'] }),
  JSON.stringify({ focusMode: true, bookmarkIds: ['a', 'b'] })
);
assert.deepEqual(focus.nextBookmarkIds(['a', 'b'], 'a', false), ['b']);
assert.deepEqual(focus.nextBookmarkIds(['a'], 'b', true), ['a', 'b']);
assert.deepEqual(focus.nextBookmarkIds(['a'], 'bad id', true), ['a']);
const bounded = focus.nextBookmarkIds(Array.from({ length: 200 }, (_, index) => `old-${index}`), 'new', true);
assert.equal(bounded.length, 200);
assert.equal(bounded.at(-1), 'new');
assert.equal(bounded.includes('old-0'), false);

const sourcePath = fileURLToPath(new URL('../public/reading-focus.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/reading-focus.css', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/READING_FOCUS_BOOKMARKS_CONTRACT.md', import.meta.url));

const [source, css, loader, policySource, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [sourcePath, loaderPath, policyPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax check failed`);
}

for (const forbidden of [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon\s*\(/,
  /navigator\.clipboard/,
  /document\.cookie/,
  /Authorization/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /\.textContent\s*;\s*storage/i,
  /innerHTML\s*=/
]) {
  assert.equal(forbidden.test(source), false, `reading focus must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("const STORAGE_KEY = 'hafize.reading-focus.v1'"), true);
assert.equal(source.includes('const MAX_BOOKMARKS = 200'), true);
assert.equal(source.includes("link.href = '/reading-focus.css'"), true);
assert.equal(source.includes("observer?.observe(messages, { childList: true, subtree: true })"), true);
assert.equal(source.includes("focusButton.setAttribute('aria-pressed'"), true);
assert.equal(source.includes("bookmarkNavigator.disabled = visible.length === 0"), true);
assert.equal(source.includes("article.scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })"), true);
assert.equal(source.includes("root.addEventListener?.('storage', onStorage)"), true);
assert.equal(source.includes("root.removeEventListener?.('storage', onStorage)"), true);
assert.equal(source.includes("documentRef.body.classList?.remove?.('reading-focus-mode')"), true);

assert.equal(loader.includes("loadShellEnhancement('HafizeReadingFocus', '/reading-focus.js', 'data-hafize-reading-focus')"), true);
assert.equal(loader.split("'/reading-focus.js'").length - 1, 1, 'reading focus loader must be exact-once');
assert.equal(swPolicy.CURRENT_CACHE, 'hafize-shell-v61');
assert.equal(swPolicy.SHELL_ASSETS.includes('/reading-focus.js'), true);
assert.equal(swPolicy.SHELL_ASSETS.includes('/reading-focus.css'), true);
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/reading-focus.js',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'GET',
  url: 'https://hafize.example/reading-focus.css',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'shell');
assert.equal(swPolicy.classifyRequest({
  method: 'POST',
  url: 'https://hafize.example/api/chat',
  headers: {},
  mode: 'cors'
}, 'https://hafize.example'), 'ignore');

assert.match(css, /body\.reading-focus-mode \.utility-rail/);
assert.match(css, /body\.reading-focus-mode \.sidebar/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /min-height: 40px/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(forced-colors: active\)/);
assert.match(css, /\.message\.reading-bookmark-current/);

assert.match(doc, /mesaj metnini/i);
assert.match(doc, /200/);
assert.match(doc, /fetch/i);
assert.match(doc, /backend/i);
assert.match(doc, /prefers-reduced-motion/i);
assert.match(doc, /forced-colors/i);

console.log('reading focus and bookmark tests passed');
