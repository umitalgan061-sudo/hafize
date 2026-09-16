// The bootstrap must load CSS, renderer, then chat layer in that order.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions-enhancements.js', 'utf8');
const styleAt = source.indexOf("const STYLE = '/chat-markdown.css'");
const rendererAt = source.indexOf("const RENDERER = '/markdown-renderer.js'");
const chatAt = source.indexOf("const CHAT = '/chat-markdown.js'");
assert.ok(styleAt >= 0 && rendererAt > styleAt && chatAt > rendererAt);
assert.match(source, /loadScript\(RENDERER, \(\) => loadScript\(CHAT\)\)/);
assert.match(source, /loaded\.has\(src\)/);

console.log('chat markdown bootstrap order: ok');
