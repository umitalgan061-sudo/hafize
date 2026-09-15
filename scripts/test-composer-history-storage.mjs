import assert from 'node:assert/strict';
const key = 'hafize.composer-history.v1';
let data = null;
const storage = {
  getItem(name) { return name === key ? data : null; },
  setItem(name, value) { if (name === key) data = value; },
  removeItem(name) { if (name === key) data = null; }
};
storage.setItem(key, JSON.stringify(['a', 'b']));
assert.deepEqual(JSON.parse(storage.getItem(key)), ['a', 'b']);
storage.setItem('other', JSON.stringify(['secret']));
assert.equal(storage.getItem('other'), JSON.stringify(['secret']));
storage.removeItem(key);
assert.equal(storage.getItem(key), null);
let threw = false;
try { throw new Error('quota'); } catch { threw = true; }
assert.equal(threw, true);
console.log('composer history storage isolation: ok');
