import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const docs = readFileSync(new URL('../docs/CHAT_MARKDOWN_TRIAGE.md', import.meta.url), 'utf8');
for (const marker of ['Düz metin', 'Kod kopyalama', 'Zararlı link', 'HTML çalışıyor', 'Yavaş streaming', 'Geniş tablo', 'PWA asset', 'Eski sohbet']) {
  assert.ok(docs.includes(marker), marker);
}
assert.match(docs, /safeLinkHref/);
assert.match(docs, /inline limit/);
assert.match(docs, /observer batching/);
assert.match(docs, /cache revision/);
console.log('test-chat-markdown-triage: ok');
