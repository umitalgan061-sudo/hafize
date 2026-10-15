// The Markdown layer is loaded by the page, not by a runtime bootstrap.
//
// Before bundling, `prompt-library-revisions-enhancements` injected
// `/chat-markdown.css`, `/markdown-renderer.js` and `/chat-markdown.js` at
// runtime. Those per-file URLs no longer exist, so the injection only produced
// 404s (and a SyntaxError, because the bridge it loaded was an ES module served
// to a classic <script>). index.html now owns the order, and this suite guards
// it: the renderer is parsed before the chat layer, and both before the shell
// that paints with them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { assertStylesheet, bundleUrlFor } from './legacy-bundle-contract.mjs';

const html = readFileSync('public/index.html', 'utf8');
const enhancements = readFileSync('public/typed/legacy/prompt-library-revisions-enhancements.ts', 'utf8');
const chatMarkdown = readFileSync('public/chat-markdown.ts', 'utf8');
const renderIsExposed = readFileSync('public/markdown-renderer.ts', 'utf8');

const scriptOrder = [...html.matchAll(/<script[^>]+src="(\/[^"]+)"/g)].map((match) => match[1]);
const at = (url) => {
  const index = scriptOrder.indexOf(url);
  assert.ok(index >= 0, `index.html loads ${url}`);
  return index;
};

const renderer = at(bundleUrlFor('markdown-renderer'));
const chat = at(bundleUrlFor('chat-markdown'));
const legacy = at('/typed-build/legacy-app.js');

// Both layers are module scripts, so they run in document order before the
// legacy bundle and long before the first answer is painted.
assert.ok(renderer < legacy && chat < legacy, 'both markdown layers run before the legacy bundle');

// Document order between the two is not load-bearing: the chat layer resolves
// the renderer at paint time rather than capturing it at module scope.
assert.match(chatMarkdown, /function markdown\(\) \{\s*\n\s*const api = root\.HafizeMarkdown;/);
assert.match(renderIsExposed, /root\.HafizeMarkdown = api/);

assertStylesheet('chat-markdown');

// No runtime loader may come back and duplicate what the page already loads.
assert.doesNotMatch(enhancements, /bootstrapChatMarkdown/);
assert.doesNotMatch(enhancements, /createElement\('script'\)/);

console.log('chat markdown bootstrap order: ok');
