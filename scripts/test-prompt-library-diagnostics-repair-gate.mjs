import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile('public/prompt-library-diagnostics.js','utf8');
// The bound has to be declared before the repair call and actually consulted
// by it: a `MAX_ORPHANS` nothing reads is not a gate.
const cap=source.indexOf('MAX_ORPHANS');
const repair=source.indexOf('applySafeRepair');
assert.ok(cap>=0 && repair>cap);
assert.match(source,/orphanCount\(lastReport\) > MAX_ORPHANS/);
assert.match(source,/yetim ilişki sayısı güvenli otomatik onarım sınırını aşıyor/i);
console.log('prompt-library-diagnostics-repair-gate: ok');
