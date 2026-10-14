// Bounds and adversarial input: a runaway or hostile answer must degrade to
// readable text in bounded time, never hang the tab and never throw.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createContainer, createDocument, findAll } from './markdown-dom-harness.mjs';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.ts');
const { LIMITS } = markdown;

const BUDGET_MS = 1500;

function timed(label, run) {
  const started = Date.now();
  const value = run();
  const elapsed = Date.now() - started;
  assert.ok(elapsed < BUDGET_MS, `${label} finished in ${elapsed}ms, budget ${BUDGET_MS}ms`);
  return value;
}

assert.ok(Object.isFrozen(LIMITS), 'limits are not reconfigurable at runtime');
for (const [name, value] of Object.entries(LIMITS)) {
  assert.ok(Number.isInteger(value) && value > 0, `${name} is a positive integer`);
}

/* Length and line caps -------------------------------------------------- */

const overLong = `${'a'.repeat(LIMITS.MAX_SOURCE_LENGTH + 500)}`;
const longResult = timed('over-long answer', () => markdown.parseMarkdown(overLong));
assert.equal(longResult.truncated, true);
assert.ok(longResult.blocks.length >= 1);

const manyLines = timed('over-many lines', () => markdown.parseMarkdown('satır\n\n'.repeat(LIMITS.MAX_LINES)));
assert.equal(manyLines.truncated, true);
assert.ok(manyLines.blocks.length <= LIMITS.MAX_BLOCKS, 'the block cap holds');

const manyBlocks = timed('over-many blocks', () => markdown.parseMarkdown('# b\n\n'.repeat(LIMITS.MAX_BLOCKS + 50)));
assert.equal(manyBlocks.truncated, true);
assert.ok(manyBlocks.blocks.length <= LIMITS.MAX_BLOCKS);

const manyItems = timed('over-many list items', () => markdown.parseMarkdown('- madde\n'.repeat(LIMITS.MAX_LIST_ITEMS + 40)));
assert.equal(manyItems.blocks[0].items.length, LIMITS.MAX_LIST_ITEMS);
assert.equal(manyItems.truncated, true);

const wideTable = timed('over-wide table', () => {
  const columns = LIMITS.MAX_TABLE_COLUMNS + 4;
  const row = `|${' x |'.repeat(columns)}`;
  const delimiter = `|${' --- |'.repeat(columns)}`;
  return markdown.parseMarkdown(`${row}\n${delimiter}\n${row}`);
});
assert.equal(wideTable.blocks[0].type, 'paragraph', 'a table past the column cap is not built at all');

const tallTable = timed('over-tall table', () => markdown.parseMarkdown(
  `| a | b |\n| --- | --- |\n${'| 1 | 2 |\n'.repeat(LIMITS.MAX_TABLE_ROWS + 30)}`
));
assert.equal(tallTable.blocks[0].rows.length, LIMITS.MAX_TABLE_ROWS);
assert.equal(tallTable.truncated, true);

/* Nesting --------------------------------------------------------------- */

const deepQuotes = timed('deep quotes', () => markdown.parseMarkdown(`${'> '.repeat(60)}dip`));
let depth = 0;
let cursor = deepQuotes.blocks[0];
while (cursor?.type === 'quote') {
  depth += 1;
  cursor = cursor.blocks[0];
}
assert.ok(depth <= LIMITS.MAX_BLOCK_DEPTH + 1, `quote nesting stops at the cap, saw ${depth}`);
assert.ok(markdown.toPlainText(`${'> '.repeat(60)}dip`).includes('dip'), 'the deepest text survives');

const deepLists = timed('deep lists', () => markdown.parseMarkdown(
  Array.from({ length: 40 }, (unused, level) => `${' '.repeat(level * 2)}- seviye ${level}`).join('\n')
));
assert.equal(deepLists.blocks[0].type, 'list');
assert.ok(markdown.toPlainText(
  Array.from({ length: 40 }, (unused, level) => `${' '.repeat(level * 2)}- seviye ${level}`).join('\n')
).includes('seviye 39'), 'the deepest item survives');

const deepEmphasis = timed('deep emphasis', () => markdown.parseInline(`${'*'.repeat(40)}x${'*'.repeat(40)}`));
assert.ok(Array.isArray(deepEmphasis));

const deepLinks = timed('deep link labels', () => markdown.parseInline(`${'['.repeat(200)}x${']'.repeat(200)}(https://a.b)`));
assert.ok(Array.isArray(deepLinks));

/* Pathological delimiter soup ------------------------------------------- */

const SOUP = [
  '*'.repeat(3000),
  '_'.repeat(3000),
  '`'.repeat(3000),
  '~'.repeat(3000),
  '['.repeat(1500),
  '!['.repeat(1500),
  '>'.repeat(3000),
  '|'.repeat(3000),
  '#'.repeat(3000),
  '- '.repeat(1500),
  '```'.repeat(600),
  `${'*a'.repeat(1200)}*`,
  `${'['.repeat(400)}x${']('.repeat(400)}`,
  `${'`'.repeat(200)}kod`,
  'https://a.b/'.repeat(600)
];
for (const soup of SOUP) {
  timed(`delimiter soup ${soup.slice(0, 6)}…`, () => {
    const container = createContainer(createDocument());
    markdown.renderMarkdownInto(container, soup);
    return container;
  });
}

/* Unicode and control characters ---------------------------------------- */

const unicode = markdown.parseMarkdown('**şğüöçİI** ve 😀 ve \u0000NUL');
assert.equal(unicode.blocks[0].type, 'paragraph');
assert.equal(markdown.normalizeSource('a\u0000b'), 'a\uFFFDb', 'NUL never reaches the DOM');
assert.equal(markdown.normalizeSource('a\r\nb'), 'a\nb');
assert.equal(markdown.normalizeSource('a\rb'), 'a\nb');
assert.equal(markdown.normalizeSource('a\tb'), 'a    b', 'tabs become spaces so indentation rules are predictable');
assert.equal(markdown.normalizeSource(42), '');
assert.equal(markdown.normalizeSource(null), '');

const rtl = createContainer(createDocument());
markdown.renderMarkdownInto(rtl, '- عنصر\n- **غامق**');
assert.equal(findAll(rtl, 'li').length, 2, 'right-to-left text parses like any other');

/* Non-string and object input ------------------------------------------- */

for (const value of [null, undefined, 0, 42, true, {}, [], () => {}, Symbol.iterator]) {
  const container = createContainer(createDocument());
  const result = markdown.renderMarkdownInto(container, value, { placeholder: '…' });
  assert.equal(result.rendered, false, `${String(value)} is not rendered as markdown`);
  assert.equal(container.textContent, '…');
}

/* A truncated answer is flagged, not silently shortened ------------------ */

const truncated = createContainer(createDocument());
const truncatedResult = markdown.renderMarkdownInto(truncated, '# b\n\n'.repeat(LIMITS.MAX_BLOCKS + 10));
assert.equal(truncatedResult.truncated, true);
assert.equal(truncated.getAttribute('data-md'), 'truncated', 'the CSS notice hangs off this marker');

console.log('chat markdown limits OK: every bound degrades to readable text inside the time budget');
