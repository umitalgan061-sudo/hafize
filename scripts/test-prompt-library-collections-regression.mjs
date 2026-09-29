import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

const required = [
  'Koleksiyonlar',
  'Seçilenleri ata',
  'Yönet',
  'Yedeği dışa aktar',
  'Yedeği içe aktar',
  'Yeni istemler için varsayılan koleksiyon',
  'İstemi koleksiyona ata',
  'collectionMatches',
  'getCollectionForPrompt'
];

for (const token of required) assert.ok(source.includes(token), `missing source token: ${token}`);

assert.ok(index.indexOf('prompt-library.js') < index.indexOf('prompt-library-collections.js'));
assert.ok(index.includes('prompt-library-collections-keyboard.js'));
console.log('prompt library collections regression: ok');
