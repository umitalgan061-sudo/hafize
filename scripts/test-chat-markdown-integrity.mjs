import assert from 'node:assert/strict';
import { parseMarkdown, scanInline, safeLinkHref } from '../public/chat-markdown.js';

const answer = parseMarkdown('# Başlık\n\n- madde\n\n```js\nconst x = 1;\n```\n\n| A | B |\n| --- | --- |\n| x | y |');
assert.deepEqual(answer.map((item) => item.type), ['heading', 'list', 'code', 'table']);
assert.equal(answer[0].level, 1);
assert.equal(answer[1].items.length, 1);
assert.equal(answer[2].language, 'js');
assert.equal(answer[3].rows[0][1], 'y');

const inline = scanInline('**güçlü** `kod` [site](https://example.com)');
assert.equal(inline.some((item) => item.type === 'strong'), true);
assert.equal(inline.some((item) => item.type === 'code'), true);
assert.equal(inline.some((item) => item.type === 'link'), true);

for (const url of ['javascript:1', 'data:text/plain,x', 'vbscript:1', 'ftp://x']) assert.equal(safeLinkHref(url), '');
assert.ok(safeLinkHref('https://example.com'));
assert.ok(safeLinkHref('mailto:x@example.com'));

const hostile = parseMarkdown('<script>alert(1)</script>');
assert.equal(hostile[0].type, 'paragraph');
assert.equal(hostile[0].spans[0].type, 'text');

console.log('test-chat-markdown-integrity: ok');
