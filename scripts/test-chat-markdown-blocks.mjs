// Block-level parsing contract for rendered assistant answers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.ts');

const parse = (source) => markdown.parseMarkdown(source).blocks;
const types = (source) => parse(source).map((block) => block.type);

/* Headings ------------------------------------------------------------ */

assert.deepEqual(types('# Başlık'), ['heading']);
assert.equal(parse('### Üçüncü')[0].level, 3);
assert.equal(parse('####### Yedi diyez')[0].type, 'paragraph', 'seven hashes is not a heading');
assert.equal(parse('#Boşluksuz')[0].type, 'paragraph', 'a heading needs a space after the hashes');
assert.equal(parse('## Kapanışlı ##')[0].inline[0].value, 'Kapanışlı', 'closing hashes are stripped');
assert.equal(parse('   ## Üç boşluk')[0].type, 'heading');
assert.equal(parse('    # Dört boşluk')[0].type, 'paragraph', 'four spaces is no longer a heading');

/* Paragraphs ---------------------------------------------------------- */

const paragraphs = parse('ilk paragraf\nikinci satır\n\nayrı paragraf');
assert.deepEqual(paragraphs.map((block) => block.type), ['paragraph', 'paragraph']);
assert.deepEqual(
  paragraphs[0].inline.map((node) => node.type),
  ['text', 'break', 'text'],
  'a single newline inside a paragraph is a visible line break in chat'
);

/* Fenced code --------------------------------------------------------- */

const fenced = parse('```js\nconst x = 1;\nconst y = 2;\n```');
assert.equal(fenced[0].type, 'code');
assert.equal(fenced[0].language, 'js');
assert.equal(fenced[0].text, 'const x = 1;\nconst y = 2;');
assert.equal(fenced[0].closed, true);

assert.equal(parse('~~~python\nprint(1)\n~~~')[0].language, 'python');
assert.equal(parse('```\nplain\n```')[0].language, '', 'a fence without an info string has no language');
assert.equal(
  parse('```" onload="alert(1)\nkod\n```')[0].language,
  '',
  'an info string that is not a plain identifier is dropped'
);
assert.equal(
  parse('````\n```\niç fence\n```\n````')[0].text,
  '```\niç fence\n```',
  'a longer fence contains shorter ones'
);
assert.equal(
  parse('```js\n# başlık değil\n- liste değil\n```')[0].text,
  '# başlık değil\n- liste değil',
  'markdown inside a code block stays literal'
);
const indentedFence = parse('  ```\n  gövde\n  ```');
assert.equal(indentedFence[0].type, 'code');
assert.equal(indentedFence[0].text, 'gövde', 'the opening indentation is removed from the body');

/* Dividers ------------------------------------------------------------ */

for (const divider of ['---', '***', '___', '- - -', '* * *']) {
  assert.deepEqual(types(divider), ['divider'], `${divider} is a divider`);
}
assert.equal(parse('--')[0].type, 'paragraph', 'two dashes are not a divider');

/* Quotes -------------------------------------------------------------- */

const quote = parse('> ilk\n> ikinci\n\ndışarıda');
assert.deepEqual(quote.map((block) => block.type), ['quote', 'paragraph']);
assert.equal(quote[0].blocks[0].type, 'paragraph');
assert.equal(parse('> tembel\ndevam')[0].blocks[0].inline.at(-1).value, 'devam', 'lazy continuation stays in the quote');
assert.equal(parse('> dış\n> > iç')[0].blocks.at(-1).type, 'quote', 'quotes nest');
assert.equal(parse('> - madde')[0].blocks[0].type, 'list', 'a quote can hold a list');

/* Lists --------------------------------------------------------------- */

const bullets = parse('- bir\n- iki\n- üç')[0];
assert.equal(bullets.type, 'list');
assert.equal(bullets.ordered, false);
assert.equal(bullets.items.length, 3);
assert.equal(bullets.tight, true);

assert.equal(parse('- bir\n\n- iki')[0].tight, false, 'a blank line between items makes the list loose');
assert.equal(parse('- bir\n- iki\n\nparagraf')[0].tight, true, 'a blank line before other content does not');

const ordered = parse('3. üç\n4. dört')[0];
assert.equal(ordered.ordered, true);
assert.equal(ordered.start, 3, 'an ordered list keeps its starting number');
assert.equal(parse('1) bir\n2) iki')[0].items.length, 2, 'the `)` delimiter is supported');
assert.equal(parse('- yıldız\n* farklı')[0].items.length, 1, 'a different bullet starts a new list');

const nested = parse('- dış\n  - iç\n  - iç iki\n- dış iki')[0];
assert.equal(nested.items.length, 2);
assert.equal(nested.items[0].blocks.at(-1).type, 'list');
assert.equal(nested.items[0].blocks.at(-1).items.length, 2);

const itemWithCode = parse('- madde\n\n  ```js\n  kod\n  ```')[0];
assert.equal(itemWithCode.items[0].blocks.at(-1).type, 'code', 'an item can carry a code block');

assert.equal(
  parse('- birinci\n  devam satırı')[0].items[0].blocks[0].inline.at(-1).value,
  'devam satırı',
  'an indented continuation line belongs to the item'
);

assert.equal(parse('-')[0].type, 'list', 'an empty bullet is still a list');
assert.equal(parse('5.madde')[0].type, 'paragraph', 'a marker needs a space after it');

/* Tables -------------------------------------------------------------- */

const table = parse('| Ad | Sayı |\n| :-- | --: |\n| a | 1 |\n| b | 2 |')[0];
assert.equal(table.type, 'table');
assert.deepEqual(table.align, ['left', 'right']);
assert.equal(table.header.length, 2);
assert.equal(table.rows.length, 2);
assert.equal(table.rows[1][1][0].value, '2');

assert.deepEqual(parse('a | b\n--- | :-:\n1 | 2')[0].align, ['', 'center'], 'outer pipes are optional');
assert.equal(parse('| a | b |\n| --- |\n| 1 | 2 |')[0].type, 'paragraph', 'a mismatched delimiter row is not a table');
assert.equal(parse('| a | b |\n| 1 | 2 |')[0].type, 'paragraph', 'a table needs its delimiter row');

const shortRow = parse('| a | b |\n| --- | --- |\n| tek |')[0];
assert.equal(shortRow.rows[0].length, 2, 'short rows are padded to the column count');
assert.deepEqual(shortRow.rows[0][1], [], 'the padded cell is empty');

assert.equal(
  parse('| a\\|b | c |\n| --- | --- |\n| 1 | 2 |')[0].header[0][0].value,
  'a|b',
  'an escaped pipe stays inside its cell'
);

const tableAfterParagraph = parse('giriş cümlesi\n\n| a | b |\n| --- | --- |\n| 1 | 2 |');
assert.deepEqual(tableAfterParagraph.map((block) => block.type), ['paragraph', 'table']);
assert.deepEqual(
  parse('giriş\n| a | b |\n| --- | --- |\n| 1 | 2 |').map((block) => block.type),
  ['paragraph', 'table'],
  'a table interrupts a paragraph'
);

/* Mixed document ------------------------------------------------------ */

assert.deepEqual(
  types([
    '# Rapor',
    '',
    'Giriş paragrafı.',
    '',
    '## Adımlar',
    '1. ilk',
    '2. ikinci',
    '',
    '> Not',
    '',
    '```sh',
    'npm run check',
    '```',
    '',
    '---',
    '',
    '| k | v |',
    '| --- | --- |',
    '| a | 1 |'
  ].join('\n')),
  ['heading', 'paragraph', 'heading', 'list', 'quote', 'code', 'divider', 'table']
);

assert.deepEqual(parse(''), []);
assert.deepEqual(parse('   \n\n  \n'), []);
assert.deepEqual(parse(null), []);
assert.deepEqual(parse(undefined), []);

console.log('chat markdown blocks OK: headings, code, quotes, lists, tables and dividers parse as specified');
