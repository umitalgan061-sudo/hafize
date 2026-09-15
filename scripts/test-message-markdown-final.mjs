import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync(new URL('../docs/MESSAGE_MARKDOWN_FINAL.md', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(docs.includes('assistant yanıtlarının güvenli ve okunabilir Markdown sunumudur'));
assert.ok(docs.includes('3000 değişen satır sınırı'));
assert.ok(packageJson.scripts['check:markdown']);
console.log('message markdown final acceptance ok');
