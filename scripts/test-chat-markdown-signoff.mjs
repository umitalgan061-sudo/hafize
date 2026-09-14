import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const signoff = readFileSync(new URL('../docs/CHAT_MARKDOWN_SIGNOFF.md', import.meta.url), 'utf8');
for (const marker of ['Kapsam', 'Fonksiyonel karar', 'Güvenlik kararı', 'Performans kararı', 'Uyumluluk kararı', 'PWA kararı', 'UX kararı', 'Test kararı', 'Bilinen sınır', 'Sonuç']) {
  assert.ok(signoff.includes(marker), marker);
}
assert.match(signoff, /Raw HTML/);
assert.match(signoff, /network/);
assert.match(signoff, /storage/);
assert.match(signoff, /credential/);
assert.match(signoff, /rollback/i);
assert.match(signoff, /CI/);
console.log('test-chat-markdown-signoff: ok');
