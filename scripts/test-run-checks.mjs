// Kalite kapısının kendi sözleşmesini kilitler.
//
// Asıl regresyon: `scripts/test-*.mjs` altına yeni bir test eklenip kapıya
// bağlanmayı unutulduğunda test sessizce hiç çalışmıyordu. Aşağıdaki keşif
// testi, diskteki her test dosyasının plana girdiğini doğrular.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNNER = path.join(ROOT, 'scripts/run-checks.mjs');

function runner(args) {
  return spawnSync(process.execPath, [RUNNER, ...args], { cwd: ROOT, encoding: 'utf8' });
}

function listFiles(dir, predicate) {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => `${dir}/${entry.name}`);
}

const plan = runner(['--list']);
assert.equal(plan.status, 0);
const planned = new Set(plan.stdout.split('\n').map((line) => line.trim()).filter(Boolean));

// Diskteki hiçbir test dosyası kapının dışında kalamaz.
const testFiles = listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));
assert.ok(testFiles.length > 50, 'test keşfi beklenenden az dosya buldu');
for (const file of testFiles) {
  assert.ok(planned.has(file), `kapıya bağlanmamış test: ${file}`);
}
assert.ok(planned.has('scripts/validate-agent-registry.mjs'));

// Her çalıştırılabilir kaynak syntax taramasına girer.
for (const file of ['server.mjs', ...listFiles('lib', (n) => n.endsWith('.mjs')), ...listFiles('public', (n) => n.endsWith('.js'))]) {
  assert.ok(planned.has(file), `syntax taramasına girmeyen kaynak: ${file}`);
}

// Filtre planı daraltır ama var olmayan filtre sessizce yeşil dönmez.
const filtered = runner(['--list', '--filter=voice']);
assert.equal(filtered.status, 0);
assert.ok(filtered.stdout.includes('scripts/test-voice-input.mjs'));
assert.equal(filtered.stdout.includes('scripts/test-task-ledger.mjs'), false);

const empty = runner(['--list', '--filter=__hicbir_adim_eslesmez__']);
assert.equal(empty.status, 1);
assert.ok(empty.stderr.includes('Hiçbir adım'));

console.log(`run-checks OK: ${testFiles.length} test ve tüm kaynaklar kapıya otomatik bağlı, filtre sözleşmesi korunuyor`);
