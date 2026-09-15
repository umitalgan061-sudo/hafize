import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync(new URL('../public/message-markdown.js', import.meta.url), 'utf8');
for (const token of ['MAX_TABLE_CELLS', "createElement('table')", "createElement('th')", "createElement('td')", "createElement('del')", "createElement('input')", 'type = \'checkbox\'', 'disabled = true']) {
  assert.ok(file.includes(token), `rich syntax contract missing: ${token}`);
}
assert.ok(file.includes("/^\\[[xX]\\]\\s+/"));
assert.ok(file.includes('/^\\[\\s\\]\\s+/'));
assert.ok(file.includes("/^\\|?\\s*[^|]+\\|[^|]+\\|?\\s*$/"));
assert.ok(file.includes("/^\\|?\\s*:?-{3,}:?"));
console.log('message markdown rich syntax contract ok');
