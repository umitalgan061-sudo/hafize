// The markdown assets are part of the HTML shell, and their order decides
// whether the very first assistant answer is already painted as markdown:
// the stylesheet is in <head>, the renderer defines the parser the chat layer
// consumes, and both precede app.js, which does the painting.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('public/index.html', 'utf8');

const headEnd = html.indexOf('</head>');
const styleAt = html.indexOf('<link rel="stylesheet" href="/chat-markdown.css" />');
assert.ok(styleAt >= 0, 'the stylesheet is linked');
assert.ok(styleAt < headEnd, 'the stylesheet is linked from <head>, so answers never paint unstyled');

const scripts = [...html.matchAll(/<script src="(\/[^"]+)"([^>]*)>/g)];
const positionOf = (src) => scripts.findIndex((match) => match[1] === src);
const rendererAt = positionOf('/markdown-renderer.js');
const chatAt = positionOf('/chat-markdown.js');
const appAt = positionOf('/app.js');

assert.ok(rendererAt >= 0, 'the renderer is loaded');
assert.ok(rendererAt < chatAt, 'the renderer is defined before the chat layer that uses it');
assert.ok(chatAt < appAt, 'both are defined before app.js, which paints the messages');

for (const src of ['/markdown-renderer.js', '/chat-markdown.js']) {
  assert.ok(scripts[positionOf(src)][2].includes('defer'), `${src} is deferred like the rest of the shell`);
}

console.log('chat markdown bootstrap order: ok');
