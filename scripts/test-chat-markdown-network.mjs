import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/chat-markdown.css', import.meta.url), 'utf8');

assert.doesNotMatch(source, /\bfetch\s*\(/);
assert.doesNotMatch(source, /\bXMLHttpRequest\b/);
assert.doesNotMatch(source, /\bWebSocket\b/);
assert.doesNotMatch(source, /document\.cookie/);
assert.doesNotMatch(source, /localStorage/);
assert.doesNotMatch(source, /sessionStorage/);
assert.doesNotMatch(source, /Authorization/);
assert.doesNotMatch(source, /Bearer\s+/);
assert.doesNotMatch(source, /\.src\s*=/);
assert.doesNotMatch(source, /\.srcdoc\s*=/);
assert.doesNotMatch(source, /iframe/);
assert.doesNotMatch(source, /script\s*=|createElement\(['"]script/);
assert.match(source, /new URL\(/);
assert.match(source, /SAFE_PROTOCOLS/);
assert.match(source, /noopener noreferrer nofollow/);
assert.match(css, /overflow:auto/);

console.log('test-chat-markdown-network: ok');
