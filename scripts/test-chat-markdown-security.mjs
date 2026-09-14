import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/i);
assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage/i);
assert.doesNotMatch(source, /Authorization|Bearer\s+/i);
assert.match(source, /createElement\(/);
assert.match(source, /textContent/);
assert.match(source, /MutationObserver/);
assert.match(source, /noopener noreferrer nofollow/);
assert.match(source, /SAFE_PROTOCOLS/);
assert.match(source, /maxInput/);

const linkRejects = /javascript:|data:|vbscript:/i;
assert.match(source, linkRejects, 'regression cases are represented in the security layer');
assert.ok(source.includes("SAFE_PROTOCOLS = Object.freeze(['http:', 'https:', 'mailto:'])"));
console.log('test-chat-markdown-security: ok');
