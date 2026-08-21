import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

// Hafize'nin kalite kapısı yalnızca `npm run check` / `npm run precheck` içinde
// gerçekten çalıştırılan testlerden oluşur. Depoya test dosyası eklenip kapıya
// bağlanmadığında o test sessizce ölü koda dönüşür ve regresyon fark edilmez.
// Bu koruma, kapının kapsam kaymasını bir sonraki turda değil aynı turda yakalar.

const packageUrl = new URL('../package.json', import.meta.url);
const scriptsUrl = new URL('../scripts/', import.meta.url);

const manifest = JSON.parse(await readFile(packageUrl, 'utf8'));
const precheck = manifest?.scripts?.precheck;
const check = manifest?.scripts?.check;

assert.equal(typeof precheck, 'string', 'package.json içinde precheck script tanımı yok');
assert.equal(typeof check, 'string', 'package.json içinde check script tanımı yok');

const gate = `${precheck} && ${check}`;

const testFiles = (await readdir(scriptsUrl))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
  .sort();

assert.ok(testFiles.length >= 80, `beklenenden az test dosyası bulundu: ${testFiles.length}`);

const unwired = testFiles.filter((name) => !gate.includes(`node scripts/${name}`));
assert.deepEqual(
  unwired,
  [],
  `kalite kapısına bağlanmamış test dosyaları var; package.json check/precheck güncellenmeli:\n- ${unwired.join('\n- ')}`
);

// Kapıya bağlanan her yol gerçekten var olmalı; silinen bir dosyaya yapılan
// referans kapının ilk adımda çökmesine ve tüm testlerin atlanmasına yol açar.
const known = new Set(testFiles);
const referenced = [...gate.matchAll(/scripts\/([\w.-]+\.mjs)/g)].map((match) => match[1]);
const dead = [...new Set(referenced)]
  .filter((name) => name.startsWith('test-'))
  .filter((name) => !known.has(name))
  .sort();
assert.deepEqual(dead, [], `kalite kapısı var olmayan test dosyalarına referans veriyor:\n- ${dead.join('\n- ')}`);

// Doğrulama betiği de kapının bir parçası olmalı, aksi halde koruma kendi
// kendini devre dışı bırakabilir.
assert.ok(check.includes('node scripts/test-check-gate-coverage.mjs'), 'kapsam koruması check içinde çalıştırılmıyor');
assert.ok(check.includes('node scripts/validate-agent-registry.mjs'), 'agent registry doğrulaması check içinde çalıştırılmıyor');

// Kapı, betikleri sıralı `&&` zinciriyle çalıştırır; ilk hata turu durdurur.
assert.equal(check.includes('||'), false, 'check zinciri hata yutan bir dallanma içeriyor');
assert.equal(precheck.includes('||'), false, 'precheck zinciri hata yutan bir dallanma içeriyor');
assert.equal(/;\s*(exit\s+0|true)\b/.test(gate), false, 'kalite kapısı çıkış kodunu maskeliyor');

console.log(`Check gate coverage OK: ${testFiles.length} test dosyasının tamamı npm run precheck/check zincirine bağlı`);
