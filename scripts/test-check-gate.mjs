// Kalite kapısının kendi sözleşmesi.
//
// Regresyon bağlamı: kapı daha önce `package.json` içinde elle tutulan tek
// satırlık bir komut zinciriydi. Yeni testler zincire eklenmediği için 85
// testin 33'ü hiç çalışmıyordu ve zincir ilk hatada durduğu için kalan tüm
// testler sessizce atlanıyordu. Bu test her iki davranışı da kilitler.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'scripts', 'run-checks.mjs');

function runGate(args, cwd = ROOT) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// 1) Kapı komutu keşif tabanlı kalmalı: package.json'a elle test listesi geri sızmamalı.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.test, 'node scripts/run-checks.mjs');
for (const [name, command] of Object.entries(pkg.scripts)) {
  assert.equal(
    /scripts\/test-/.test(command),
    false,
    `npm script "${name}" tekil test yolu içeriyor; kapı yeniden elle tutulan listeye dönüyor`
  );
}

// 2) Diskteki her test dosyası kapı tarafından keşfedilmeli.
const onDisk = (await readdir(path.join(ROOT, 'scripts')))
  .filter((file) => file.startsWith('test-') && file.endsWith('.mjs'))
  .map((file) => `scripts/${file}`)
  .sort();
const listed = await runGate(['--list']);
assert.equal(listed.code, 0);
const discovered = listed.stdout.trim().split('\n').filter(Boolean);
for (const file of onDisk) {
  assert.ok(discovered.includes(file), `kapı ${file} dosyasını keşfetmiyor`);
}
assert.ok(discovered.includes('scripts/validate-agent-registry.mjs'));
assert.ok(discovered.includes('scripts/test-check-gate.mjs'), 'bu testin kendisi de kapıda olmalı');

// 3) İzole bir ağaçta: tüm testler çalışmalı, ilk hatada durulmamalı ve exit kodu 1 olmalı.
const sandbox = await mkdtemp(path.join(os.tmpdir(), 'hafize-gate-'));
try {
  await mkdir(path.join(sandbox, 'scripts'), { recursive: true });
  await mkdir(path.join(sandbox, 'lib'), { recursive: true });
  await writeFile(path.join(sandbox, 'scripts', 'test-alpha.mjs'), 'console.log("alpha ok");\n');
  await writeFile(
    path.join(sandbox, 'scripts', 'test-beta.mjs'),
    'console.error("BETA_MARKER_FAILURE");\nprocess.exit(1);\n'
  );
  await writeFile(path.join(sandbox, 'scripts', 'test-gamma.mjs'), 'console.log("gamma ok");\n');
  await writeFile(path.join(sandbox, 'lib', 'broken.mjs'), 'export function broken( {\n');

  const failing = await runGate(['--root', sandbox]);
  assert.equal(failing.code, 1, 'başarısız kapı sıfır olmayan kod döndürmeli');
  const failingOutput = `${failing.stdout}${failing.stderr}`;
  // Hatalı testten sonra gelen test yine de çalışmış olmalı.
  assert.match(failingOutput, /ok {3}scripts\/test-gamma\.mjs/);
  assert.match(failingOutput, /FAIL scripts\/test-beta\.mjs/);
  assert.match(failingOutput, /tests: 2\/3 geçti/);
  // Hata çıktısı raporda görünmeli; sessizce yutulmamalı.
  assert.match(failingOutput, /BETA_MARKER_FAILURE/);
  // Sözdizimi taraması da ayrı bir hata olarak raporlanmalı.
  assert.match(failingOutput, /lib\/broken\.mjs/);

  // Yalnız geçen testlere filtre uygulandığında kapı yeşil olmalı.
  const filtered = await runGate(['--root', sandbox, '--tests-only', 'alpha']);
  assert.equal(filtered.code, 0);
  assert.match(filtered.stdout, /tests: 1\/1 geçti/);

  // Eksik dizinler kapıyı düşürmemeli (sandbox'ta public/ yok).
  const syntaxOnly = await runGate(['--root', sandbox, '--syntax-only']);
  assert.equal(syntaxOnly.code, 1);
  assert.match(`${syntaxOnly.stdout}${syntaxOnly.stderr}`, /lib\/broken\.mjs/);
} finally {
  await rm(sandbox, { recursive: true, force: true });
}

// 4) Kullanım hataları temiz mesajla ve sıfır olmayan kodla bitmeli.
const unknownOption = await runGate(['--bogus']);
assert.equal(unknownOption.code, 1);
assert.match(unknownOption.stderr, /kullanım hatası/);
const noMatch = await runGate(['--tests-only', 'hicbir-teste-uymayan-filtre']);
assert.equal(noMatch.code, 1);
assert.match(noMatch.stderr, /hiçbir test filtreyle eşleşmedi/);
const missingRoot = await runGate(['--root']);
assert.equal(missingRoot.code, 1);
assert.match(missingRoot.stderr, /MISSING_ROOT_VALUE/);

console.log(`check gate OK: ${onDisk.length} test keşfedildi, hata toplama ve exit kodu sözleşmesi doğrulandı`);
