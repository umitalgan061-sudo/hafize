import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/safe-markdown-render.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, URL, Set });
const api = module.exports;

assert.equal(api.normalizedSource('a\r\nb\rc'), 'a\nb\nc');
assert.equal(api.normalizedSource('x'.repeat(api.MAX_SOURCE_CHARS + 1)), null);
assert.match(api.safeHref('https://example.com'), /^https:\/\/example\.com/);
assert.match(api.safeHref('mailto:test@example.com'), /^mailto:/);
assert.equal(api.safeHref('javascript:alert(1)'), null);
assert.equal(api.safeHref('data:text/html,boom'), null);
assert.equal(api.safeHref('file:///etc/passwd'), null);

const blocks = api.parseBlocks('# Başlık\n\n- bir\n- iki\n\n```js\nconst x = 1;\n```\n\n> alıntı');
assert.deepEqual(blocks.map((item) => item.type), ['heading', 'list', 'code', 'quote']);
assert.equal(blocks[0].level, 1);
assert.equal(blocks[1].ordered, false);
assert.deepEqual(blocks[1].items, ['bir', 'iki']);
assert.equal(blocks[2].language, 'js');
assert.deepEqual(blocks[2].lines, ['const x = 1;']);

const ordered = api.parseBlocks('1. bir\n2. iki');
assert.equal(ordered[0].type, 'list');
assert.equal(ordered[0].ordered, true);
assert.deepEqual(ordered[0].items, ['bir', 'iki']);

const unclosed = api.parseBlocks('```txt\na\nb');
assert.equal(unclosed[0].type, 'code');
assert.deepEqual(unclosed[0].lines, ['a', 'b']);

assert.ok(!source.includes('innerHTML'));
assert.ok(!source.includes('insertAdjacentHTML'));
assert.ok(!source.includes('eval('));
assert.ok(!source.includes('new Function'));
assert.ok(!source.includes('fetch('));
assert.ok(!source.includes('localStorage'));
assert.ok(!source.includes('sessionStorage'));
assert.ok(!source.includes('document.cookie'));
assert.ok(!source.includes('requestSubmit'));
assert.ok(!source.includes('.click()'));
assert.match(source, /noopener noreferrer/);
assert.match(source, /\.message\.assistant \.content/);
assert.doesNotMatch(source, /\.message\.user \.content/);

const loader = fs.readFileSync(new URL('../public/chat-run-controller.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');
assert.match(loader, /HafizeSafeMarkdown/);
assert.match(loader, /\/safe-markdown-render\.js/);
assert.match(sw, /hafize-shell-v34/);
assert.match(sw, /'\/safe-markdown-render\.js'/);
assert.match(sw, /pathname\.startsWith\('\/api\/'\).*network-only/s);

console.log('safe markdown renderer contract ok');