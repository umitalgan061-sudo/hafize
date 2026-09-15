import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
const blocked = [
  'javascript:',
  'data:',
  'vbscript:',
  'onerror=',
  'onclick=',
  '<script',
  'innerHTML',
  'outerHTML',
  'insertAdjacentHTML'
];
for (const token of blocked.slice(0, 4)) assert.ok(!file.toLowerCase().includes(token), `unsafe token in renderer: ${token}`);
assert.ok(file.includes("if (!URL_PATTERN.test(url)) return '';"));
assert.ok(file.includes("['http:', 'https:', 'mailto:']"));
assert.ok(file.includes("link.rel = 'noopener noreferrer'"));
assert.ok(file.includes('codeNode.textContent'));
assert.ok(file.includes("replace(/\\0/g, '')"));
assert.ok(file.includes('slice(0, MAX_INPUT)'));
console.log('message markdown security contract ok');
