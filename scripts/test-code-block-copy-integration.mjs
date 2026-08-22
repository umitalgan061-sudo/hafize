import assert from 'node:assert/strict';
import fs from 'node:fs';

const markdown = fs.readFileSync(new URL('../public/safe-markdown-render.js', import.meta.url), 'utf8');
const copy = fs.readFileSync(new URL('../public/code-block-copy.js', import.meta.url), 'utf8');
const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(markdown, /code\.dataset\.language = block\.language/);
assert.match(markdown, /const pre = documentRef\.createElement\('pre'\)/);
assert.match(markdown, /const code = documentRef\.createElement\('code'\)/);
assert.match(markdown, /code\.textContent = block\.lines\.join\('\\n'\)/);
assert.match(markdown, /content\.classList\?\.add\('hafize-markdown'\)/);

assert.match(copy, /\.content\.hafize-markdown pre/);
assert.match(copy, /:scope > code/);
assert.match(copy, /languageLabel\(code\)/);
assert.match(copy, /clipboard\.writeText\(text\)/);
assert.match(copy, /pre\.dataset\[MARKER\] = '1'/);
assert.match(copy, /observer\.observe\(messages, \{ childList: true, subtree: true \}\)/);

const markdownIndex = loader.indexOf("HafizeSafeMarkdown");
const copyIndex = loader.indexOf("HafizeCodeBlockCopy");
assert.ok(markdownIndex >= 0);
assert.ok(copyIndex > markdownIndex, 'code copy loader must be after markdown renderer');

assert.match(sw, /'\/safe-markdown-render\.js'/);
assert.match(sw, /'\/code-block-copy\.js'/);
assert.match(sw, /const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/);

for (const forbidden of [
  'innerHTML',
  'insertAdjacentHTML',
  'eval(',
  'new Function',
  'fetch(',
  'localStorage',
  'sessionStorage',
  'requestSubmit',
  'WebSocket',
  'XMLHttpRequest'
]) {
  assert.ok(!copy.includes(forbidden), `code-copy must not contain ${forbidden}`);
}

assert.match(copy, /MAX_CODE_CHARS = 256 \* 1024/);
assert.match(copy, /secureContext/);
assert.match(copy, /noopener|clipboard/);
assert.match(copy, /Kodu kopyala/);
assert.match(copy, /Clipboard kapalı/);
assert.match(copy, /Kopyalandı/);
assert.match(copy, /Kopyalanamadı/);

console.log('markdown + code block copy integration contract ok');