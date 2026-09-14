import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.equal((index.match(/chat-markdown\.css/g) || []).length, 1);
assert.equal((index.match(/chat-markdown\.js/g) || []).length, 1);
assert.equal((sw.match(/chat-markdown\.css/g) || []).length, 1);
assert.equal((sw.match(/chat-markdown\.js/g) || []).length, 1);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v24`/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
assert.match(sw, /return 'network-only'/);
assert.match(sw, /shouldDeleteCache/);
assert.match(sw, /cacheName !== CURRENT_CACHE/);

const shell = sw.slice(sw.indexOf('SHELL_ASSETS'), sw.indexOf('const SHELL_PATHS'));
assert.match(shell, /'\/chat-markdown\.css'/);
assert.match(shell, /'\/chat-markdown\.js'/);

console.log('test-chat-markdown-pwa-contract: ok');
