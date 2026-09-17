// What the import preview promises the user, checked by running it.
//
// The source contract next door pins the dialog's shape; this suite runs the
// classification itself, because the number the user reads before confirming an
// import is the part that must not lie.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const library = require('../public/prompt-library.js');
globalThis.HafizePromptLibrary = library;
const preview = require('../public/prompt-library-import-preview.js');

const prompt = (id, title, body = 'gövde metni') => ({ id, title, body });

/* A clean file: every prompt is new -------------------------------------- */

const fresh = preview.analyze([], [prompt('a', 'Bir'), prompt('b', 'İki')]);
assert.equal(fresh.total, 2);
assert.equal(fresh.added, 2);
assert.equal(fresh.copies, 0);
assert.equal(fresh.skipped, 0);
assert.equal(fresh.invalid, 0);
assert.equal(fresh.importable, 2);
assert.deepEqual(fresh.rows.map((row) => row.kind), ['new', 'new']);

/* A colliding id is kept as a copy, never as an overwrite ----------------- */

const existing = [library.normalizeItem(prompt('a', 'Mevcut'))];
const colliding = preview.analyze(existing, [prompt('a', 'Yedekten')]);
assert.equal(colliding.copies, 1);
assert.equal(colliding.added, 0);
assert.equal(colliding.importable, 1);
assert.equal(colliding.rows[0].kind, 'copy');
// The preview and the merge must agree: `mergeImportedItems` re-keys instead of
// replacing, so the existing prompt is still there afterwards.
const merged = library.mergeImportedItems(existing, [prompt('a', 'Yedekten')]);
assert.equal(merged.items.length, 2);
assert.equal(merged.imported, colliding.importable);
assert.ok(merged.items.some((item) => item.title === 'Mevcut'));

/* A record the library cannot read is reported, not silently dropped ------ */

const hostile = preview.analyze([], [prompt('c', 'Sağlam'), { id: 'd', title: 'Gövdesiz' }, null, 42]);
assert.equal(hostile.total, 4);
assert.equal(hostile.added, 1);
assert.equal(hostile.invalid, 3);
assert.equal(hostile.importable, 1);
assert.deepEqual(hostile.rows.map((row) => row.kind), ['new', 'invalid', 'invalid', 'invalid']);

/* Past the library ceiling the rest is named as skipped ------------------- */

const limit = library.LIMITS.maxItems;
const full = Array.from({ length: limit - 1 }, (_, index) => library.normalizeItem(prompt(`e${index}`, `Var ${index}`)));
const overflow = preview.analyze(full, [prompt('x', 'Sığan'), prompt('y', 'Sığmayan')]);
assert.equal(overflow.added, 1);
assert.equal(overflow.skipped, 1);
assert.equal(overflow.importable, 1);
assert.equal(overflow.rows[1].kind, 'skipped');
assert.equal(library.mergeImportedItems(full, [prompt('x', 'Sığan'), prompt('y', 'Sığmayan')]).imported, overflow.importable);

/* Nothing importable means nothing to confirm ----------------------------- */

const empty = preview.analyze([], []);
assert.equal(empty.importable, 0);
assert.deepEqual(empty.rows, []);
assert.equal(preview.analyze([], null).total, 0);
assert.equal(preview.analyze(null, [prompt('z', 'Tek')]).added, 1);

/* Bounds ------------------------------------------------------------------ */

assert.equal(preview.MAX_FILE, 1000000);
assert.ok(preview.MAX_ROWS > 0 && preview.MAX_ROWS <= 100);
const longTitle = preview.analyze([], [prompt('t', 'ş'.repeat(400))]);
assert.ok(longTitle.rows[0].name.length <= 90);

console.log('prompt import preview behaviour: classification matches the merge it previews');
