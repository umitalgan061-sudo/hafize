// Inline scanner contract: emphasis, code spans, links and escapes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const markdown = require('../public/markdown-renderer.js');

const inline = (source) => markdown.parseInline(source);
const shape = (source) => inline(source).map((node) => node.type);
const flatten = (nodes) => nodes.map((node) => {
  if (node.type === 'text' || node.type === 'code') return node.value;
  if (node.type === 'break') return '\n';
  if (node.type === 'link') return `→${node.href}`;
  return flatten(node.children ?? []).join('');
});

/* Emphasis ------------------------------------------------------------ */

assert.deepEqual(shape('**kalın**'), ['strong']);
assert.deepEqual(shape('*eğik*'), ['em']);
assert.deepEqual(shape('_eğik_'), ['em']);
assert.deepEqual(shape('__kalın__'), ['strong']);
assert.deepEqual(shape('~~üstü çizili~~'), ['strike']);

const both = inline('***hepsi***')[0];
assert.equal(both.type, 'strong');
assert.equal(both.children[0].type, 'em');
assert.equal(both.children[0].children[0].value, 'hepsi');

assert.deepEqual(flatten(inline('a **b _c_ d** e')), ['a ', 'b c d', ' e']);
assert.deepEqual(shape('bir * iki * üç'), ['text'], 'a delimiter followed by a space never opens');
assert.deepEqual(shape('**açık ama kapanmıyor'), ['text'], 'an unmatched delimiter stays literal');
assert.deepEqual(shape('snake_case_isim'), ['text'], 'underscores inside a word are literal');
assert.deepEqual(shape('2 * 3 * 4'), ['text']);
assert.deepEqual(flatten(inline('a*b*c')), ['a', 'b', 'c'], 'intraword `*` still emphasises');

/* Code spans ---------------------------------------------------------- */

assert.deepEqual(shape('`kod`'), ['code']);
assert.equal(inline('`kod`')[0].value, 'kod');
assert.equal(inline('``a ` b``')[0].value, 'a ` b', 'a doubled fence holds a backtick');
assert.equal(inline('` boşluklu `')[0].value, 'boşluklu', 'one padding space on each side is stripped');
assert.equal(inline('`  ` ')[0].value, '  ', 'an all-space span keeps its spaces');
assert.deepEqual(shape('`kapanmayan'), ['text'], 'an unclosed code span stays literal');
assert.deepEqual(
  flatten(inline('`*yıldız*`')),
  ['*yıldız*'],
  'emphasis inside a code span is not parsed'
);
assert.deepEqual(shape('a `b` *c*'), ['text', 'code', 'text', 'em']);
assert.deepEqual(
  shape('*a `b* c` d*'),
  ['em'],
  'a code span is skipped while looking for the closing delimiter'
);

/* Links --------------------------------------------------------------- */

const link = inline('[etiket](https://example.com "başlık")')[0];
assert.equal(link.type, 'link');
assert.equal(link.href, 'https://example.com');
assert.equal(link.title, 'başlık');
assert.equal(link.children[0].value, 'etiket');

assert.equal(inline('[a](<https://example.com/yol>)')[0].href, 'https://example.com/yol', 'angle-bracket destinations are read');
// A destination holding a raw space is refused as a link destination; what is
// left is ordinary text, so the bare-URL pass links the unambiguous prefix.
const spacedDestination = inline('[a](<https://example.com/bir iki>)');
assert.deepEqual(spacedDestination.map((node) => node.type), ['text', 'link', 'text']);
assert.equal(spacedDestination[0].value, '[a](<');
assert.equal(spacedDestination[1].href, 'https://example.com/bir');
assert.equal(inline('[iç içe [köşeli] etiket](https://a.b)')[0].children.length, 1);
assert.equal(inline('<https://example.com>')[0].href, 'https://example.com', 'autolinks work');
assert.equal(inline('<mailto:a@b.c>')[0].href, 'mailto:a@b.c');
assert.deepEqual(
  shape('[eksik](https://a.b'),
  ['text', 'link'],
  'an unterminated link is not a link; the bare URL inside it still is'
);
assert.equal(inline('[eksik](https://a.b')[0].value, '[eksik](');
assert.deepEqual(shape('[eksik](ftp://a.b'), ['text'], 'and an unsupported scheme stays fully literal');
assert.deepEqual(shape('[sadece etiket]'), ['text']);

const image = inline('![alt metin](https://cdn.example.com/a.png)')[0];
assert.equal(image.type, 'link', 'an image reference renders as a link, never as a remote fetch');
assert.equal(image.image, true);
assert.equal(image.children[0].value, 'alt metin');

const bare = inline('bak https://nvidia.com/nim adresine');
assert.equal(bare[1].type, 'link');
assert.equal(bare[1].href, 'https://nvidia.com/nim');
assert.equal(inline('(https://a.b/c).')[1].href, 'https://a.b/c', 'trailing punctuation stays outside the link');
assert.equal(inline('https://a.b/x_(y)')[0].href, 'https://a.b/x_(y)', 'balanced parentheses stay inside');
assert.deepEqual(shape('mailhttps://a.b'), ['text'], 'a bare URL needs a boundary before it');
assert.equal(inline('[etiket](https://a.b) https://c.d')[2].href, 'https://c.d');

/* Breaks and escapes -------------------------------------------------- */

assert.deepEqual(shape('bir\niki'), ['text', 'break', 'text']);
assert.deepEqual(shape('bir  \niki'), ['text', 'break', 'text']);
assert.equal(inline('bir  \niki')[0].value, 'bir', 'trailing spaces before a break are dropped');

assert.deepEqual(flatten(inline('\\*kaçış\\*')), ['*kaçış*']);
assert.deepEqual(flatten(inline('\\`kod değil\\`')), ['`kod değil`']);
assert.deepEqual(flatten(inline('\\[a\\](b)')), ['[a](b)']);
assert.deepEqual(flatten(inline('C:\\\\yol')), ['C:\\yol']);
assert.deepEqual(flatten(inline('\\q')), ['\\q'], 'a backslash before a letter is literal');

/* Degenerate input ---------------------------------------------------- */

assert.deepEqual(inline(''), []);
assert.deepEqual(inline(null), []);
assert.deepEqual(inline(undefined), []);
assert.deepEqual(flatten(inline('****')), ['****']);
assert.deepEqual(flatten(inline('___')), ['___']);
assert.deepEqual(flatten(inline('~~~~')), ['~~~~'], 'an empty strike run stays literal');
assert.deepEqual(shape('~~ boşluk ~~'), ['text'], 'a strike run may not open on whitespace');

console.log('chat markdown inline OK: emphasis, code spans, links, breaks and escapes behave as specified');
