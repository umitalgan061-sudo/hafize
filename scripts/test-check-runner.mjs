// Doğrulama kapısının kendisi için sözleşme testi.
//
// Buradaki asıl amaç kapsam kaymasını (coverage drift) engellemektir: diskteki
// her `scripts/test-*.mjs` dosyası, gerekçesi `EXCLUDED_TESTS` içinde açıkça
// yazılmadıkça kapı tarafından çalıştırılmak zorundadır. Kapının kendisi bu
// testi de keşfettiği için `main()` burada asla çağrılmaz (sonsuz özyineleme).

import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXCLUDED_TESTS,
  discoverSyntaxTargets,
  discoverTestTargets
} from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function namesIn(directory, predicate) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => entry.name).sort();
}

const testTargets = await discoverTestTargets();
const testFilesOnDisk = await namesIn(
  'scripts',
  (name) => (name.startsWith('test-') || name.startsWith('validate-')) && name.endsWith('.mjs')
);

// Kapsam sözleşmesi: gerekçesiz hiçbir test dışarıda kalamaz.
const covered = new Set(testTargets.map((target) => path.basename(target)));
const uncovered = testFilesOnDisk.filter((name) => !covered.has(name) && !Object.hasOwn(EXCLUDED_TESTS, name));
assert.deepEqual(uncovered, [], `Kapı şu test dosyalarını çalıştırmıyor: ${uncovered.join(', ')}`);
assert.equal(covered.size, testFilesOnDisk.length - Object.keys(EXCLUDED_TESTS).length);

// Bu testin kendisi de kapsam içinde olmalı, aksi halde sözleşme kendini
// doğrulayamaz.
assert.ok(covered.has('test-check-runner.mjs'));

// Keşif yalnız doğrulama script'lerini döndürür; çalıştırıcının kendisi
// hedef sanılmaz.
for (const target of testTargets) {
  assert.ok(
    target.startsWith('scripts/test-') || target.startsWith('scripts/validate-'),
    `beklenmeyen test hedefi: ${target}`
  );
  assert.ok(target.endsWith('.mjs'));
}
assert.equal(covered.has('run-checks.mjs'), false);
// Eski elle bakımlı zincirin çalıştırdığı registry doğrulaması korunur.
assert.ok(covered.has('validate-agent-registry.mjs'));

// Sözdizimi kapsamı: sunucu girişi, tüm lib modülleri, tüm script'ler ve
// istemci JavaScript'i dahil olmalı.
const syntaxTargets = await discoverSyntaxTargets();
const syntaxSet = new Set(syntaxTargets);
assert.ok(syntaxSet.has('server.mjs'));
assert.ok(syntaxSet.has('scripts/run-checks.mjs'));

for (const [directory, extension] of [['lib', '.mjs'], ['public', '.js'], ['scripts', '.mjs']]) {
  const onDisk = await namesIn(directory, (name) => name.endsWith(extension));
  assert.ok(onDisk.length > 0, `${directory} boş görünüyor`);
  for (const name of onDisk) {
    assert.ok(syntaxSet.has(`${directory}/${name}`), `sözdizimi kontrolü dışında: ${directory}/${name}`);
  }
}

// Kaynak olmayan dosyalar (görseller, stil, manifest) sözdizimi hedefi değildir.
for (const target of syntaxTargets) {
  assert.ok(/\.(mjs|js)$/.test(target), `beklenmeyen sözdizimi hedefi: ${target}`);
}
assert.equal(syntaxSet.has('public/styles.css'), false);
assert.equal(syntaxSet.has('public/manifest.webmanifest'), false);

// Hedefler yinelemesiz ve kararlı sırada olmalı.
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);
assert.equal(new Set(testTargets).size, testTargets.length);

console.log(
  `check runner tests passed (${syntaxTargets.length} sözdizimi hedefi, ${testTargets.length} test hedefi)`
);
