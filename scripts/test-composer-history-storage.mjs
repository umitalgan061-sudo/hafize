// This suite used to assert against a mock object it defined itself, which
// could not fail for the product. It now checks that the real module keeps to
// its own storage keys and survives a hostile or unavailable store.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStorageStub, createThrowingStorage } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);
const HISTORY_KEY = 'hafize.composer-history.v1';
const SETTINGS_KEY = 'hafize.composer-history.settings.v1';

const storage = createStorageStub({
  'hafize.conversations.v1': JSON.stringify(['başka bir özelliğin verisi']),
  'hafize.prompt-library.v1': JSON.stringify([{ id: 'p1' }])
});
globalThis.localStorage = storage;
require('../public/composer-history.js');
const history = globalThis.HafizeComposerHistory;
assert.ok(history, 'composer history exposes its API on the global');

assert.equal(history.STORAGE_KEY, HISTORY_KEY);
assert.equal(history.SETTINGS_KEY, SETTINGS_KEY);

history.save(['a', 'b']);
history.saveSettings({ enabled: true, maxItems: 20 });
assert.deepEqual(JSON.parse(storage.getItem(HISTORY_KEY)), ['a', 'b']);
assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_KEY)), { enabled: true, maxItems: 20 });

// Nothing outside the module's own two keys is touched.
assert.deepEqual(
  Object.keys(storage.snapshot()).sort(),
  ['hafize.composer-history.settings.v1', 'hafize.composer-history.v1', 'hafize.conversations.v1', 'hafize.prompt-library.v1']
);
assert.deepEqual(JSON.parse(storage.getItem('hafize.conversations.v1')), ['başka bir özelliğin verisi']);

// Clearing the history leaves the other features' data in place.
history.saveSettings({ enabled: false, maxItems: 20 });
assert.equal(storage.getItem(HISTORY_KEY), null);
assert.deepEqual(JSON.parse(storage.getItem('hafize.prompt-library.v1')), [{ id: 'p1' }]);
history.saveSettings({ enabled: true, maxItems: 40 });

// An unreadable settings entry falls back to the defaults rather than throwing.
storage.setItem(SETTINGS_KEY, 'kırık json');
assert.deepEqual(history.loadSettings(), { enabled: true, maxItems: 40 });
storage.setItem(SETTINGS_KEY, JSON.stringify({ enabled: true, maxItems: 9999 }));
assert.equal(history.loadSettings().maxItems, 40, 'an out-of-range retention value falls back to the default');

// A store that throws is reported through the return value, never as an error.
globalThis.localStorage = createThrowingStorage(['setItem']);
assert.equal(history.saveSettings({ enabled: true, maxItems: 10 }), false);
assert.equal(history.save(['x']), false);
globalThis.localStorage = createThrowingStorage(['getItem']);
assert.deepEqual(history.loadSettings(), { enabled: true, maxItems: 40 });
assert.deepEqual(history.load(), []);
globalThis.localStorage = undefined;
assert.deepEqual(history.load(), []);
assert.equal(history.save(['x']), true, 'a missing store is a no-op, not a crash');

console.log('composer history storage isolation: ok');
