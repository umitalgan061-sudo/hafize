import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/chat-markdown.js', import.meta.url), 'utf8');
const install = source.slice(source.indexOf('function install'), source.lastIndexOf('return Object.freeze'));

assert.match(install, /querySelector\('\#messages'\)/);
assert.match(install, /markdownObserverInstalled/);
assert.match(install, /observer\.observe\(messages/);
assert.match(install, /subtree: true/);
assert.match(install, /childList: true/);
assert.match(install, /characterData: true/);
assert.match(install, /disconnect\(\)/);
assert.match(install, /markdownWriting/);
assert.match(install, /markdownSource/);
assert.match(install, /queueMicrotask/);

assert.equal((source.match(/new MutationObserver/g) || []).length, 1);
assert.equal((source.match(/observer\.disconnect/g) || []).length, 1);
assert.equal((source.match(/messages\.addEventListener\('click'/g) || []).length, 1);

console.log('test-chat-markdown-observer: ok');
