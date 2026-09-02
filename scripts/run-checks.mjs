// Hafize tek giriş noktalı doğrulama kapısı.
//
// package.json içindeki elle bakımlı dev komut zinciri, yeni eklenen testlerin
// sessizce kapı dışında kalmasına yol açıyordu. Bu runner testleri diskten
// keşfeder; bir test dosyası ancak burada açık gerekçesiyle listelendiğinde
// atlanabilir.

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Kapı dışında bırakılan testler yalnızca burada, gerekçesiyle tanımlanır.
const SKIPPED_TESTS = new Map([
  ['test-redis-schedule-lease-live.mjs', 'canlı Redis sunucusu gerektirir (REDIS_URL)']
]);

async function listFiles(dir, filter) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && filter(entry.name))
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
}

function run(args, label) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => resolve({ label, ok: false, output: String(error?.message ?? error) }));
    child.on('close', (code) => resolve({ label, ok: code === 0, output: output.trim() }));
  });
}

const syntaxTargets = [
  'server.mjs',
  ...(await listFiles('lib', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('scripts', (name) => name.endsWith('.mjs'))),
  ...(await listFiles('public', (name) => name.endsWith('.js')))
];

const testFiles = await listFiles('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));
const validators = await listFiles('scripts', (name) => name.startsWith('validate-') && name.endsWith('.mjs'));

const failures = [];

for (const target of syntaxTargets) {
  const result = await run(['--check', target], `syntax ${target}`);
  if (!result.ok) failures.push(result);
}
console.log(`Syntax OK: ${syntaxTargets.length - failures.length}/${syntaxTargets.length} dosya`);

const skipped = [];
let passed = 0;
for (const file of [...validators, ...testFiles]) {
  const name = path.basename(file);
  const reason = SKIPPED_TESTS.get(name);
  if (reason) {
    skipped.push(`${name} — ${reason}`);
    continue;
  }
  const result = await run([file], name);
  if (result.ok) {
    passed += 1;
    const summary = result.output.split('\n').filter(Boolean).pop() ?? name;
    console.log(`ok   ${name}: ${summary}`);
  } else {
    failures.push(result);
    console.log(`FAIL ${name}`);
  }
}

for (const entry of skipped) console.log(`skip ${entry}`);

console.log(`\nÖzet: ${passed} test geçti, ${skipped.length} atlandı, ${failures.length} başarısız.`);

if (failures.length) {
  for (const failure of failures) {
    console.error(`\n----- ${failure.label} -----\n${failure.output}`);
  }
  process.exitCode = 1;
}
