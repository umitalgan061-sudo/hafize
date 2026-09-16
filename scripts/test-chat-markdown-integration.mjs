// Wiring contract: the renderer is actually loaded, cached offline, and used
// by the chat instead of the old `textContent` write.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertShellAssets, assertShellCacheContract, indexHtmlAssets } from './shell-cache-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const html = read('public/index.html');
const app = read('public/app.js');
const chatMarkdown = read('public/chat-markdown.js');
const composerFeatures = read('public/chat-composer-features.js');
const messageWorkspace = read('public/message-workspace.js');
const voiceOutput = read('public/voice-output.js');
const css = read('public/chat-markdown.css');

/* The page loads the three new files, in a usable order ------------------ */

for (const asset of ['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css']) {
  assert.ok(html.includes(asset), `index.html loads ${asset}`);
}

const scriptOrder = [...html.matchAll(/<script src="(\/[^"]+)"/g)].map((match) => match[1]);
const rendererAt = scriptOrder.indexOf('/markdown-renderer.js');
const chatAt = scriptOrder.indexOf('/chat-markdown.js');
const appAt = scriptOrder.indexOf('/app.js');
assert.ok(rendererAt >= 0 && chatAt >= 0 && appAt >= 0);
assert.ok(rendererAt < chatAt, 'the renderer is defined before the chat layer that uses it');
assert.ok(
  chatAt < appAt,
  'both are defined before app.js, so the very first render already paints markdown'
);
for (const match of html.matchAll(/<script src="\/(?:markdown-renderer|chat-markdown)\.js"([^>]*)>/g)) {
  assert.ok(match[1].includes('defer'), 'the new scripts are deferred like the rest');
}

/* They survive offline --------------------------------------------------- */

assertShellCacheContract();
assertShellAssets(['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css'], 'markdown asset');
const indexAssets = new Set(indexHtmlAssets());
for (const asset of ['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css']) {
  assert.ok(indexAssets.has(asset), `${asset} is discovered from index.html`);
}

/* app.js paints through the markdown layer ------------------------------- */

assert.match(app, /function paintContent\(/, 'app.js has a single painting entry point');
assert.match(app, /window\.HafizeChatMarkdown/, 'it goes through the chat markdown layer');
assert.match(app, /paintContent\(content, message\.content, \{ role: message\.role \}\)/, 'renderMessages paints');
assert.match(app, /paintContent\(node, content, \{ role: message\.role, streaming: !persist \}\)/, 'stream deltas paint');
assert.match(app, /plain: role !== 'assistant'/, 'only assistant answers are rendered as markdown');
assert.equal(
  /\.content.*\.textContent = /.test(app),
  false,
  'no direct textContent write to a message body is left behind'
);
assert.match(app, /node\.textContent = value \|\| MESSAGE_PLACEHOLDER/, 'a fallback still exists when the layer is absent');

/* The renderer stays optional -------------------------------------------- */

assert.match(chatMarkdown, /requestAnimationFrame/, 'deltas coalesce into a frame');
assert.match(chatMarkdown, /cancelAnimationFrame/, 'the final paint cancels a pending frame');
assert.match(chatMarkdown, /data-md-copy="code"/, 'code copy is delegated, so it survives re-renders');

/* Downstream readers moved off rendered textContent ---------------------- */

assert.match(
  composerFeatures,
  /HafizeChatMarkdown\?\.sourceFor\?\.\(content\)/,
  'answer copy hands back the markdown the model wrote'
);
assert.match(
  messageWorkspace,
  /HafizeChatMarkdown\?\.plainTextFor\?\.\(content\)/,
  'the message workspace reads the projection, not glued-together block text'
);
assert.match(
  voiceOutput,
  /HafizeChatMarkdown\?\.sourceFor\?\.\(node\)/,
  'voice output keeps reading markdown, which it already knows how to strip'
);

/* Styling is scoped to rendered assistant answers ------------------------ */

assert.match(css, /\.message\.assistant \.content\[data-md\]/, 'only a rendered answer is restyled');
assert.equal(
  /^\s*\.message \.content\s*\{/m.test(css),
  false,
  'the shared message body rule is left to styles.css'
);
assert.match(css, /html\[data-theme="dark"\]/, 'the sheet carries dark-theme tokens');
assert.match(css, /\.md-code-copy::after \{ content: "⧉ Kopyala"; \}/, 'the copy label comes from CSS, not from a text node');
assert.match(css, /@media \(max-width: 560px\)/, 'the sheet has a phone breakpoint');
for (const token of ['.md-paragraph', '.md-heading', '.md-list', '.md-quote', '.md-code', '.md-table', '.md-link', '.md-divider', '.md-inline-code']) {
  assert.ok(css.includes(token), `${token} is styled`);
}

console.log('chat markdown integration OK: loaded in order, cached offline, wired into the chat and its readers');
