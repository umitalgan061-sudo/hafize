import assert from 'node:assert/strict';
import fs from 'node:fs';

const backup = fs.readFileSync('public/prompt-library-fill-history-backup.js', 'utf8');
const ui = fs.readFileSync('public/prompt-library-fill-history-backup-ui.js', 'utf8');
const usage = fs.readFileSync('public/prompt-library-usage.js', 'utf8');
const sw = fs.readFileSync('public/sw-policy.js', 'utf8');

assert.match(backup, /hafize\.prompt-library\.fill\.history\.v1/);
assert.match(backup, /MAX_BYTES = 150000/);
assert.match(backup, /MAX_ENTRIES = 24/);
assert.match(backup, /MAX_VALUE = 1000/);
assert.match(backup, /normalize/);
assert.match(backup, /merge/);
assert.match(backup, /canExport/);
assert.doesNotMatch(backup, /fetch\s*\(/);
assert.doesNotMatch(backup, /XMLHttpRequest/);
assert.match(ui, /Geçmişi dışa aktar/);
assert.match(ui, /Geçmişi içe aktar/);
assert.match(ui, /Geçmişi temizle/);
assert.match(ui, /FileReader/);
assert.match(ui, /Blob/);
assert.match(ui, /confirm/);
assert.doesNotMatch(ui, /innerHTML\s*=/);
assert.match(usage, /prompt-library-fill-history-backup\.js/);
assert.match(usage, /prompt-library-fill-history-backup-ui\.js/);
assert.match(sw, /prompt-library-fill-history-backup\.js/);
assert.match(sw, /prompt-library-fill-history-backup-ui\.js/);
console.log('smart fill history backup contracts: ok');
