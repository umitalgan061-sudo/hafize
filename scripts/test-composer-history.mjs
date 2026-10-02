import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createStorageStub, createThrowingStorage } from './browser-storage-stub.mjs';

const require = createRequire(import.meta.url);
const source = fs.readFileSync('public/typed/legacy/composer-history.ts', 'utf8');

assert.match(source, /hafize\.composer-history\.v1/);
assert.match(source, /MAX_ITEMS = 40/);
assert.match(source, /MAX_TEXT = 12000/);
assert.match(source, /hafize:composer-history-changed/);
assert.match(source, /dataset\.historyReady/);
assert.match(source, /compositionstart/);
assert.match(source, /ArrowUp/);
assert.match(source, /ArrowDown/);
assert.match(source, /destroy:/);

// The stored bounds are asserted through the module: retention settings mean
// the cap is `min(MAX_ITEMS, settings.maxItems)`, not a fixed slice call.
const storage = createStorageStub();
globalThis.localStorage = storage;
require('../public/typed/legacy/composer-history.ts');
const history = globalThis.HafizeComposerHistory;
assert.ok(history, 'composer history exposes its API on the global');
assert.equal(history.STORAGE_KEY, 'hafize.composer-history.v1');
assert.equal(history.MAX_ITEMS, 40);

history.save(Array.from({ length: 200 }, (_, index) => `mesaj ${index}`));
assert.equal(history.load().length, 40, 'at most MAX_ITEMS submissions are kept');
assert.equal(history.load()[0], 'mesaj 0', 'order is preserved');

// A tighter retention setting wins over the built-in cap.
history.saveSettings({ enabled: true, maxItems: 10 });
history.save(Array.from({ length: 200 }, (_, index) => `mesaj ${index}`));
assert.equal(history.load().length, 10, 'the retention setting caps the stored history');

// Turning history off, or choosing the 0 setting, drops what was stored.
history.saveSettings({ enabled: true, maxItems: 0 });
assert.deepEqual(history.load(), []);
assert.equal(storage.getItem('hafize.composer-history.v1'), null, 'the entry is removed, not just hidden');
history.saveSettings({ enabled: true, maxItems: 40 });
history.save(['tekrar']);
assert.deepEqual(history.load(), ['tekrar']);
history.saveSettings({ enabled: false, maxItems: 40 });
assert.deepEqual(history.load(), []);
assert.equal(storage.getItem('hafize.composer-history.v1'), null);
history.saveSettings({ enabled: true, maxItems: 40 });

// Text is bounded and NUL bytes never reach storage.
assert.equal(history.normalize('x'.repeat(50_000)).length, 12_000);
assert.equal(history.normalize('a\u0000b'), 'ab');
assert.equal(history.normalize(undefined), '');

// Corrupted or hostile payloads degrade to an empty history.
storage.setItem('hafize.composer-history.v1', 'kırık json');
assert.deepEqual(history.load(), []);
storage.setItem('hafize.composer-history.v1', JSON.stringify({ not: 'an array' }));
assert.deepEqual(history.load(), []);
storage.setItem('hafize.composer-history.v1', JSON.stringify(['iyi', 42, null, '   ', { a: 1 }]));
assert.deepEqual(history.load(), ['iyi'], 'only non-empty strings survive a reload');

// A blocked store is reported instead of thrown.
globalThis.localStorage = createThrowingStorage(['setItem']);
assert.equal(history.save(['x']), false);
globalThis.localStorage = createThrowingStorage(['getItem']);
assert.deepEqual(history.load(), []);
globalThis.localStorage = storage;

console.log('composer history core contract: ok');
