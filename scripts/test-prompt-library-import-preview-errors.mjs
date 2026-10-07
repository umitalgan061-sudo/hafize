import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/typed/legacy/prompt-library-import-preview.ts','utf8');
for(const phrase of ['Geçersiz JSON istem yedeği','İstem yedeği okunamadı','İçe aktarma dosyası 1 MB sınırını aşamaz','İçe aktarma kaydedilemedi']) assert.ok(source.includes(phrase));
console.log('prompt-library-import-preview-errors: ok');
