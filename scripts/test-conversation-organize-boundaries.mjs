import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/conversation-organize.js', import.meta.url));
const cssPath = fileURLToPath(new URL('../public/conversation-organize.css', import.meta.url));
const [source, css] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(cssPath, 'utf8')
]);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /navigator\.clipboard/,
  /document\.cookie/,
  /\bindexedDB\b/i,
  /\binnerHTML\b/,
  /\bouterHTML\b/,
  /insertAdjacentHTML/,
  /api\.github\.com/i,
  /Authorization/i,
  /Bearer\s/i,
  /GITHUB_TOKEN/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/i,
  /child_process/,
  /\bexecSync?\b/,
  /\bspawnSync?\b/,
  /shell\s*=\s*true/i
]) {
  assert.equal(forbidden.test(source), false, `conversation organization must not expose forbidden surface: ${forbidden}`);
}

assert.equal(source.includes("const SOURCE_KEY = 'hafize.conversations.v1'"), true);
assert.equal(source.includes("const STORAGE_KEY = 'hafize.conversation-organize.v1'"), true);
assert.equal(source.includes('const MAX_ENTRIES = 30'), true);
assert.equal(source.includes('const MAX_ID_CHARS = 160'), true);
assert.equal(source.includes('const MAX_TITLE_CHARS = 80'), true);
assert.equal(source.includes("storage?.setItem?.(STORAGE_KEY"), true, 'only explicit organization metadata is persisted');
assert.equal(source.includes("storage?.setItem?.(SOURCE_KEY"), false, 'source conversation history must remain read-only');
assert.equal(source.includes("storage?.getItem?.(SOURCE_KEY)"), true);
assert.equal(source.includes("storage?.getItem?.(STORAGE_KEY)"), true);
assert.equal(source.includes("open.textContent = title"), true, 'title rendering must use textContent');
assert.equal(source.includes("input.maxLength = MAX_TITLE_CHARS"), true);
assert.equal(source.includes("input.autocomplete = 'off'"), true);
assert.equal(source.includes("event?.key !== 'Escape'"), true);
assert.equal(source.includes("observer.observe(list, { childList: true, subtree: true })"), true);
assert.equal(source.includes("root.addEventListener?.('storage', onStorage)"), true);
assert.equal(source.includes("root.removeEventListener?.('storage', onStorage)"), true);
assert.equal(source.includes('pruneEntries(entries, sourceIds)'), true, 'stale metadata must be pruned');
assert.equal(source.includes('sortIds(sourceIds, entries)'), true, 'pin order must be deterministic');

assert.match(css, /min-width:\s*44px/);
assert.match(css, /min-height:\s*44px/);
assert.match(css, /focus-visible/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /forced-colors:\s*active/);
assert.match(css, /aria-pressed/);
assert.match(css, /conversation-pinned/);
assert.match(css, /conversation-organize-editor/);

console.log('conversation organize boundary tests passed');
