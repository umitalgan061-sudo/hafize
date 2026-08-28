import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectSyntaxFiles,
  collectTestFiles,
  parseCheckArgs,
  selectTests,
  SYNTAX_TARGETS,
  TEST_PREFIX
} from '../lib/check-inventory.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Keşif, diskteki her test paketini kapsamalı: kapıya elle ekleme unutulamaz.
const scriptEntries = await readdir(path.join(ROOT, 'scripts'), { withFileTypes: true });
const onDisk = scriptEntries
  .filter((entry) => entry.isFile() && entry.name.startsWith(TEST_PREFIX) && entry.name.endsWith('.mjs'))
  .map((entry) => `scripts/${entry.name}`)
  .sort();

const discovered = await collectTestFiles(ROOT);
assert.deepEqual(discovered, onDisk);
assert.ok(discovered.length >= 80, `beklenenden az test paketi keşfedildi: ${discovered.length}`);
assert.equal(discovered.includes('scripts/run-checks.mjs'), false);
assert.equal(discovered.includes('scripts/validate-agent-registry.mjs'), false);
assert.ok(discovered.includes('scripts/test-oauth-pkce.mjs'));
assert.ok(discovered.includes('scripts/test-personal-memory-encryption.mjs'));
assert.ok(discovered.includes('scripts/test-check-inventory.mjs'));

// Syntax taraması server.mjs, lib, scripts ve public tarafını birlikte kapsar.
const syntaxFiles = await collectSyntaxFiles(ROOT);
assert.ok(syntaxFiles.includes('server.mjs'));
assert.ok(syntaxFiles.includes('lib/check-inventory.mjs'));
assert.ok(syntaxFiles.includes('scripts/run-checks.mjs'));
assert.ok(syntaxFiles.includes('public/app.js'));
assert.ok(syntaxFiles.includes('public/sw.js'));
assert.equal(syntaxFiles.includes('public/styles.css'), false);
assert.equal(syntaxFiles.includes('package.json'), false);
assert.equal(new Set(syntaxFiles).size, syntaxFiles.length);
for (const target of SYNTAX_TARGETS) assert.ok(Object.isFrozen(target));

// Argüman ayrıştırma katıdır: bilinmeyen bayrak sessizce yutulmaz.
assert.deepEqual(parseCheckArgs([]).filters, []);
assert.deepEqual(parseCheckArgs(['--only', 'gmail']).filters, ['gmail']);
assert.deepEqual(parseCheckArgs(['--only=canva', '--only', 'oauth']).filters, ['canva', 'oauth']);
for (const argv of [['--only'], ['--only', ''], ['--only', '--other'], ['--only='], ['-x'], ['test-x'], [null]]) {
  assert.throws(() => parseCheckArgs(argv), /INVALID_CHECK_INVENTORY/);
}
assert.throws(() => parseCheckArgs('gmail'), /INVALID_CHECK_INVENTORY/);

// Filtre yoksa tüm paketler seçilir; filtre yalnız eşleşenleri daraltır.
const sample = ['scripts/test-a.mjs', 'scripts/test-gmail-read.mjs', 'scripts/test-canva-read.mjs'];
assert.deepEqual(selectTests(sample, []), sample);
assert.deepEqual(selectTests(sample, ['gmail']), ['scripts/test-gmail-read.mjs']);
assert.deepEqual(selectTests(sample, ['gmail', 'canva']).length, 2);
assert.deepEqual(selectTests(sample, ['yok']), []);
assert.notEqual(selectTests(sample, []), sample);
assert.throws(() => selectTests(null, []), /INVALID_CHECK_INVENTORY/);
assert.throws(() => selectTests(sample, 'gmail'), /INVALID_CHECK_INVENTORY/);

await assert.rejects(() => collectTestFiles(''), /INVALID_CHECK_INVENTORY/);
await assert.rejects(() => collectSyntaxFiles(null), /INVALID_CHECK_INVENTORY/);

console.log(`check inventory tests passed (${discovered.length} test paketi, ${syntaxFiles.length} kaynak dosya)`);
