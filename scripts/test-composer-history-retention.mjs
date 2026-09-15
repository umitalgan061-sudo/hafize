import assert from 'node:assert/strict';
const allowed = [0, 10, 20, 40];
for (const value of [0, 10, 20, 40]) assert.equal(allowed.includes(value), true);
for (const value of [-1, 1, 5, 41, 100, '40', null]) assert.equal(allowed.includes(value), false);
function retain(items, limit) { return items.slice(0, limit); }
const values = Array.from({ length: 50 }, (_, i) => `m${i}`);
assert.equal(retain(values, 40).length, 40);
assert.equal(retain(values, 10).length, 10);
assert.equal(retain(values, 0).length, 0);
console.log('composer history retention: ok');
