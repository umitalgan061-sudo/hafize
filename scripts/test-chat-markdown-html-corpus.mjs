import assert from 'node:assert/strict';
import { parseMarkdown, scanInline } from '../public/chat-markdown.js';

const values = [
  '<b>kalın</b>', '<strong>güçlü</strong>', '<em>ince</em>', '<code>kod</code>',
  '<br>', '<hr>', '<div>blok</div>', '<span>metin</span>', '<button>tıkla</button>',
  '<form><input></form>', '<textarea>girdi</textarea>', '<select><option>x</option></select>'
];
for (const value of values) {
  const blocks = parseMarkdown(value);
  assert.ok(blocks.length >= 1, value);
  assert.equal(blocks.some((block) => block.type === 'code'), false, value);
  assert.equal(scanInline(value).some((item) => item.type === 'link'), false, value);
}

const htmlish = parseMarkdown('normal <b>text</b> and [safe](https://example.com)');
assert.equal(htmlish[0].type, 'paragraph');
assert.equal(htmlish[0].spans.some((item) => item.type === 'link'), true);
assert.equal(htmlish[0].spans.some((item) => item.type === 'strong'), false);

const code = parseMarkdown('```html\n<button onclick="alert(1)">x</button>\n```');
assert.equal(code[0].type, 'code');
assert.match(code[0].text, /onclick/);

console.log('test-chat-markdown-html-corpus: ok');
