import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(index, /href="\/chat-markdown\.css"/);
assert.match(index, /src="\/chat-markdown\.js"/);
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v24`/);
assert.match(sw, /'\/chat-markdown\.css'/);
assert.match(sw, /'\/chat-markdown\.js'/);
assert.doesNotMatch(sw, /\/api\//);
console.log('test-chat-markdown-pwa: ok');
