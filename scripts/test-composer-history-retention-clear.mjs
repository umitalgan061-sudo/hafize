import assert from 'node:assert/strict';
let storage = ['a', 'b'];
const settings = { enabled: false, maxItems: 40 };
function load() { if (!settings.enabled || settings.maxItems === 0) return []; return storage.slice(0, settings.maxItems); }
function save() { if (!settings.enabled || settings.maxItems === 0) storage = []; }
save();
assert.deepEqual(storage, []);
assert.deepEqual(load(), []);
console.log('composer history retention clear: ok');
