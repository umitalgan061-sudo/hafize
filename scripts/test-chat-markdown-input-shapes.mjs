import assert from 'node:assert/strict';
import { parseMarkdown, scanInline, safeLinkHref, normalizeLanguage } from '../public/chat-markdown.js';

const inputs = [
  '', 'x', 'x\n', 'x\n\n', '\n\n', '  x  ', '\ttext',
  'Türkçe İıŞşÇçÖöÜüĞğ', 'emoji 😀 🚀', 'a\tb', 'a\\b', 'a|b',
  '1. item', '- item', '> item', '`item`', '**item**', '_item_', '~~item~~'
];
for (const input of inputs) {
  assert.doesNotThrow(() => parseMarkdown(input));
  assert.doesNotThrow(() => scanInline(input));
}

const odd = [undefined, null, 0, false, {}, [], Symbol('x')];
for (const value of odd) {
  assert.doesNotThrow(() => parseMarkdown(value));
  assert.doesNotThrow(() => scanInline(value));
  assert.equal(safeLinkHref(value), '');
  assert.equal(normalizeLanguage(value), '');
}

const nestedMarkers = [
  '**a *b* c**', '__a _b_ c__', '`a **b** c`', '~~a **b** c~~',
  '**a `b` c**', '[x](https://example.com)', 'https://example.com/a?b=c'
];
for (const input of nestedMarkers) assert.doesNotThrow(() => scanInline(input), input);

console.log('test-chat-markdown-input-shapes: ok');
