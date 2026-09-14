import assert from 'node:assert/strict';
import { parseMarkdown } from '../public/chat-markdown.js';

const structured = parseMarkdown([
  '## Plan',
  '',
  '- hazırlık',
  '- [x] uygulama',
  '- [ ] doğrulama',
  '',
  '> Not: önce küçük adımı çalıştır.',
  '',
  '| Alan | Durum |',
  '| :--- | :---: |',
  '| parser | iyi |',
  '| güvenlik | iyi |'
].join('\n'));
assert.equal(structured[0].type, 'heading');
assert.equal(structured[1].type, 'list');
assert.equal(structured[1].items[1].checked, true);
assert.equal(structured[2].type, 'quote');
assert.equal(structured[3].type, 'table');
assert.equal(structured[3].align[1], 'center');
assert.equal(structured[3].rows.length, 2);

const mixedLists = parseMarkdown('1. bir\n2. iki\n\n- üç\n- dört');
assert.equal(mixedLists.length, 2);
assert.equal(mixedLists[0].ordered, true);
assert.equal(mixedLists[1].ordered, false);

const pipeCode = parseMarkdown('| Başlık | İçerik |\n| --- | --- |\n| `a|b` | x |');
assert.equal(pipeCode[0].rows[0][0], '`a|b`');

console.log('test-chat-markdown-list-table: ok');
