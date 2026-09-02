import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { collectSyntaxTargets, collectTestScripts } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function filesIn(dir, match) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && match(entry.name)).map((entry) => entry.name);
}

const testScripts = await collectTestScripts();
const syntaxTargets = await collectSyntaxTargets();
const onDiskTests = await filesIn('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));

// Hiçbir test betiği gate dışında kalamaz: kapı listesi elle değil keşifle üretilir.
assert.equal(testScripts.length, onDiskTests.length);
for (const name of onDiskTests) assert.ok(testScripts.includes(`scripts/${name}`), `gate dışı test: ${name}`);
assert.ok(testScripts.includes('scripts/test-check-gate.mjs'));
assert.deepEqual([...testScripts].sort(), testScripts);

// Syntax kontrolü server, lib, scripts ve public yüzeylerinin tamamını kapsar.
const libFiles = await filesIn('lib', (name) => name.endsWith('.mjs'));
const publicFiles = await filesIn('public', (name) => name.endsWith('.js'));
assert.ok(syntaxTargets.includes('server.mjs'));
for (const name of libFiles) assert.ok(syntaxTargets.includes(`lib/${name}`), `gate dışı lib: ${name}`);
for (const name of publicFiles) assert.ok(syntaxTargets.includes(`public/${name}`), `gate dışı public: ${name}`);
for (const name of onDiskTests) assert.ok(syntaxTargets.includes(`scripts/${name}`), `syntax dışı test: ${name}`);
assert.equal(syntaxTargets.includes('public/index.html'), false);
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

// package.json kapısı yeniden elle bakımlı bir dosya listesine dönemez.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(Object.hasOwn(pkg.scripts, 'precheck'), false);
for (const command of Object.values(pkg.scripts)) {
  assert.equal(/scripts\/test-/.test(command), false, 'gate komutunda elle test listesi olmamalı');
}

console.log(`check gate OK: ${syntaxTargets.length} syntax hedefi + ${testScripts.length} test betiği keşifle kapsanıyor`);
