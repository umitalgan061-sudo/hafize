import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /hafize\.composer-history\.v1/);
assert.match(source, /MAX_ITEMS = 40/);
assert.match(source, /MAX_TEXT = 12000/);
assert.match(source, /JSON\.parse/);
assert.match(source, /localStorage/);
// The stored list is capped by MAX_ITEMS and, when stricter, by the retention setting.
assert.match(source, /slice\(0, Math\.min\(MAX_ITEMS, settings\.maxItems\)\)/);
assert.match(source, /hafize:composer-history-changed/);
assert.match(source, /dataset\.historyReady/);
assert.match(source, /compositionstart/);
assert.match(source, /ArrowUp/);
assert.match(source, /ArrowDown/);
assert.match(source, /destroy:/);
console.log('composer history core contract: ok');
