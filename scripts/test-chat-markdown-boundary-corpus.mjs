import assert from 'node:assert/strict';
import { parseMarkdown, scanInline, safeLinkHref } from '../public/chat-markdown.js';

const invalidUrls = [
  'javascript:alert(1)', 'data:text/html,alert(1)', 'vbscript:msgbox(1)',
  'ftp://example.com', 'file:///tmp/x', '/local/path', '//external.example', '#hash'
];
for (const url of invalidUrls) {
  assert.equal(safeLinkHref(url), '', `unsafe URL accepted: ${url}`);
  const spans = scanInline(`[x](${url})`);
  assert.equal(spans.some((x) => x.type === 'link'), false, url);
}

const validUrls = ['http://example.com', 'https://example.com', 'mailto:a@example.com'];
for (const url of validUrls) assert.ok(safeLinkHref(url), url);

const markup = [
  '<script>window.pwned=1</script>',
  '<style>body{display:none}</style>',
  '<iframe src="https://evil.example"></iframe>',
  '<object data="https://evil.example"></object>',
  '<embed src="https://evil.example">',
  '<svg><animate onbegin="alert(1)"/></svg>',
  '<a href="javascript:alert(1)">click</a>'
];
for (const value of markup) {
  const blocks = parseMarkdown(value);
  assert.equal(blocks.some((block) => block.type === 'code'), false);
  assert.equal(scanInline(value).some((x) => x.type === 'link'), false);
}

const fence = parseMarkdown('```html\n<script>alert(1)</script>\n<img src=x onerror=1>\n```');
assert.equal(fence.length, 1);
assert.equal(fence[0].type, 'code');
assert.match(fence[0].text, /onerror/);

const table = parseMarkdown('| A | B |\n| --- | --- |\n| [x](javascript:1) | <img onerror=1> |');
assert.equal(table[0].type, 'table');
assert.equal(scanInline(table[0].rows[0][0]).some((x) => x.type === 'link'), false);

const giant = parseMarkdown('`'.repeat(70_000));
assert.ok(giant.length <= 350);

console.log('test-chat-markdown-boundary-corpus: ok');
