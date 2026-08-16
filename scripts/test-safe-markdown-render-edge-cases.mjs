import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/safe-markdown-render.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {}, URL, Set });
const api = module.exports;

assert.deepEqual(api.parseBlocks(''), []);
assert.deepEqual(api.parseBlocks('\n\n'), []);
assert.equal(api.parseBlocks('### Üç')[0].level, 3);
assert.equal(api.parseBlocks('#### düz')[0].type, 'paragraph');
assert.equal(api.parseBlocks('---')[0].type, 'hr');
assert.equal(api.parseBlocks('normal\nsatır')[0].text, 'normal\nsatır');

for (const unsafe of [
  'javascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'blob:https://example.com/id',
  'file:///tmp/x'
]) assert.equal(api.safeHref(unsafe), null);

for (const safe of ['https://openai.com/a?b=1', 'http://example.com', 'mailto:a@b.com']) {
  assert.ok(api.safeHref(safe));
}

const mixed = api.parseBlocks('metin\n\n* italik*\n\n> q\n\n```\n<div>literal</div>\n```');
assert.deepEqual(mixed.map((x) => x.type), ['paragraph', 'list', 'quote', 'code']);
assert.equal(mixed.at(-1).lines[0], '<div>literal</div>');

assert.match(source, /createElement\('a'\)/);
assert.match(source, /createTextNode/);
assert.match(source, /textContent =/);
assert.doesNotMatch(source, /DOMParser/);
assert.doesNotMatch(source, /Range\(\)/);
assert.doesNotMatch(source, /setAttribute\(['"](?:on|srcdoc)/);
assert.doesNotMatch(source, /WebSocket/);
assert.doesNotMatch(source, /XMLHttpRequest/);
assert.doesNotMatch(source, /sendBeacon/);
assert.doesNotMatch(source, /indexedDB/);
assert.doesNotMatch(source, /navigator\.clipboard/);

console.log('safe markdown edge cases ok');