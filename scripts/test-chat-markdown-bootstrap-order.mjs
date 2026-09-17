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

// index.html now carries the same three assets as static tags, so the fallback
// bootstrap must skip anything the document already loaded instead of fetching
// and evaluating a second copy of the renderer.
assert.match(source, /alreadyInDocument\(`link\[href="\$\{STYLE\}"\]`\)/, 'the stylesheet is skipped when the page already links it');
assert.match(source, /alreadyInDocument\(`script\[src="\$\{src\}"\]`\)/, 'a script already in the document is never injected twice');

console.log('chat markdown bootstrap order: ok');
