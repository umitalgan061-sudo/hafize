import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

const invariants = [
  ['assistant-only', /\.message\.assistant \.content/],
  ['observer', /MutationObserver/],
  ['parser', /function parseMarkdown/],
  ['inline', /function scanInline/],
  ['renderer', /function renderMarkdown/],
  ['clipboard', /function copyCode/],
  ['allowlist', /SAFE_PROTOCOLS/],
  ['bounded-input', /maxInput/],
  ['bounded-code', /maxCodeLines/],
  ['bounded-table', /maxTableRows/],
  ['no-html-sink', /replaceChildren/],
  ['text-content', /textContent/],
  ['safe-link-rel', /noopener noreferrer nofollow/]
];
for (const [name, expression] of invariants) assert.match(js, expression, name);

const prohibited = [/innerHTML\s*=/i, /outerHTML\s*=/i, /insertAdjacentHTML/i, /document\.write\s*\(/i, /document\.cookie/i, /XMLHttpRequest/i, /WebSocket/i, /\bfetch\s*\(/i, /Authorization/i, /Bearer\s+/i];
for (const expression of prohibited) assert.doesNotMatch(js, expression);

for (const token of ['.md-code', '.md-table', '.md-list', '.md-quote', '.md-inline-code', ':focus-visible', 'forced-colors', 'prefers-reduced-motion']) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(index, /<link rel="stylesheet" href="\/chat-markdown\.css" \/>/);
assert.match(index, /<script src="\/chat-markdown\.js" defer><\/script>/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v24`/);
assert.match(sw, /\/chat-markdown\.css/);
assert.match(sw, /\/chat-markdown\.js/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);

console.log('test-chat-markdown-invariants: ok');
