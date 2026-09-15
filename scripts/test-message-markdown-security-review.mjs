import assert from 'node:assert/strict';
import fs from 'node:fs';

const doc = fs.readFileSync(new URL('../docs/MESSAGE_MARKDOWN_SECURITY_REVIEW.md', import.meta.url), 'utf8');
for (const token of ['Model çıktısı güvenilmez', 'URL', 'Code', 'Download', 'Quote', 'Observer', 'PWA', 'Storage']) assert.ok(doc.includes(token), `missing review section: ${token}`);
assert.ok(doc.includes('innerHTML'));
assert.ok(doc.includes('eval'));
assert.ok(doc.includes('network'));
console.log('message markdown security review contract ok');
