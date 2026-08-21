import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { discoverSyntaxTargets, discoverTests, EXCLUDED_TESTS, ROOT } from './run-checks.mjs';

// Kapı kapsamı: scripts/ altındaki her test ya çalıştırılır ya da gerekçesi
// yazılmış bir istisnadır. Sessizce kapsam dışı kalan test olamaz.
const everyTest = readdirSync(path.join(ROOT, 'scripts'))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'));
const executed = new Set(discoverTests());

for (const name of everyTest) {
  const excluded = EXCLUDED_TESTS.has(name);
  assert.equal(
    executed.has(name) !== excluded,
    true,
    `${name} ya çalıştırılmalı ya da EXCLUDED_TESTS içinde gerekçelendirilmeli`
  );
}
assert.equal(executed.size + EXCLUDED_TESTS.size, everyTest.length);
assert.ok(executed.has('test-check-gate.mjs'), 'kapı kendi testini de çalıştırmalı');

// Her istisna boş olmayan bir gerekçe taşımalı ve gerçekten var olmalı.
for (const [name, reason] of EXCLUDED_TESTS) {
  assert.ok(everyTest.includes(name), `istisna listesindeki ${name} mevcut değil`);
  assert.equal(typeof reason === 'string' && reason.trim().length >= 10, true, `${name} gerekçesi yetersiz`);
}

// Sözdizimi kapsamı: server.mjs, tüm lib/ modülleri ve tüm public/ istemci
// dosyaları kapıya dahil olmalı.
const syntaxTargets = new Set(discoverSyntaxTargets());
assert.ok(syntaxTargets.has('server.mjs'));
for (const dir of ['lib', 'scripts']) {
  for (const name of readdirSync(path.join(ROOT, dir)).filter((file) => file.endsWith('.mjs'))) {
    assert.ok(syntaxTargets.has(path.join(dir, name)), `${dir}/${name} sözdizimi kontrolü dışında`);
  }
}
for (const name of readdirSync(path.join(ROOT, 'public')).filter((file) => file.endsWith('.js'))) {
  assert.ok(syntaxTargets.has(path.join('public', name)), `public/${name} sözdizimi kontrolü dışında`);
}

// package.json tek kapıyı çağırmalı; elle tutulan paralel bir liste kalmamalı.
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(pkg.scripts.precheck, undefined, 'precheck kapısı check ile aynı testleri tekrar çalıştırıyordu');

console.log(`check gate tests passed (${executed.size} test, ${EXCLUDED_TESTS.size} gerekçeli istisna, ${syntaxTargets.size} sözdizimi hedefi)`);
