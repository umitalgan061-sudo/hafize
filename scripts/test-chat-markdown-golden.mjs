import assert from 'node:assert/strict';
import { parseMarkdown, scanInline } from '../public/chat-markdown.js';

const fixtures = [
  { input: 'Düz metin', block: 'paragraph' },
  { input: '# Ana başlık', block: 'heading' },
  { input: '## Alt başlık', block: 'heading' },
  { input: '### Alt alt başlık', block: 'heading' },
  { input: '- madde', block: 'list' },
  { input: '1. madde', block: 'list' },
  { input: '> alıntı', block: 'quote' },
  { input: '---', block: 'rule' },
  { input: '```js\nconst a = 1;\n```', block: 'code' },
  { input: '| A | B |\n| --- | --- |\n| 1 | 2 |', block: 'table' }
];
for (const fixture of fixtures) assert.equal(parseMarkdown(fixture.input)[0]?.type, fixture.block, fixture.input);

const rich = parseMarkdown([
  '# Başlık',
  '',
  'Özet: **kalın**, *eğik*, `kod`, ~~eski~~ ve [bağlantı](https://example.com).',
  '',
  '- birinci',
  '- ikinci',
  '',
  '> kaynak',
  '',
  '```js',
  'const answer = 42;',
  '```',
  '',
  '| Alan | Değer |',
  '| :--- | ---: |',
  '| model | NIM |'
].join('\n'));
assert.equal(rich.length, 6);
assert.equal(rich[0].level, 1);
assert.equal(rich[1].spans.some((x) => x.type === 'strong'), true);
assert.equal(rich[1].spans.some((x) => x.type === 'emphasis'), true);
assert.equal(rich[1].spans.some((x) => x.type === 'code'), true);
assert.equal(rich[1].spans.some((x) => x.type === 'strike'), true);
assert.equal(rich[1].spans.some((x) => x.type === 'link'), true);
assert.equal(rich[2].items.length, 2);
assert.equal(rich[3].spans[0].text, 'kaynak');
assert.equal(rich[4].language, 'js');
assert.equal(rich[5].rows[0][1], 'NIM');

const inline = scanInline('A [link](https://example.com) B');
assert.deepEqual(inline.map((x) => x.type), ['text', 'link', 'text']);
assert.equal(inline[1].href, 'https://example.com/');

console.log('test-chat-markdown-golden: ok');
