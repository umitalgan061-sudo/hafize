import assert from 'node:assert/strict';
let cursor = -1;
let draft = 'current draft';
const history = ['sent one', 'sent two'];
let value = draft;
function navigate() { if (cursor < 0) cursor = 0; value = history[cursor]; }
function restore() { cursor = -1; value = draft; }
navigate();
assert.equal(value, 'sent one');
cursor = 1; value = history[cursor];
restore();
assert.equal(value, 'current draft');
assert.equal(cursor, -1);
console.log('composer history draft restore: ok');
