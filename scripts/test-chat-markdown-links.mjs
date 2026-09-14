import assert from 'node:assert/strict';
import { safeLinkHref, scanInline } from '../public/chat-markdown.js';

const cases = [
  ['https://example.com', true],
  ['http://example.com', true],
  ['mailto:person@example.com', true],
  ['HTTPS://EXAMPLE.COM/path', true],
  ['javascript:alert(1)', false],
  ['JAVASCRIPT:alert(1)', false],
  ['data:text/html,<b>x</b>', false],
  ['vbscript:msgbox(1)', false],
  ['/relative', false],
  ['#fragment', false],
  ['//example.com', false],
  ['ftp://example.com', false],
  ['file:///etc/passwd', false]
];
for (const [input, allowed] of cases) assert.equal(Boolean(safeLinkHref(input)), allowed, input);

const mixed = scanInline('[ok](https://example.com) [bad](javascript:alert(1)) https://example.org');
assert.equal(mixed.filter((x) => x.type === 'link').length, 2);
assert.match(mixed.map((x) => x.text).join(''), /javascript:alert/);
assert.equal(mixed.filter((x) => x.type === 'link').every((x) => /^https?:\/\//.test(x.href) || /^mailto:/.test(x.href)), true);

console.log('test-chat-markdown-links: ok');
