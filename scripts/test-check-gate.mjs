import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { discoverTargets, runGate } from './run-tests.mjs';

const targets = await discoverTargets();

const scriptFiles = (await readdir(new URL('.', import.meta.url))).filter(
  (file) => file.startsWith('test-') && file.endsWith('.mjs')
);
const libFiles = (await readdir(new URL('../lib', import.meta.url))).filter((file) => file.endsWith('.mjs'));

// Gate keşfi elle tutulan listeye değil dosya sistemine bağlıdır: yeni test veya
// yeni lib dosyası eklendiğinde otomatik olarak kapsama girer.
assert.equal(targets.tests.length, scriptFiles.length);
for (const file of scriptFiles) {
  assert.equal(targets.tests.includes(`scripts/${file}`), true, `test kapsam dışı: ${file}`);
}
for (const file of libFiles) {
  assert.equal(targets.syntax.includes(`lib/${file}`), true, `lib syntax kapsam dışı: ${file}`);
}
assert.equal(targets.syntax.includes('server.mjs'), true);
assert.equal(targets.syntax.includes('public/app.js'), true);
assert.equal(targets.syntax.includes('public/sw.js'), true);
assert.equal(targets.syntax.includes('scripts/run-tests.mjs'), true);

// Runner kendi kendini test olarak çalıştırmaz (sonsuz döngü koruması).
assert.equal(targets.tests.includes('scripts/run-tests.mjs'), false);
assert.equal(targets.tests.every((file) => file.startsWith('scripts/test-')), true);

// Sıralama deterministiktir; gate çıktısı turdan tura karşılaştırılabilir kalır.
assert.deepEqual([...targets.tests], [...targets.tests].sort());
assert.deepEqual(Object.isFrozen(targets), true);
assert.deepEqual(Object.isFrozen(targets.tests), true);

// Filtre yalnız eşleşen hedefleri çalıştırır ve geçen testi rapor eder.
const logs = [];
const filtered = await runGate({ filter: 'ui-shell', log: (line) => logs.push(line) });
assert.equal(filtered.executed.length, 1);
assert.equal(filtered.executed[0].file, 'scripts/test-ui-shell.mjs');
assert.equal(filtered.executed[0].ok, true);
assert.equal(filtered.executed[0].durationMs >= 0, true);
assert.equal(filtered.failures.length, 0);
assert.equal(filtered.syntaxChecked, 2);
assert.equal(logs.length, 1);
assert.match(logs[0], /^PASS scripts\/test-ui-shell\.mjs/);

// Hiçbir hedefe uymayan filtre sessizce yeşil dönmez; sıfır test çalıştırıldığı görünür.
const empty = await runGate({ filter: 'zzz-eslesme-yok', log: () => {} });
assert.equal(empty.executed.length, 0);
assert.equal(empty.syntaxChecked, 0);
assert.equal(empty.failures.length, 0);

console.log(`check gate discovery tests passed (${targets.tests.length} tests, ${targets.syntax.length} syntax targets)`);
