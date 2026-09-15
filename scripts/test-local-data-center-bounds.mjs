import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('public/local-data-center.js', 'utf8');
const context = { globalThis: null, TextEncoder, console };
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.HafizeLocalDataCenter;
const huge = 'x'.repeat(2_000_000);
const storage = { length: 1, key() { return 'hafize.theme.v1'; }, getItem() { return huge; } };
const item = api.inspect(storage)[0];
assert.equal(item.truncated, true);
assert.equal(item.count, 'okunamadı');
assert.ok(item.chars <= 1_500_000);
assert.ok(item.bytes <= 1_500_000);
console.log('local data center bounds: ok');
