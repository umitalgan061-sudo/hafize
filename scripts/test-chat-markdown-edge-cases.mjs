import assert from 'node:assert/strict';
import { parseMarkdown, scanInline } from '../public/chat-markdown.js';

const cases = [
  ['# başlık #', 'heading'],
  ['### başlık ###', 'heading'],
  ['- tek', 'list'],
  ['1. tek', 'list'],
  ['> alıntı', 'quote'],
  ['---', 'rule'],
  ['```\ncode\n```', 'code'],
  ['| A | B |\n| --- | --- |\n| x | y |', 'table']
];
for (const [text, type] of cases) assert.equal(parseMarkdown(text)[0]?.type, type, text);

const emphasis = scanInline('**a _b_** and `**literal**` and ~~gone~~');
assert.ok(emphasis.some((x) => x.type === 'strong'));
assert.ok(emphasis.some((x) => x.type === 'code'));
assert.ok(emphasis.some((x) => x.type === 'strike'));

const whitespace = parseMarkdown('\u0000 bir\r\n\r\n iki ');
assert.equal(whitespace.length, 2);
assert.equal(whitespace[0].spans[0].text, ' bir');
assert.equal(whitespace[1].spans[0].text, 'iki ');

const escapedPipe = parseMarkdown('| A | B |\n| --- | --- |\n| a\\|b | c |');
assert.equal(escapedPipe[0].rows[0][0], 'a\\|b');

const nonTable = parseMarkdown('| yalnız bir parça');
assert.equal(nonTable[0].type, 'paragraph');

console.log('test-chat-markdown-edge-cases: ok');
