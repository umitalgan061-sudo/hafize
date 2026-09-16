// The shell must load the stylesheet, then the renderer, then the chat layer,
// and all of them before app.js paints the first message.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');

const styleAt = html.indexOf('href="/chat-markdown.css"');
const rendererAt = html.indexOf('src="/markdown-renderer.js"');
const chatAt = html.indexOf('src="/chat-markdown.js"');
const appAt = html.indexOf('src="/app.js"');

assert.ok(styleAt >= 0, 'the stylesheet is linked');
assert.ok(rendererAt > styleAt, 'the renderer comes after the stylesheet');
assert.ok(chatAt > rendererAt, 'the chat layer comes after the renderer it uses');
assert.ok(appAt > chatAt, 'app.js paints only once both layers are defined');

// Deferred scripts keep document order, so the order above is also the
// execution order.
for (const match of html.matchAll(/<script src="\/(?:markdown-renderer|chat-markdown)\.js"([^>]*)>/g)) {
  assert.ok(match[1].includes('defer'), 'markdown scripts are deferred like the rest of the shell');
}

console.log('chat markdown bootstrap order: ok');
