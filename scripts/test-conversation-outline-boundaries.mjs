import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/conversation-outline.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/conversation-outline.css', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/CONVERSATION_OUTLINE_CONTRACT.md', import.meta.url));
const [source, style, doc] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(docPath, 'utf8')
]);

const syntax = spawnSync(process.execPath, ['--check', sourcePath], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || 'conversation-outline.js syntax failed');

for (const forbidden of [
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bindexedDB\b/,
  /document\.cookie/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /navigator\.clipboard/,
  /\.innerHTML\b/,
  /\.outerHTML\b/,
  /insertAdjacentHTML/,
  /Authorization/i,
  /Bearer\s/i,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/
]) {
  assert.equal(forbidden.test(source), false, `forbidden conversation outline surface: ${forbidden}`);
}

assert.equal(source.includes("querySelectorAll('.message.user[data-message-id]')"), true);
assert.equal(source.includes("querySelector?.('.content')"), true);
assert.equal(source.includes('MAX_OUTLINE_ITEMS = 100'), true);
assert.equal(source.includes('MAX_PREVIEW_CHARS = 92'), true);
assert.equal(source.includes('MAX_QUERY_CHARS = 120'), true);
assert.equal(source.includes('MESSAGE_ID_PATTERN'), true);
assert.equal(source.includes("preview.textContent = item.preview"), true, 'preview must be textContent-only');
assert.equal(source.includes("observer.observe(messages, { childList: true, subtree: true, characterData: true })"), true);
assert.equal(source.includes("event?.key !== 'Escape'"), true);
assert.equal(source.includes("matchMedia?.('(prefers-reduced-motion: reduce)')"), true);
assert.equal(source.includes("scrollIntoView?.({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })"), true);
assert.equal(source.includes("panel.setAttribute('role', 'dialog')"), true);
assert.equal(source.includes("status.setAttribute('aria-live', 'polite')"), true);
assert.equal(source.includes("searchInput.maxLength = MAX_QUERY_CHARS"), true);
assert.equal(source.includes("searchInput.autocomplete = 'off'"), true);
assert.equal(source.includes("addListener(root, 'scroll', onViewportChange, true)"), true);
assert.equal(source.includes('listenerCleanup.push(() => target.removeEventListener(type, listener, options))'), true);

assert.match(style, /@media \(max-width: 760px\)/);
assert.match(style, /min-height: 52px/);
assert.match(style, /prefers-reduced-motion: reduce/);
assert.match(style, /forced-colors: active/);
assert.match(style, /focus-visible/);
assert.match(style, /overscroll-behavior: contain/);

assert.match(doc, /yalnız `#messages \.message\.user/i);
assert.match(doc, /localStorage/);
assert.match(doc, /storage'a yazılmaz/i);
assert.match(doc, /100 kullanıcı turu/i);
assert.match(doc, /92 karakter/i);
assert.match(doc, /120 karakter/i);
assert.match(doc, /default-deny tool policy/i);

console.log('conversation outline boundary tests passed');
