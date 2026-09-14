import assert from 'node:assert/strict';
import { parseMarkdown, scanInline, safeLinkHref } from '../public/chat-markdown.js';

const hostile = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<iframe src="https://example.com"></iframe>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  'javascript:alert(document.domain)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  '![image](javascript:alert(1))'
];
for (const value of hostile) {
  const blocks = parseMarkdown(value);
  assert.equal(blocks.some((block) => block.type === 'code' && /script/i.test(block.text)), false, value);
  assert.equal(scanInline(value).some((item) => item.type === 'link' && /^javascript:/i.test(item.href || '')), false, value);
}

assert.equal(safeLinkHref('javascript:alert(1)'), '');
assert.equal(safeLinkHref('data:text/html,alert(1)'), '');
assert.equal(safeLinkHref('vbscript:alert(1)'), '');
assert.equal(safeLinkHref('file:///etc/passwd'), '');
assert.equal(safeLinkHref('//evil.example'), '');

const fenceHostile = parseMarkdown('```html\n<script>alert(1)</script>\n```');
assert.equal(fenceHostile[0].type, 'code');
assert.match(fenceHostile[0].text, /<script>/);

const tableHostile = parseMarkdown('| A | B |\n| --- | --- |\n| <img onerror=x> | javascript:foo |');
assert.equal(tableHostile[0].type, 'table');
assert.equal(tableHostile[0].rows[0][0].includes('<img'), true);
assert.equal(scanInline(tableHostile[0].rows[0][1]).every((x) => x.type !== 'link'), true);

console.log('test-chat-markdown-malicious: ok');
