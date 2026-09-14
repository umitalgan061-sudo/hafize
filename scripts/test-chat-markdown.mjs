import assert from 'node:assert/strict';
import { LIMITS, SAFE_PROTOCOLS, parseMarkdown, scanInline, safeLinkHref, normalizeLanguage, splitTableRow } from '../public/chat-markdown.js';

assert.deepEqual(SAFE_PROTOCOLS, ['http:', 'https:', 'mailto:']);
assert.equal(normalizeLanguage(' JavaScript '), 'javascript');
assert.equal(normalizeLanguage('bad lang!'), '');
assert.equal(normalizeLanguage(''), '');
assert.ok(LIMITS.maxInput >= 64_000);

const blocks = parseMarkdown('# Başlık\n\nMetin **kalın**, *eğik*, ~~silindi~~ ve `kod`.');
assert.equal(blocks[0].type, 'heading');
assert.equal(blocks[0].level, 1);
assert.equal(blocks[1].type, 'paragraph');
assert.deepEqual(blocks[1].spans.map((x) => x.type), ['text', 'strong', 'text', 'emphasis', 'text', 'strike', 'text', 'code', 'text']);

const headings = parseMarkdown('#### dört\n##### beş\n###### altı');
assert.deepEqual(headings.map((x) => x.level), [3, 3, 3]);

const lists = parseMarkdown('- bir\n- iki\n\n4. dört\n5. beş');
assert.equal(lists[0].ordered, false);
assert.equal(lists[0].items.length, 2);
assert.equal(lists[1].ordered, true);
assert.equal(lists[1].start, 4);

const tasks = parseMarkdown('- [x] tamam\n- [ ] bekliyor');
assert.equal(tasks[0].items[0].task, true);
assert.equal(tasks[0].items[0].checked, true);
assert.equal(tasks[0].items[1].checked, false);

const quote = parseMarkdown('> bir\n> iki');
assert.equal(quote[0].type, 'quote');
assert.equal(quote[0].spans[0].text, 'bir iki');
assert.equal(parseMarkdown('***')[0].type, 'rule');

const fenced = parseMarkdown('```js\nconst x = 1;\n```');
assert.equal(fenced[0].type, 'code');
assert.equal(fenced[0].language, 'js');
assert.equal(fenced[0].closed, true);
assert.equal(fenced[0].text, 'const x = 1;');
assert.equal(parseMarkdown('~~~py\nprint(1)\n~~~')[0].language, 'py');
assert.equal(parseMarkdown('```js\nx').at(0).closed, false);

const table = parseMarkdown('| Ad | Sayı |\n| :--- | ---: |\n| A | 1 |\n| B | 2 |');
assert.equal(table[0].type, 'table');
assert.deepEqual(table[0].headers, ['Ad', 'Sayı']);
assert.deepEqual(table[0].align, ['left', 'right']);
assert.deepEqual(table[0].rows[1], ['B', '2']);
assert.deepEqual(splitTableRow('| a | `b|c` |'), ['a', '`b|c`']);

const links = scanInline('[güvenli](https://example.com/a) https://example.org **b** _i_');
assert.equal(links.filter((x) => x.type === 'link').length, 2);
assert.equal(safeLinkHref('javascript:alert(1)'), '');
assert.equal(safeLinkHref('data:text/html,test'), '');
assert.equal(safeLinkHref('/relative'), '');
assert.equal(safeLinkHref('mailto:test@example.com').startsWith('mailto:'), true);
assert.equal(safeLinkHref('https://example.com/space here'), '');

const hostile = parseMarkdown('<img src=x onerror=alert(1)>');
assert.equal(hostile[0].spans[0].type, 'text');
const long = parseMarkdown('x'.repeat(LIMITS.maxInput + 20));
assert.ok(long.length <= LIMITS.maxBlocks);
const veryLongLine = scanInline('*'.repeat(LIMITS.maxInline + 20));
assert.equal(veryLongLine[0].type, 'text');

console.log('test-chat-markdown: ok');
