import assert from 'node:assert/strict';
import { parseMarkdown, normalizeLanguage } from '../public/chat-markdown.js';

const fences = parseMarkdown('```js\nconst x = `value`;\n```\n\nnormal');
assert.equal(fences[0].type, 'code');
assert.equal(fences[0].language, 'js');
assert.equal(fences[0].closed, true);
assert.equal(fences[0].text, 'const x = `value`;');
assert.equal(fences[1].type, 'paragraph');

const tilde = parseMarkdown('~~~python\nprint("ok")\n~~~');
assert.equal(tilde[0].type, 'code');
assert.equal(tilde[0].language, 'python');

const invalidLanguage = parseMarkdown('```bad language!\n<not html>\n```');
assert.equal(invalidLanguage[0].language, '');
assert.equal(invalidLanguage[0].text, '<not html>');

const open = parseMarkdown('```js\nline one\nline two');
assert.equal(open[0].closed, false);
assert.equal(open[0].text.split('\n').length, 2);

assert.equal(normalizeLanguage('typescript+foo'), 'typescript+foo');
assert.equal(normalizeLanguage('a'.repeat(25)), '');
assert.equal(normalizeLanguage('C++'), 'c++');

const literal = parseMarkdown('````\n```\ninside\n````');
assert.equal(literal[0].type, 'code');
assert.match(literal[0].text, /inside/);

console.log('test-chat-markdown-fences: ok');
