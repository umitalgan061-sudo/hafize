import assert from 'node:assert/strict';
import { parseMarkdown, scanInline, safeLinkHref, normalizeInput } from '../public/chat-markdown.js';

assert.deepEqual(parseMarkdown(''), []);
assert.deepEqual(parseMarkdown(null), []);
assert.deepEqual(parseMarkdown(undefined), []);
assert.deepEqual(scanInline(''), []);
assert.deepEqual(scanInline(null), []);
assert.equal(safeLinkHref(''), '');
assert.equal(normalizeInput(null), '');

const unknown = parseMarkdown('a syntax feature this parser does not understand: [[foo]] {{bar}}');
assert.equal(unknown.length, 1);
assert.equal(unknown[0].type, 'paragraph');
assert.equal(unknown[0].spans.every((item) => item.type === 'text'), true);

const malformedHeading = parseMarkdown('#');
assert.equal(malformedHeading[0].type, 'paragraph');
assert.equal(malformedHeading[0].spans[0].text, '#');

const malformedList = parseMarkdown('-');
assert.equal(malformedList[0].type, 'paragraph');
assert.equal(malformedList[0].spans[0].text, '-');

const malformedFence = parseMarkdown('```js```');
assert.equal(malformedFence[0].type, 'paragraph');

const malformedTable = parseMarkdown('| a | b |\n| - | - |');
assert.equal(malformedTable[0].type, 'paragraph');

const textWithAngles = parseMarkdown('2 < 3 and 5 > 4');
assert.equal(textWithAngles[0].spans[0].text, '2 < 3 and 5 > 4');

console.log('test-chat-markdown-empty-and-fallback: ok');
