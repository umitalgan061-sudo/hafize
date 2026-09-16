// The node tree a rendered answer produces, asserted against a DOM stand-in.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createContainer, createDocument, find, findAll, findAllByClass, findByClass, outline } from './markdown-dom-harness.mjs';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.js');

function render(source) {
  const documentRef = createDocument();
  const container = createContainer(documentRef);
  const result = markdown.renderMarkdownInto(container, source);
  return { container, result };
}

/* Block elements ------------------------------------------------------- */

const basic = render('# Başlık\n\nBir paragraf.');
assert.equal(basic.result.rendered, true);
assert.equal(basic.result.truncated, false);
assert.equal(outline(basic.container), 'div.content h1.md-heading p.md-paragraph');
assert.equal(basic.container.getAttribute('data-md'), 'on');
assert.equal(find(basic.container, 'h1').getAttribute('class'), 'md-heading md-heading-1');
assert.equal(find(basic.container, 'h1').textContent, 'Başlık');

for (const level of [1, 2, 3, 4, 5, 6]) {
  const { container } = render(`${'#'.repeat(level)} x`);
  assert.equal(find(container, `h${level}`)?.tagName, `H${level}`, `level ${level} heading`);
}

const lists = render('- bir\n- iki');
assert.equal(find(lists.container, 'ul').getAttribute('class'), 'md-list md-list-tight');
assert.equal(findAll(lists.container, 'li').length, 2);
assert.equal(findAll(lists.container, 'p').length, 0, 'a tight item holds its text directly');
assert.equal(find(lists.container, 'li').textContent, 'bir');

const looseList = render('- bir\n\n- iki');
assert.equal(findAll(looseList.container, 'p').length, 2, 'a loose item wraps its text in a paragraph');
assert.equal(find(looseList.container, 'ul').getAttribute('class'), 'md-list');

const orderedList = render('4. dört\n5. beş');
assert.equal(find(orderedList.container, 'ol').getAttribute('start'), '4');
assert.equal(render('1. bir').container.childNodes[0].getAttribute('start'), null, 'a list starting at 1 needs no start attribute');

const quote = render('> alıntı');
assert.equal(find(quote.container, 'blockquote').getAttribute('class'), 'md-quote');
assert.equal(find(quote.container, 'blockquote').textContent, 'alıntı');

assert.equal(find(render('---').container, 'hr').getAttribute('class'), 'md-divider');

/* Code blocks ---------------------------------------------------------- */

const code = render('```js\nconst x = 1;\n```');
const block = findByClass(code.container, 'md-code');
assert.ok(block, 'a fenced block renders a code container');
assert.equal(block.getAttribute('data-language'), 'js');
assert.equal(block.getAttribute('data-streaming'), null, 'a closed fence is not marked as streaming');

const label = findByClass(code.container, 'md-code-lang');
assert.equal(label.getAttribute('data-language'), 'js');
assert.equal(label.getAttribute('aria-hidden'), 'true');
assert.equal(label.textContent, '', 'the language label is drawn by CSS, not by a text node');

const copy = findByClass(code.container, 'md-code-copy');
assert.equal(copy.tagName, 'BUTTON');
assert.equal(copy.getAttribute('type'), 'button');
assert.equal(copy.getAttribute('data-md-copy'), 'code');
assert.equal(copy.getAttribute('data-state'), 'idle');
assert.equal(copy.getAttribute('aria-label'), 'Kod bloğunu kopyala');
assert.equal(copy.textContent, '', 'the copy label is drawn by CSS, not by a text node');

assert.equal(find(code.container, 'pre').getAttribute('class'), 'md-code-body');
assert.equal(find(code.container, 'code').textContent, 'const x = 1;');
assert.equal(find(code.container, 'code').getAttribute('data-language'), 'js');

const unlabelled = render('```\nsade\n```');
assert.equal(findByClass(unlabelled.container, 'md-code').getAttribute('data-language'), null);
assert.equal(findByClass(unlabelled.container, 'md-code-lang').getAttribute('data-language'), 'kod', 'the label falls back to a generic word');

/* Tables --------------------------------------------------------------- */

const table = render('| Ad | Sayı |\n| :-- | --: |\n| a | 1 |');
const wrap = findByClass(table.container, 'md-table-wrap');
assert.equal(wrap.getAttribute('role'), 'region');
assert.equal(wrap.getAttribute('tabindex'), '0', 'an overflowing table is reachable by keyboard');
assert.equal(wrap.getAttribute('aria-label'), 'Tablo');

const headers = findAll(table.container, 'th');
assert.equal(headers.length, 2);
assert.equal(headers[0].getAttribute('scope'), 'col');
assert.equal(headers[0].getAttribute('data-align'), 'left');
assert.equal(headers[1].getAttribute('data-align'), 'right');
assert.equal(findAll(table.container, 'td')[1].getAttribute('data-align'), 'right');
assert.equal(findAll(table.container, 'thead').length, 1);
assert.equal(findAll(table.container, 'tbody').length, 1);

/* Inline elements ------------------------------------------------------ */

const inline = render('**kalın** *eğik* ~~çizili~~ `kod` [bağlantı](https://a.b)');
assert.equal(findAll(inline.container, 'strong').length, 1);
assert.equal(findAll(inline.container, 'em').length, 1);
assert.equal(findAll(inline.container, 's').length, 1);
assert.equal(findByClass(inline.container, 'md-inline-code').tagName, 'CODE');
assert.equal(findByClass(inline.container, 'md-link').getAttribute('href'), 'https://a.b');
assert.equal(inline.container.textContent, 'kalın eğik çizili kod bağlantı');

assert.equal(findAll(render('bir\niki').container, 'br').length, 1);

/* Fallbacks ------------------------------------------------------------ */

const plainAnswer = render('Yalnızca düz bir cümle.');
assert.equal(plainAnswer.result.rendered, true);
assert.equal(plainAnswer.container.textContent, 'Yalnızca düz bir cümle.');
assert.equal(outline(plainAnswer.container), 'div.content p.md-paragraph');

const emptyDocument = createDocument();
const emptyContainer = createContainer(emptyDocument);
const empty = markdown.renderMarkdownInto(emptyContainer, '', { placeholder: '…' });
assert.equal(empty.rendered, false);
assert.equal(emptyContainer.textContent, '…');
assert.equal(emptyContainer.getAttribute('data-md'), null, 'a placeholder is not a rendered answer');

assert.deepEqual(markdown.renderMarkdownInto(null, '# x'), { rendered: false, truncated: false, blocks: 0 });
assert.deepEqual(markdown.renderMarkdownInto({}, '# x'), { rendered: false, truncated: false, blocks: 0 });

/* Re-rendering replaces, never appends --------------------------------- */

const reused = createContainer(createDocument());
markdown.renderMarkdownInto(reused, '# ilk\n\nbir\n\niki');
markdown.renderMarkdownInto(reused, '- sadece liste');
assert.equal(findAll(reused, 'h1').length, 0, 'the previous render is gone');
assert.equal(findAll(reused, 'li').length, 1);
assert.equal(reused.textContent, 'sadece liste');

markdown.renderPlainInto(reused, 'düz metin');
assert.equal(reused.textContent, 'düz metin');
assert.equal(reused.getAttribute('data-md'), null, 'a plain repaint clears the rendered marker');
assert.equal(findAll(reused, 'li').length, 0);
assert.equal(markdown.sourceFor(reused), 'düz metin');

/* The source behind a render stays retrievable ------------------------- */

const sourceContainer = createContainer(createDocument());
const answer = '# Başlık\n\n- **kalın** madde';
markdown.renderMarkdownInto(sourceContainer, answer);
assert.equal(markdown.sourceFor(sourceContainer), answer, 'copy actions get the markdown the model wrote');
assert.equal(markdown.sourceFor(createContainer(createDocument())), '');

/* Plain-text projection ------------------------------------------------ */

assert.equal(markdown.toPlainText('# Başlık\n\nParagraf.'), 'Başlık\n\nParagraf.');
assert.equal(markdown.toPlainText('- bir\n- iki'), 'bir\niki');
assert.equal(markdown.toPlainText('1. bir\n2. iki'), '1. bir\n2. iki');
assert.equal(markdown.toPlainText('**kalın** ve `kod`'), 'kalın ve kod');
assert.equal(markdown.toPlainText('[etiket](https://a.b)'), 'etiket');
assert.equal(markdown.toPlainText('<https://a.b>'), 'https://a.b');
assert.equal(markdown.toPlainText('| a | b |\n| --- | --- |\n| 1 | 2 |'), 'a · b\n1 · 2');
assert.equal(markdown.toPlainText('```js\nkod\n```'), 'kod');
assert.equal(markdown.toPlainText(''), '');
assert.equal(markdown.toPlainText(null), '');
assert.equal(
  markdown.toPlainText('# Bir\n\nİki\n\n## Üç'),
  'Bir\n\nİki\n\nÜç',
  'blocks stay separated, which DOM textContent would not do'
);

/* hasMarkdown ---------------------------------------------------------- */

assert.equal(markdown.hasMarkdown('düz cümle'), false);
assert.equal(markdown.hasMarkdown(''), false);
assert.equal(markdown.hasMarkdown(null), false);
for (const sample of ['# h', '- a', '1. a', '> q', '```', '**a**', '`a`', '[a](https://b.c)', 'https://a.b', '| a |']) {
  assert.equal(markdown.hasMarkdown(sample), true, `hasMarkdown detects ${JSON.stringify(sample)}`);
}

console.log('chat markdown DOM OK: block, code, table and inline nodes render with the expected structure');
