import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown-tools.js', import.meta.url), 'utf8');
assert.ok(file.includes('Kopyala'));
assert.ok(file.includes('Kodu aç'));
assert.ok(file.includes('Kodu daralt'));
assert.ok(file.includes('root.navigator?.clipboard?.writeText'));
assert.ok(file.includes('MAX_COPY'));
assert.ok(file.includes('COLLAPSE_LINES'));
assert.ok(file.includes('aria-expanded'));
assert.ok(file.includes("role', 'status"));
assert.ok(file.includes('MutationObserver'));
assert.ok(!file.includes('eval('));
assert.ok(!file.includes('Function('));
assert.ok(!file.includes('innerHTML'));
console.log('message markdown tools contract ok');
