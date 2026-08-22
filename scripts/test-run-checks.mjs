import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_TIMEOUT_MS, ROOT, discoverTargets, run } from './run-checks.mjs';

// Kapının kendisi test edilmezse, keşif bozulduğunda kapı sıfır kapsamla
// "temiz" raporlayabilir. Bu suite doğrudan keşif ve çalıştırma yardımcılarını
// çağırır; kapıyı yeniden başlatmaz, dolayısıyla özyineleme oluşmaz.

const { sources, suites } = await discoverTargets();
const scriptNames = (await readdir(path.join(ROOT, 'scripts'), { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name);

// Diskteki her test dosyası kapsamda olmalı; sessiz kapsam kaybı yasak.
for (const name of scriptNames) {
  if (name.startsWith('test-') && name.endsWith('.mjs')) {
    assert.ok(suites.includes(`scripts/${name}`), `suite kapsam dışı: ${name}`);
  }
}
assert.equal(suites[0], 'scripts/validate-agent-registry.mjs');
assert.equal(suites.includes('scripts/run-checks.mjs'), false);
assert.equal(new Set(suites).size, suites.length);
const discoveredTests = suites.slice(1);
assert.deepEqual(discoveredTests, [...discoveredTests].sort(), 'keşif sırası deterministik olmalı');

// Syntax taraması server.mjs ile tüm lib/ ve public/ dosyalarını kapsar.
assert.ok(sources.includes('server.mjs'));
for (const directory of ['lib', 'public']) {
  const expected = (await readdir(path.join(ROOT, directory), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && (directory === 'lib' ? entry.name.endsWith('.mjs') : entry.name.endsWith('.js')))
    .map((entry) => `${directory}/${entry.name}`);
  assert.ok(expected.length > 0, `${directory} boş keşfedildi`);
  for (const file of expected) assert.ok(sources.includes(file), `kaynak kapsam dışı: ${file}`);
}
assert.ok(suites.every((suite) => sources.includes(suite)), 'her suite syntax taramasında da olmalı');
assert.equal(new Set(sources).size, sources.length);

// Çalıştırma yardımcısı başarı, başarısızlık ve zaman aşımını doğru ayırt eder.
const passing = await run(['-e', 'console.log("ok")'], 'passing');
assert.equal(passing.ok, true);
assert.equal(passing.label, 'passing');
assert.equal(passing.output, 'ok');

const failing = await run(['-e', 'console.error("boom"); process.exit(3);'], 'failing');
assert.equal(failing.ok, false);
assert.ok(failing.output.includes('boom'));

const hanging = await run(['-e', 'setInterval(() => {}, 1000);'], 'hanging', 250);
assert.equal(hanging.ok, false);
assert.ok(hanging.output.includes('Zaman aşımı'));

const broken = await run(['--check', 'scripts/test-run-checks.mjs'], 'self');
assert.equal(broken.ok, true);
assert.equal(DEFAULT_TIMEOUT_MS, 120_000);

console.log(`check gate tests passed (${sources.length} kaynak, ${suites.length} suite keşfedildi)`);
