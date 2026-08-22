// Gate'in kendisi için sözleşme testi: keşif eksiksiz olmalı, başarısız bir
// test gate'i kırmalı ve hiç test bulunamaması sessizce başarı sayılmamalıdır.
// Gate kendi kendini çağırmasın diye gerçek depo yerine geçici bir kök kullanır.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gate = path.join(repoRoot, 'scripts', 'run-checks.mjs');

function runGate(root) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [gate], {
      cwd: repoRoot,
      env: { ...process.env, HAFIZE_CHECK_ROOT: root },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (code) => resolve({ code, output }));
  });
}

async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hafize-gate-'));
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await writeFile(path.join(root, 'scripts', 'validate-agent-registry.mjs'), 'console.log("registry stub ok");\n');
  for (const [name, source] of Object.entries(files)) {
    await writeFile(path.join(root, 'scripts', name), source);
  }
  return root;
}

const PASSING = 'console.log("fixture ok");\n';
const FAILING = 'console.log("before failure");\nthrow new Error("FIXTURE_ASSERTION");\n';
const BAD_SYNTAX = 'export function broken( {\n';

// 1. Sadece geçen testler → gate yeşil ve her test raporlanır.
const greenRoot = await fixture({ 'test-alpha.mjs': PASSING, 'test-beta.mjs': PASSING });
const green = await runGate(greenRoot);
assert.equal(green.code, 0, green.output);
assert.ok(green.output.includes('test-alpha.mjs'), green.output);
assert.ok(green.output.includes('test-beta.mjs'), green.output);
assert.ok(green.output.includes('3/3'), green.output);

// 2. Başarısız test gate'i kırar ve çıktısı gizlenmez.
const redRoot = await fixture({ 'test-alpha.mjs': PASSING, 'test-broken.mjs': FAILING });
const red = await runGate(redRoot);
assert.equal(red.code, 1, red.output);
assert.ok(red.output.includes('test-broken.mjs'), red.output);
assert.ok(red.output.includes('FIXTURE_ASSERTION'), red.output);
// Bir test kırıldığında kalan testler atlanmaz; hepsi çalışır.
assert.ok(red.output.includes('ok  scripts/test-alpha.mjs'), red.output);

// 3. Sözdizimi hatası testlerden önce raporlanır.
const syntaxRoot = await fixture({ 'test-alpha.mjs': PASSING, 'test-syntax.mjs': BAD_SYNTAX });
const syntax = await runGate(syntaxRoot);
assert.equal(syntax.code, 1, syntax.output);
assert.ok(syntax.output.includes('test-syntax.mjs'), syntax.output);

// 4. Hiç test bulunamaması sessiz başarı değildir.
const emptyRoot = await fixture({});
const empty = await runGate(emptyRoot);
assert.equal(empty.code, 1, empty.output);

for (const root of [greenRoot, redRoot, syntaxRoot, emptyRoot]) await rm(root, { recursive: true, force: true });

// 5. Gerçek depoda her test dosyası keşfedilebilir olmalı: gate'in kapsamı
// scripts/test-*.mjs kümesinin tamamıdır, elle tutulan bir liste değil.
const discovered = (await readdir(path.join(repoRoot, 'scripts')))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'));
assert.ok(discovered.length >= 80, `beklenenden az test keşfedildi: ${discovered.length}`);
assert.ok(discovered.includes('test-tool-runtime.mjs'));

console.log(`check gate tests passed (${discovered.length} test dosyası keşfedilebilir)`);
