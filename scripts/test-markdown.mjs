import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown.js');
const { parseMarkdown, parseInline, renderMarkdown } = markdown;

// --- block parsing -------------------------------------------------------

const doc = parseMarkdown('# Başlık\n\nBir paragraf.\n\n- bir\n- iki\n');
assert.deepEqual(doc.map((block) => block.type), ['heading', 'paragraph', 'list']);
assert.equal(doc[0].level, 1);
assert.equal(doc[2].ordered, false);
assert.equal(doc[2].items.length, 2);

assert.equal(parseMarkdown('###### altı').at(0).level, 6);
assert.equal(parseMarkdown('####### yedi').at(0).type, 'paragraph', 'seven hashes is not a heading');

const ordered = parseMarkdown('3. üç\n4. dört');
assert.equal(ordered[0].ordered, true);
assert.equal(ordered[0].start, 3);

// Consecutive lines join into one paragraph; a blank line starts a new one.
const paragraphs = parseMarkdown('bir\niki\n\núç');
assert.equal(paragraphs.length, 2);
assert.equal(paragraphs[0].spans[0].value, 'bir iki');

assert.equal(parseMarkdown('> alıntı\n> devam').at(0).type, 'quote');
assert.equal(parseMarkdown('---').at(0).type, 'rule');
assert.equal(parseMarkdown('').length, 0);

// --- fenced code ---------------------------------------------------------

const fenced = parseMarkdown('```js\nconst x = 1;\n```');
assert.equal(fenced[0].type, 'code');
assert.equal(fenced[0].language, 'js');
assert.equal(fenced[0].value, 'const x = 1;');
assert.equal(fenced[0].closed, true);

// Mid-stream the closing fence has not arrived yet; the block must still render.
const streaming = parseMarkdown('```py\nprint(1)');
assert.equal(streaming[0].type, 'code');
assert.equal(streaming[0].closed, false);
assert.equal(streaming[0].value, 'print(1)');

// Markdown inside a fence stays literal.
const literal = parseMarkdown('```\n# not a heading\n- not a list\n```');
assert.equal(literal.length, 1);
assert.equal(literal[0].value, '# not a heading\n- not a list');

// --- inline --------------------------------------------------------------

assert.deepEqual(parseInline('**kalın**'), [{ type: 'strong', value: 'kalın' }]);
assert.deepEqual(parseInline('*eğik*'), [{ type: 'em', value: 'eğik' }]);
assert.deepEqual(parseInline('`kod`'), [{ type: 'code', value: 'kod' }]);
assert.equal(parseInline('2 * 3 * 4').every((span) => span.type === 'text'), true, 'bare asterisks are not emphasis');

// Code spans win over emphasis, so a snippet is never reformatted.
assert.deepEqual(parseInline('`a ** b`'), [{ type: 'code', value: 'a ** b' }]);

const link = parseInline('[Hafize](https://example.com)');
assert.deepEqual(link, [{ type: 'link', value: 'Hafize', href: 'https://example.com' }]);

// --- security ------------------------------------------------------------

// Raw markup must survive as literal text, never as structure.
const injection = parseMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
assert.equal(injection.every((block) => block.type === 'paragraph'), true);
assert.deepEqual(injection.map((block) => block.spans.map((span) => span.value).join('')), [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>'
]);
// Every span carrying markup must be plain text, never a structural node type.
for (const block of injection) {
  assert.equal(block.spans.every((span) => span.type === 'text'), true);
}

// Dangerous link protocols degrade to text rather than becoming anchors.
for (const href of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:msgbox', 'JaVaScRiPt:alert(1)']) {
  const spans = parseInline(`[tıkla](${href})`);
  assert.equal(spans.some((span) => span.type === 'link'), false, `unsafe protocol became a link: ${href}`);
  assert.equal(spans.map((span) => span.value).join(''), `[tıkla](${href})`);
}
for (const href of ['https://a.example', 'http://a.example', 'mailto:owner@example.com']) {
  assert.equal(parseInline(`[x](${href})`)[0].type, 'link', `safe protocol was rejected: ${href}`);
}

// --- rendering (minimal DOM double) --------------------------------------

function createNode(tag) {
  return {
    tagName: tag,
    className: '',
    dataset: {},
    children: [],
    attributes: {},
    set textContent(value) { this.children = [{ text: value }]; },
    get textContent() {
      return this.children.map((child) => (child.text !== undefined ? child.text : child.textContent)).join('');
    },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; }
  };
}
const documentDouble = {
  createElement: (tag) => createNode(tag),
  createTextNode: (text) => ({ text })
};

function collect(node, tag, found = []) {
  for (const child of node.children || []) {
    if (child.tagName === tag) found.push(child);
    if (child.children) collect(child, tag, found);
  }
  return found;
}

const target = createNode('div');
renderMarkdown(documentDouble, target, '# Başlık\n\n`kod` ve **kalın**\n\n```js\nconst a = 1;\n```');
assert.equal(collect(target, 'h1').length, 1);
assert.equal(collect(target, 'strong').length, 1);
assert.equal(collect(target, 'figure').length, 1);
assert.equal(collect(target, 'pre').length, 1);

// The copy button must carry the exact source, not the rendered text.
const copyButton = collect(target, 'button')[0];
assert.equal(copyButton.className, 'code-copy');
assert.equal(copyButton.dataset.code, 'const a = 1;');

// Anchors must be safe to open from a chat surface.
const linked = createNode('div');
renderMarkdown(documentDouble, linked, 'bkz [site](https://example.com)');
const anchor = collect(linked, 'a')[0];
assert.equal(anchor.href, 'https://example.com');
assert.equal(anchor.target, '_blank');
assert.equal(anchor.rel, 'noopener noreferrer nofollow');

// Re-rendering replaces rather than appends, so streaming cannot duplicate content.
const streamed = createNode('div');
renderMarkdown(documentDouble, streamed, 'ilk');
renderMarkdown(documentDouble, streamed, 'ilk ikinci');
assert.equal(collect(streamed, 'p').length, 1);

const blank = createNode('div');
renderMarkdown(documentDouble, blank, '   ');
assert.equal(blank.children[0].text, '…');
assert.doesNotThrow(() => renderMarkdown(documentDouble, blank, null));
assert.doesNotThrow(() => renderMarkdown(null, null, 'x'));

console.log('markdown tests passed');
