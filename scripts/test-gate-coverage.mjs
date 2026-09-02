import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Bu test, gate'in kendisini korur: daha önce 32 test dosyası `package.json`
// içindeki elle bakımı yapılan komut zincirine hiç eklenmediği için sessizce
// çalışmıyordu ve bir regression aylarca fark edilmedi. Aşağıdaki kontroller
// aynı sessiz kaybın tekrarlamasını engeller.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));

// 1) Gate komutları tek bir keşif tabanlı koşucuya bağlı kalmalı; uzun ve elle
//    bakımı yapılan `node scripts/... && node scripts/...` zincirine dönülmemeli.
for (const name of ['test', 'check', 'precheck']) {
  const command = pkg.scripts?.[name];
  assert.equal(typeof command, 'string', `package.json scripts.${name} tanımlı olmalı`);
  assert.ok(
    command.includes('scripts/run-tests.mjs'),
    `scripts.${name} keşif tabanlı koşucuyu çağırmalı, elle liste tutmamalı`
  );
  assert.equal(
    command.includes('&&'),
    false,
    `scripts.${name} elle bakımı yapılan komut zinciri içermemeli`
  );
}

// 2) Koşucu, testleri diskten keşfetmeli. Sabit kodlanmış bir test listesi
//    tutuyorsa aynı sürüklenme yeniden mümkün olur.
const runner = await readFile(path.join(repoRoot, 'scripts', 'run-tests.mjs'), 'utf8');
assert.ok(runner.includes('readdir'), 'koşucu test dosyalarını dizinden okumalı');
assert.ok(runner.includes("startsWith('test-')"), 'koşucu test-* dosyalarını keşfetmeli');
assert.ok(runner.includes("startsWith('validate-')"), 'koşucu validate-* script\'lerini de çalıştırmalı');

// 3) Diskteki her test dosyası gerçekten keşfedilebilir olmalı ve keşif sonucu
//    bu dosyanın kendisini de içermeli.
const entries = await readdir(path.join(repoRoot, 'scripts'), { withFileTypes: true });
const scripts = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.mjs'))
  .map((entry) => entry.name);
const discovered = scripts.filter((name) => name.startsWith('test-') || name.startsWith('validate-'));

assert.ok(discovered.length >= 80, `beklenenden az test keşfedildi: ${discovered.length}`);
assert.ok(discovered.includes('test-gate-coverage.mjs'), 'bu test dosyası da keşfedilebilir olmalı');
assert.ok(discovered.includes('validate-agent-registry.mjs'), 'agent registry doğrulaması gate kapsamında olmalı');

// 4) Keşif filtresi koşucunun kendisini içine almamalı.
assert.equal(discovered.includes('run-tests.mjs'), false, 'koşucu kendini test sanmamalı');

// 5) `scripts/` altındaki her .mjs ya bir gate script'i ya da koşucunun kendisi
//    olmalı. Aksi halde gate dışında kalan, kimsenin çalıştırmadığı bir dosya
//    sessizce birikir.
const uncovered = scripts.filter((name) => !discovered.includes(name) && name !== 'run-tests.mjs');
assert.deepEqual(uncovered, [], `gate dışında kalan script'ler: ${uncovered.join(', ')}`);

console.log(`test gate coverage OK: ${discovered.length} script keşif yoluyla gate kapsamında`);
