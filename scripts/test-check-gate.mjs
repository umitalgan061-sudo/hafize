// Kontrol kapısının kendi sözleşmesi: keşif hiçbir testi veya kaynağı atlamamalı
// ve başarısız bir alt süreç sessizce yutulmamalı.
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PRE_TEST_SCRIPTS,
  ROOT,
  discoverSyntaxTargets,
  discoverTestFiles,
  runNode
} from './run-tests.mjs';

const testFiles = discoverTestFiles();
const onDisk = readdirSync(path.join(ROOT, 'scripts'))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
  .map((name) => `scripts/${name}`)
  .sort();

assert.deepEqual(testFiles, onDisk, 'her scripts/test-*.mjs dosyası kapıda çalışmalı');
assert.ok(testFiles.includes('scripts/test-check-gate.mjs'));
assert.ok(testFiles.length >= 80);
assert.equal(testFiles.includes('scripts/run-tests.mjs'), false, 'koşucu kendini test olarak çalıştırmamalı');

const syntaxTargets = discoverSyntaxTargets();
for (const required of [
  'server.mjs',
  'lib/tool-runtime.mjs',
  'lib/gmail-read-client.mjs',
  'public/app.js',
  'public/hands-free.js',
  'public/screen-share.js',
  'scripts/run-tests.mjs'
]) {
  assert.ok(syntaxTargets.includes(required), `${required} syntax kontrolünde olmalı`);
}
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length, 'aynı dosya iki kez kontrol edilmemeli');
for (const file of PRE_TEST_SCRIPTS) assert.ok(syntaxTargets.includes(file));

const workdir = mkdtempSync(path.join(os.tmpdir(), 'hafize-gate-'));
try {
  const passing = path.join(workdir, 'passing.mjs');
  const failing = path.join(workdir, 'failing.mjs');
  const hanging = path.join(workdir, 'hanging.mjs');
  writeFileSync(passing, 'console.log("ok");\n');
  writeFileSync(failing, 'console.error("boom");\nprocess.exit(3);\n');
  writeFileSync(hanging, 'setTimeout(() => {}, 60_000);\n');

  const ok = await runNode([passing]);
  assert.equal(ok.ok, true);
  assert.equal(ok.code, 0);

  const failed = await runNode([failing]);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 3);
  assert.match(failed.output, /boom/);

  const timedOut = await runNode([hanging], { timeoutMs: 300 });
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.timedOut, true);
  assert.match(timedOut.output, /TIMEOUT/);

  const missing = await runNode([path.join(workdir, 'yok.mjs')]);
  assert.equal(missing.ok, false);
} finally {
  await rm(workdir, { recursive: true, force: true });
}

console.log(`check gate OK: ${syntaxTargets.length} kaynak, ${testFiles.length} test keşfedildi`);
