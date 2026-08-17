import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const doc=await readFile(new URL('../docs/HANDS_FREE_EXPLICIT_CONSENT_REVIEW.md',import.meta.url),'utf8');
assert.match(doc,/Web Speech API/);
assert.match(doc,/tarayıcıya ve işletim sistemine bağlıdır/);
assert.match(doc,/bazı sağlayıcılar sesi kendi hizmetlerinde işleyebilir/);
assert.match(doc,/“yalnız cihazda işlenir” gibi doğrulanamayacak bir garanti vermez/);
assert.match(doc,/ham mikrofon sesini kendi backend'ine yükleyen yeni bir endpoint açmaz/);
console.log('hands-free speech provider disclosure tests passed');
