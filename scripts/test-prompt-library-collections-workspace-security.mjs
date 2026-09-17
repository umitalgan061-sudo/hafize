import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-collections-workspace.js', 'utf8');
const css = fs.readFileSync('public/prompt-library-collections-workspace.css', 'utf8');

for (const pattern of [/process\.env/, /document\.cookie/, /localStorage\.getItem\(['"]token/i, /Authorization/i, /Bearer\s+/i, /WebSocket/, /EventSource/, /XMLHttpRequest/]) {
  assert.equal(pattern.test(source), false, `forbidden security surface: ${pattern}`);
}
assert.equal(source.includes('innerHTML'), false);
assert.equal(source.includes('outerHTML'), false);
assert.match(source, /root\.crypto\?\.randomUUID/);
assert.match(source, /slice\(0, MAX_SELECTED\)/);
assert.match(source, /slice\(0, MAX_META_ITEMS\)/);
assert.match(source, /MAX_IMPORT_BYTES/);
assert.match(source, /MAX_EXPORT_BYTES/);
assert.equal(source.includes('encodeURIComponent('), false);
assert.match(source, /textContent/);
assert.match(source, /createElement/);
assert.match(css, /forced-colors/);

console.log('prompt collection workspace security: ok');
