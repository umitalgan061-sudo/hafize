import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EXCLUDED_TESTS, discoverSyntaxTargets, discoverTestFiles, planChecks } from './run-checks.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const testFiles = await discoverTestFiles(ROOT);
const plan = await planChecks({ root: ROOT });

// 1) Hiçbir test dosyası sessizce gate dışında kalamaz: ya çalışır ya da gerekçesiyle listelenir.
const scheduled = new Set(plan.tests.map((file) => file.replace(/^scripts\//, '')));
const skipped = new Set(plan.skipped.map((entry) => entry.name));
for (const name of testFiles) {
  assert.equal(
    scheduled.has(name) || skipped.has(name),
    true,
    `${name} ne çalıştırılıyor ne de gerekçeli olarak dışlanmış`
  );
  assert.equal(scheduled.has(name) && skipped.has(name), false, `${name} hem çalışıyor hem dışlanmış`);
}
assert.ok(plan.tests.length >= 80, `beklenenden az test planlandı: ${plan.tests.length}`);

// 2) Her dışlama gerekçelidir ve gerçekten var olan bir dosyayı hedefler.
for (const [name, reason] of Object.entries(EXCLUDED_TESTS)) {
  assert.equal(testFiles.includes(name), true, `dışlanan ${name} dosyası mevcut değil`);
  assert.equal(typeof reason === 'string' && reason.trim().length >= 20, true, `${name} için gerekçe yetersiz`);
}
assert.equal(plan.skipped.length, Object.keys(EXCLUDED_TESTS).length);

// 3) `--include-live` dışlananları da plana alır.
const livePlan = await planChecks({ root: ROOT, includeLive: true });
assert.deepEqual(livePlan.skipped, []);
assert.equal(livePlan.tests.length, testFiles.length);

// 4) Syntax denetimi kaynak dosyaların tamamını kapsar (server.mjs, lib/, public/, scripts/).
const syntax = await discoverSyntaxTargets(ROOT);
assert.equal(syntax.includes('server.mjs'), true);
for (const sample of ['lib/tool-runtime.mjs', 'public/app.js', 'public/sw.js', 'scripts/run-checks.mjs']) {
  assert.equal(syntax.includes(sample), true, `${sample} syntax denetimi dışında`);
}
assert.equal(new Set(syntax).size, syntax.length, 'syntax hedeflerinde tekrar var');

// 5) Filtre birden fazla terimi OR olarak uygular.
const filtered = await planChecks({ root: ROOT, filter: 'voice-input,ui-shell' });
assert.deepEqual(filtered.tests, ['scripts/test-ui-shell.mjs', 'scripts/test-voice-input.mjs']);
assert.equal(filtered.validators.length, 0);

// 6) package.json gate'i elle yazılmış uzun listeye değil runner'a bağlı kalmalı.
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.check.includes('&&'), false, 'check adımı yeniden elle zincirlenmiş');

console.log(`check runner OK: ${plan.tests.length} test + ${syntax.length} syntax hedefi otomatik keşfediliyor, ${plan.skipped.length} gerekçeli dışlama`);
