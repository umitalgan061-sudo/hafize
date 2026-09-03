import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSteps, parseArgv, selectSteps } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function listing(dir, extension) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => entry.name).sort();
}

const { syntax, tests } = await discoverSteps();
const syntaxFiles = syntax.map((step) => step.file);
const testFiles = tests.map((step) => step.file);

// Keşif sözleşmesi: kapıdan sessizce düşen test dosyası olamaz.
const expectedTests = (await listing('scripts', '.mjs')).filter((name) => name.startsWith('test-'));
assert.deepEqual(
  testFiles.filter((file) => path.basename(file).startsWith('test-')),
  expectedTests.map((name) => `scripts/${name}`)
);
assert.ok(testFiles.includes('scripts/validate-agent-registry.mjs'));
assert.ok(testFiles.includes('scripts/test-tool-runtime.mjs'));
assert.ok(testFiles.includes('scripts/test-gmail-read-client.mjs'));
assert.ok(testFiles.includes('scripts/test-run-checks.mjs'));
assert.equal(new Set(testFiles).size, testFiles.length, 'aynı test iki kez koşmamalı');

// Syntax kapsamı: sunucu, lib, public ve scripts kaynakları.
assert.ok(syntaxFiles.includes('server.mjs'));
for (const name of await listing('lib', '.mjs')) assert.ok(syntaxFiles.includes(`lib/${name}`), `lib/${name} eksik`);
for (const name of await listing('public', '.js')) assert.ok(syntaxFiles.includes(`public/${name}`), `public/${name} eksik`);
for (const name of await listing('scripts', '.mjs')) assert.ok(syntaxFiles.includes(`scripts/${name}`), `scripts/${name} eksik`);
assert.equal(syntaxFiles.some((file) => file.endsWith('.json')), false, 'JSON dosyaları node --check hedefi değildir');
assert.equal(new Set(syntaxFiles).size, syntaxFiles.length, 'aynı dosya iki kez kontrol edilmemeli');
assert.deepEqual(syntaxFiles, [...syntaxFiles].sort(), 'syntax adımları kararlı sırada olmalı');

// Adım seçimi bayrakları.
assert.deepEqual(
  (await selectSteps({ syntaxOnly: true, testsOnly: false, filter: '' })).map((step) => step.kind),
  syntax.map(() => 'syntax')
);
assert.deepEqual(
  (await selectSteps({ syntaxOnly: false, testsOnly: true, filter: '' })).map((step) => step.kind),
  tests.map(() => 'test')
);
const filtered = await selectSteps({ syntaxOnly: false, testsOnly: false, filter: 'gmail' });
assert.ok(filtered.length > 0);
assert.equal(filtered.every((step) => step.file.includes('gmail')), true);
assert.deepEqual(await selectSteps({ syntaxOnly: false, testsOnly: false, filter: 'yok-boyle-bir-dosya' }), []);

// Argüman ayrıştırma.
assert.deepEqual(parseArgv([]), { list: false, syntaxOnly: false, testsOnly: false, filter: '' });
assert.equal(parseArgv(['--list']).list, true);
assert.equal(parseArgv(['--filter=canva']).filter, 'canva');
assert.throws(() => parseArgv(['--bilinmeyen']), /UNKNOWN_ARGUMENT/);
assert.throws(() => parseArgv(['--syntax-only', '--tests-only']), /CONFLICTING_ARGUMENTS/);

console.log(`Check runner OK: ${syntaxFiles.length} syntax + ${testFiles.length} test adımı keşfedildi, kapı sapması yok`);
