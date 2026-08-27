import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { findUncoveredModules, selectUncovered } from './validate-check-coverage.mjs';

const ROOT = new URL('../', import.meta.url);

const uncovered = await findUncoveredModules();
assert.deepEqual(uncovered, [], `test referansı olmayan lib modülleri: ${uncovered.join(', ')}`);

const libEntries = await readdir(new URL('lib/', ROOT), { withFileTypes: true });
const moduleCount = libEntries.filter((entry) => entry.isFile() && entry.name.endsWith('.mjs')).length;
assert.ok(moduleCount >= 60, `beklenenden az lib modülü keşfedildi: ${moduleCount}`);

// Doğrulayıcı gerçekten kırmızıya dönebilmelidir; aksi halde sessizce her zaman geçerdi.
assert.deepEqual(selectUncovered(['yeni-modul.mjs'], ['import x from "../lib/baska.mjs";']), ['yeni-modul.mjs']);
assert.deepEqual(selectUncovered(['yeni-modul.mjs'], ['import x from "../lib/yeni-modul.mjs";']), []);
assert.deepEqual(selectUncovered(['b.mjs', 'a.mjs'], []), ['a.mjs', 'b.mjs']);
assert.deepEqual(selectUncovered([], ['lib/a.mjs']), []);
// Yalnız aynı adı taşıyan başka bir dizin referansı kapsam sayılmaz.
assert.deepEqual(selectUncovered(['a.mjs'], ['public/a.mjs']), ['a.mjs']);

console.log(`check coverage tests passed: ${moduleCount} lib modülünün tamamı test referanslı`);
