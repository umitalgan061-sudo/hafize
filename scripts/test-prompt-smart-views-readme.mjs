import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme=fs.readFileSync('README.md','utf8');
assert.match(readme,/Akıllı görünümler/);
assert.match(readme,/Görünüm sağlığı/);
assert.match(readme,/hafize\.prompt-library\.smart-views\.v1/);
console.log('smart-view README contract: ok');