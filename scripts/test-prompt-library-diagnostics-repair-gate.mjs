import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
const cap=source.indexOf('MAX_ORPHANS');
const repair=source.indexOf('applySafeRepair');
assert.ok(cap>=0 && repair>cap);
assert.match(source,/yetim ilişki sayısı güvenli otomatik onarım sınırını aşıyor/);
console.log('prompt-library-diagnostics-repair-gate: ok');
