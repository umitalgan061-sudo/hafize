import assert from 'node:assert/strict';
import { LIMITS, normalizeInput, parseMarkdown } from '../public/chat-markdown.js';

assert.equal(normalizeInput(undefined), '');
assert.equal(normalizeInput(null), '');
assert.equal(normalizeInput(42), '');
assert.equal(normalizeInput('a\r\nb'), 'a\nb');
assert.equal(normalizeInput('a\rb'), 'a\nb');
assert.equal(normalizeInput('a\u0000b'), 'ab');
assert.equal(normalizeInput('x'.repeat(LIMITS.maxInput + 10)).length, LIMITS.maxInput);

const normalized = parseMarkdown('birinci\r\nikinci\r\n\r\nüç');
assert.equal(normalized.length, 2);
assert.equal(normalized[0].spans[0].text, 'birinci ikinci');
assert.equal(normalized[1].spans[0].text, 'üç');

assert.doesNotMatch(normalizeInput('x\u0000y'), /\u0000/);
assert.equal(normalizeInput(''), '');
assert.equal(normalizeInput('   '), '   ');

console.log('test-chat-markdown-normalization: ok');
