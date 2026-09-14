import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const install = source.slice(source.indexOf('function install'));

assert.match(install, /let queued = false/);
assert.match(install, /if \(queued\) return/);
assert.match(install, /queued = true/);
assert.match(install, /queued = false/);
assert.match(install, /queueMicrotask\(scan\)/);
assert.match(install, /markdownWriting === 'true'/);
assert.match(install, /markdownSource === source/);

const observerOptions = install.slice(install.indexOf('observer.observe'), install.indexOf('messages.addEventListener'));
assert.match(observerOptions, /subtree: true/);
assert.match(observerOptions, /childList: true/);
assert.match(observerOptions, /characterData: true/);

console.log('test-chat-markdown-batching: ok');
