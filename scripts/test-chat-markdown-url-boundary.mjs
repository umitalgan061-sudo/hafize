import assert from 'node:assert/strict';
import { safeLinkHref, scanInline } from '../public/chat-markdown.js';

const accepted = [
  'http://example.com',
  'https://example.com/path?q=1#x',
  'HTTPS://EXAMPLE.COM',
  'mailto:user@example.com'
];
for (const value of accepted) assert.ok(safeLinkHref(value), value);

const rejected = [
  'javascript:alert(1)',
  'jAvAsCrIpT:alert(1)',
  'data:text/html,<script>x</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'ftp://example.com',
  'ws://example.com',
  'wss://example.com',
  '/relative/path',
  '//example.com/path',
  '#fragment'
];
for (const value of rejected) assert.equal(safeLinkHref(value), '', value);

const long = `https://example.com/${'a'.repeat(600)}`;
assert.equal(safeLinkHref(long), '');

const markdown = scanInline('[safe](https://example.com) [unsafe](javascript:alert(1))');
assert.equal(markdown.filter((item) => item.type === 'link').length, 1);
assert.equal(markdown.some((item) => /javascript:alert/.test(item.text)), true);
assert.equal(markdown.filter((item) => item.type === 'link')[0].href.startsWith('https://'), true);

console.log('test-chat-markdown-url-boundary: ok');
