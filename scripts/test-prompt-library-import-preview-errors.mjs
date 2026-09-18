import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-import-preview.js','utf8');
for(const phrase of ['Geçersiz JSON istem yedeği','İstem yedeği okunamadı','İçe aktarma dosyası 1 MB sınırını aşamaz','İçe aktarma kaydedilemedi']) assert.ok(source.includes(phrase));
console.log('prompt-library-import-preview-errors: ok');
