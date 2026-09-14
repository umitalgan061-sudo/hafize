import assert from 'node:assert/strict';
import { parseMarkdown } from '../public/chat-markdown.js';

const response = parseMarkdown([
  '# Özet',
  '',
  'İlk paragraf.',
  '',
  '## Bulgular',
  '',
  '- **Güvenli** link: [site](https://example.com)',
  '- `kod` örneği',
  '- [x] tamamlanan',
  '- [ ] bekleyen',
  '',
  '> Kaynak notu',
  '',
  '---',
  '',
  '```json',
  '{',
  '  "ok": true',
  '}',
  '```',
  '',
  '| Özellik | Sonuç |',
  '| :--- | ---: |',
  '| Markdown | hazır |'
].join('\n'));

assert.deepEqual(response.map((x) => x.type), ['heading', 'paragraph', 'heading', 'list', 'quote', 'rule', 'code', 'table']);
assert.equal(response[0].level, 1);
assert.equal(response[2].level, 2);
assert.equal(response[3].items.length, 4);
assert.equal(response[3].items[2].checked, true);
assert.equal(response[3].items[3].checked, false);
assert.equal(response[4].spans[0].text, 'Kaynak notu');
assert.equal(response[6].language, 'json');
assert.match(response[6].text, /"ok": true/);
assert.equal(response[7].rows[0][0], 'Markdown');
assert.equal(response[7].rows[0][1], 'hazır');

const repeated = parseMarkdown('## Başlık\nmetin\n\n## İkinci\nmetin');
assert.equal(repeated.length, 2);
assert.equal(repeated[0].type, 'heading');
assert.equal(repeated[1].type, 'paragraph');

console.log('test-chat-markdown-structured: ok');
