// Kontrol kapısının kendi sözleşmesi.
//
// Bu paket, kapının tekrar elle bakımı gereken sabit bir listeye dönüşmesini
// engeller: `scripts/run-checks.mjs --list` çıktısı diskteki tüm test
// paketlerini içermeli ve package.json kapıyı yalnız bu koşucu üzerinden
// tanımlamalıdır.
//
// Not: koşucu burada yalnız `--list` ile çağrılır; bu mod hiçbir test paketi
// çalıştırmadığı için bu paketin kendisini tekrar tetiklemez.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runner = path.join(ROOT, 'scripts', 'run-checks.mjs');

const listed = execFileSync(process.execPath, [runner, '--list'], { cwd: ROOT, encoding: 'utf8' })
  .trim()
  .split('\n');

const onDisk = readdirSync(path.join(ROOT, 'scripts'))
  .filter((file) => file.startsWith('test-') && file.endsWith('.mjs'))
  .sort();

assert.ok(onDisk.length >= 80, 'test paketleri diskte bulunmalı');
for (const suite of onDisk) {
  assert.ok(listed.includes(suite), `kapı ${suite} paketini atlıyor`);
}
assert.equal(listed[0], 'validate-agent-registry.mjs', 'registry doğrulaması ilk sırada çalışmalı');
assert.equal(listed.length, onDisk.length + 1);
assert.equal(new Set(listed).size, listed.length, 'paketler tekrarlanmamalı');

const filtered = execFileSync(process.execPath, [runner, '--list', '--filter', 'gmail'], {
  cwd: ROOT,
  encoding: 'utf8'
}).trim().split('\n');
assert.ok(filtered.length > 0 && filtered.length < listed.length);
assert.equal(filtered.every((suite) => suite.includes('gmail')), true);

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
// Kapı hiçbir paketi ada göre sabitlememelidir; aksi halde yeni testler
// yeniden sessizce kapı dışında kalır.
for (const [name, command] of Object.entries(pkg.scripts)) {
  assert.equal(command.includes('scripts/test-'), false, `${name} sabit test listesi içeriyor`);
}

console.log(`check gate OK: ${onDisk.length} paket otomatik keşfediliyor, sabit liste yok`);
