import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const docs = readFileSync(new URL('../docs/CHAT_MARKDOWN_QUICK_REFERENCE.md', import.meta.url), 'utf8');
for (const marker of ['# Başlık', '## Başlık', '### Başlık', '- madde', '1. madde', '[x]', '> alıntı', '`kod`', '**kalın**', '*eğik*', '~~eski~~', '```', '| A | B |', 'https://']) {
  assert.ok(docs.includes(marker), marker);
}
assert.match(docs, /Raw HTML/);
assert.match(docs, /Streaming/);
assert.match(docs, /Mobil/);
console.log('test-chat-markdown-quick-reference: ok');
