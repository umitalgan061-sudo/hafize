import assert from 'node:assert/strict';
import { parseMarkdown } from '../public/chat-markdown.js';

const plain = 'Merhaba Hafize, bugün hava nasıl?';
const plainBlocks = parseMarkdown(plain);
assert.equal(plainBlocks.length, 1);
assert.equal(plainBlocks[0].type, 'paragraph');
assert.equal(plainBlocks[0].spans[0].text, plain);

const multiline = parseMarkdown('birinci satır\nikinci satır');
assert.equal(multiline.length, 1);
assert.equal(multiline[0].spans[0].text, 'birinci satır ikinci satır');

const blank = parseMarkdown('   \n\n   ');
assert.equal(blank.length, 0);

const unicode = parseMarkdown('Türkçe İ/ı Ş/ş Ç/ç — emoji 😀');
assert.match(unicode[0].spans[0].text, /Türkçe/);
assert.match(unicode[0].spans[0].text, /😀/);

const literal = parseMarkdown('2 < 3 && 4 > 1');
assert.equal(literal[0].spans.every((x) => x.type === 'text'), true);

const codeLiteral = parseMarkdown('```text\n<div>güvenli metin</div>\n```');
assert.equal(codeLiteral[0].text.includes('<div>'), true);

console.log('test-chat-markdown-compatibility: ok');
