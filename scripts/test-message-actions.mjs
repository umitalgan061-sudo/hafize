import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-actions.js', import.meta.url), 'utf8');
for (const label of ['Kopyala', 'İndir', 'Ham metin', 'Yanıtı daralt']) assert.ok(file.includes(label));
assert.ok(file.includes('navigator?.clipboard?.writeText'));
assert.ok(file.includes("text/markdown;charset=utf-8"));
assert.ok(file.includes('createObjectURL'));
assert.ok(file.includes('revokeObjectURL'));
assert.ok(file.includes('aria-pressed'));
assert.ok(file.includes('aria-expanded'));
assert.ok(file.includes("role', 'status"));
assert.ok(file.includes('MutationObserver'));
assert.ok(file.includes('MESSAGE_LIMIT'));
assert.ok(file.includes('COLLAPSE_CHARS'));
assert.ok(!file.includes('fetch('));
assert.ok(!file.includes('innerHTML'));
console.log('assistant message actions contract ok');
