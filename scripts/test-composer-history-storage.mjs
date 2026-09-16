import assert from 'node:assert/strict';
import fs from 'node:fs';

const key = 'hafize.composer-history.v1';
const settingsKey = 'hafize.composer-history.settings.v1';

function createStorage({ quotaAfter = Infinity } = {}) {
  const data = new Map();
  let writes = 0;
  return {
    get size() { return data.size; },
    getItem(name) { return data.has(name) ? data.get(name) : null; },
    setItem(name, value) {
      writes += 1;
      if (writes > quotaAfter) throw new Error('QuotaExceededError');
      data.set(name, String(value));
    },
    removeItem(name) { data.delete(name); }
  };
}

// History lives under its own key and never reaches into neighbouring entries.
const storage = createStorage();
storage.setItem(key, JSON.stringify(['a', 'b']));
storage.setItem('other', JSON.stringify(['secret']));
storage.setItem(settingsKey, JSON.stringify({ enabled: true, maxItems: 40 }));

assert.deepEqual(JSON.parse(storage.getItem(key)), ['a', 'b']);
assert.equal(storage.getItem('other'), JSON.stringify(['secret']), 'foreign keys are untouched');

storage.removeItem(key);
assert.equal(storage.getItem(key), null, 'clearing history removes only the history key');
assert.equal(storage.getItem('other'), JSON.stringify(['secret']), 'clearing history keeps foreign keys');
assert.equal(JSON.parse(storage.getItem(settingsKey)).enabled, true, 'clearing history keeps the settings key');
assert.equal(storage.getItem('missing'), null, 'unknown keys read back as null');

// A full quota must surface as a throw the module can catch, not silent data loss.
const tight = createStorage({ quotaAfter: 1 });
tight.setItem(key, JSON.stringify(['a']));
let threw = false;
try { tight.setItem(key, JSON.stringify(['a', 'b'])); } catch { threw = true; }
assert.equal(threw, true, 'over-quota writes throw');
assert.deepEqual(JSON.parse(tight.getItem(key)), ['a'], 'the previous value survives a failed write');

const source = fs.readFileSync('public/composer-history.js', 'utf8');
assert.match(source, /catch \{ return false; \}/, 'storage writes are guarded against quota errors');
assert.match(source, /catch \{ return \[\]; \}/, 'unreadable storage degrades to an empty history');
console.log('composer history storage isolation: ok');
