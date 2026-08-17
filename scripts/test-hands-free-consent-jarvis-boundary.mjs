import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const review=await readFile(new URL('../docs/JARVIS_INTEGRATION_REVIEW.md',import.meta.url),'utf8');
const consent=await readFile(new URL('../public/hands-free-consent.js',import.meta.url),'utf8');
const handsFree=await readFile(new URL('../public/hands-free.js',import.meta.url),'utf8');
assert.match(review,/Wake phrase \/ eller serbest kullanım/);
assert.match(review,/açık opt-in/);
assert.match(review,/görünür mikrofon göstergesi/);
assert.match(review,/kolay kapatma/);
assert.match(review,/shell=True/);
assert.match(consent,/Mikrofon dinlemesini aç\?/);
assert.match(consent,/Onayla ve dinlemeyi aç/);
assert.match(consent,/15_000/);
assert.match(handsFree,/30 \* 60 \* 1000/);
assert.match(handsFree,/indicator\.hidden = !enabled/);
for(const source of [consent,handsFree]){assert.doesNotMatch(source,/child_process|execSync|spawnSync|shell=True/);assert.doesNotMatch(source,/API_KEY|PRIVATE_KEY|client_secret/i);}
console.log('hands-free consent Jarvis boundary tests passed');
