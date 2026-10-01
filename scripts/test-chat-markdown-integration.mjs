// Wiring contract: the renderer is actually loaded, cached offline, and used
// by the chat instead of the old `textContent` write.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertShellAssets, assertShellCacheContract, indexHtmlAssets, injectedRuntimeAssets, swPolicy } from './shell-cache-contract.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const html = read('public/index.html');
const app = read('public/typed/app-shell.ts');
const chatMarkdown = read('public/chat-markdown.js');
const composerFeatures = read('public/chat-composer-features.js');
const messageWorkspace = read('public/typed/message-workspace.ts');
const voiceOutput = read('public/typed/voice-output.ts');
const css = read('public/chat-markdown.css');

/* The page loads the three new files, in a usable order ------------------ */

const bootstrap = read('public/prompt-library-revisions-enhancements.js');
assert.ok(
  html.includes('/prompt-library-revisions-enhancements.js'),
  'index.html loads the bootstrap that injects the chat markdown layer'
);
for (const asset of ['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css']) {
  assert.ok(bootstrap.includes(asset), `the bootstrap injects ${asset}`);
  assert.ok(swPolicy.SHELL_ASSETS.includes(asset), `${asset} is precached for offline use`);
}
assert.match(
  bootstrap,
  /loadScript\(RENDERER, \(\) => loadScript\(CHAT\)\)/,
  'the chat layer is injected only after the renderer it calls has loaded'
);
assert.match(bootstrap, /loadLink\(\);/, 'the stylesheet is injected with the layer');
// A sessionStorage flag here used to outlive the injected DOM, so a reload
// left answers unstyled. Dedupe must be against the document.
assert.doesNotMatch(bootstrap, /sessionStorage[\s\S]{0,120}chat-markdown\.bootstrap/, 'injection is not gated on sessionStorage');
assert.match(bootstrap, /alreadyInHead\(/, 'injection dedupes against the document');
for (const match of html.matchAll(/<script src="\/(?:markdown-renderer|chat-markdown)\.js"([^>]*)>/g)) {
  assert.ok(match[1].includes('defer'), 'the new scripts are deferred like the rest');
}

/* They survive offline --------------------------------------------------- */

assertShellCacheContract();
assertShellAssets(['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css'], 'markdown asset');
const injected = injectedRuntimeAssets();
for (const asset of ['/markdown-renderer.js', '/chat-markdown.js', '/chat-markdown.css']) {
  assert.ok(injected.has(asset), `${asset} is discovered from the runtime bootstrap`);
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
  /HafizeChatMarkdown\?\.sourceFor\?\.\(node!?\)/,
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
