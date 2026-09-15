import assert from 'node:assert/strict';
const MAX_IMPORT = 512000;
function accept(raw) { return typeof raw === 'string' && raw.length <= MAX_IMPORT; }
assert.equal(accept('{}'), true);
assert.equal(accept('x'.repeat(MAX_IMPORT)), true);
assert.equal(accept('x'.repeat(MAX_IMPORT + 1)), false);
assert.equal(accept(null), false);
assert.equal(accept(42), false);
let existing = ['keep'];
function merge(current, incoming) { try { const list = JSON.parse(incoming); return Array.isArray(list) ? [...list, ...current.filter((v) => !list.includes(v))] : current; } catch { return current; } }
assert.deepEqual(merge(existing, '{bad'), existing);
console.log('composer history import safety: ok');
