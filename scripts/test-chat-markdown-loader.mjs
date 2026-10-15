// Loader contract: the Markdown renderer and the chat layer reach the browser
// through their own Vite entries, cached for offline use, and neither module
// fetches anything or writes HTML.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { assertBundledModule, assertStylesheet, readBrowserModule } from './legacy-bundle-contract.mjs';

assertBundledModule('markdown-renderer');
assertBundledModule('chat-markdown');
assertStylesheet('chat-markdown');

const renderer = readBrowserModule('markdown-renderer');
const chat = readBrowserModule('chat-markdown');

assert.match(renderer, /createElement/);
assert.match(renderer, /textContent/);
assert.match(chat, /HafizeMarkdown/);
assert.match(chat, /requestAnimationFrame/);

for (const [name, source] of [['markdown-renderer', renderer], ['chat-markdown', chat]]) {
  assert.doesNotMatch(source, /innerHTML\s*=/, `${name} never writes innerHTML`);
  assert.doesNotMatch(source, /fetch\s*\(/, `${name} never calls the network`);
}

const css = readFileSync('public/chat-markdown.css', 'utf8');
assert.match(css, /\.message\.assistant/);

console.log('chat markdown loader contract: ok');
