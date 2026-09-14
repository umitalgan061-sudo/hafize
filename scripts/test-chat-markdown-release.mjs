import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = {
  js: readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8'),
  css: readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8'),
  index: readFileSync(new URL('../public/index.html', import.meta.url), 'utf8'),
  sw: readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8')
};

for (const token of ['parseMarkdown', 'renderMarkdown', 'install', 'safeLinkHref', 'MutationObserver']) assert.ok(files.js.includes(token));
for (const token of ['md-code', 'md-table', 'focus-visible', 'forced-colors']) assert.ok(files.css.includes(token));
assert.equal((files.index.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((files.index.match(/chat-markdown\.css/g) || []).length, 1);
assert.equal((files.sw.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((files.sw.match(/chat-markdown\.css/g) || []).length, 1);
assert.match(files.sw, /v24/);
assert.match(files.sw, /network-only/);
assert.match(files.js, /MAX_INPUT|LIMITS/);
assert.match(files.js, /noopener noreferrer nofollow/);
assert.doesNotMatch(files.js, /innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML/i);

console.log('test-chat-markdown-release: ok');
