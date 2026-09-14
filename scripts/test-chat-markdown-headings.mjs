import assert from 'node:assert/strict';
import { parseMarkdown } from '../public/chat-markdown.js';

const levels = parseMarkdown('# one\n\n## two\n\n### three\n\n#### four\n\n##### five\n\n###### six');
assert.deepEqual(levels.filter((x) => x.type === 'heading').map((x) => x.level), [1, 2, 3, 3, 3, 3]);

const content = parseMarkdown('# **Başlık**');
assert.equal(content[0].type, 'heading');
assert.equal(content[0].level, 1);
assert.equal(content[0].spans[0].type, 'strong');

const trailing = parseMarkdown('## başlık ##');
assert.equal(trailing[0].spans[0].text, 'başlık');

const blank = parseMarkdown('###   başlık   ');
assert.equal(blank[0].spans[0].text, 'başlık');

console.log('test-chat-markdown-headings: ok');
