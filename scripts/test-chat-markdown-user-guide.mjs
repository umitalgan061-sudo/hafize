import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const docs = readFileSync(new URL('../docs/CHAT_MARKDOWN_USER_GUIDE.md', import.meta.url), 'utf8');
for (const marker of ['Başlıklar', 'listeler', 'görev listeleri', 'alıntılar', 'kod blokları', 'tablolar', 'Clipboard', 'Streaming', 'raw HTML', 'migration']) {
  assert.match(docs, new RegExp(marker, 'i'), marker);
}
assert.match(docs, /http:/);
assert.match(docs, /https:/);
assert.match(docs, /mailto:/);
assert.match(docs, /token/);
assert.match(docs, /cookie/);
console.log('test-chat-markdown-user-guide: ok');
