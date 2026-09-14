import assert from 'node:assert/strict';
import { parseMarkdown, scanInline } from '../public/chat-markdown.js';

function firstType(value) { return parseMarkdown(value)[0]?.type; }
assert.equal(firstType('normal'), 'paragraph');
assert.equal(firstType('# başlık'), 'heading');
assert.equal(firstType('- madde'), 'list');
assert.equal(firstType('1. madde'), 'list');
assert.equal(firstType('> not'), 'quote');
assert.equal(firstType('---'), 'rule');
assert.equal(firstType('```js\nx\n```'), 'code');
assert.equal(firstType('| A | B |\n| --- | --- |\n| x | y |'), 'table');

const reply = parseMarkdown([
  '# Sonuç',
  '',
  'İşlem tamamlandı. **Durum:** başarılı.',
  '',
  '- Birinci',
  '- İkinci',
  '',
  '```json',
  '{"ok":true}',
  '```'
].join('\n'));
assert.equal(reply.length, 4);
assert.equal(reply[0].level, 1);
assert.equal(reply[1].spans.some((x) => x.type === 'strong'), true);
assert.equal(reply[2].items.length, 2);
assert.equal(reply[3].language, 'json');

const linkReply = scanInline('Kaynak: https://example.com ve [ana](https://example.org).');
assert.equal(linkReply.filter((x) => x.type === 'link').length, 2);

const unsafeReply = scanInline('[zararlı](data:text/html,hello)');
assert.equal(unsafeReply.some((x) => x.type === 'link'), false);

const codeReply = parseMarkdown('```\n<svg onload=alert(1)>\n```');
assert.equal(codeReply[0].type, 'code');
assert.match(codeReply[0].text, /onload/);

const tableReply = parseMarkdown('| Model | Durum |\n| --- | --- |\n| NVIDIA | hazır |');
assert.equal(tableReply[0].rows[0][0], 'NVIDIA');
assert.equal(tableReply[0].rows[0][1], 'hazır');

const taskReply = parseMarkdown('- [x] tamam\n- [ ] sonra');
assert.deepEqual(taskReply[0].items.map((x) => x.checked), [true, false]);

console.log('test-chat-markdown-regression: ok');
