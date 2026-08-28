#!/usr/bin/env node
// Hafize doğrulama kapısı.
//
// Adımları elle bakımı yapılan uzun bir `&&` zinciri yerine dosya sisteminden
// keşfeder. Böylece yeni bir `scripts/test-*.mjs` eklendiğinde kapıya
// bağlanması unutulamaz ve tek bir kırmızı test arkasındaki diğer
// başarısızlıklar gizlenmez.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEP_TIMEOUT_MS = 180_000;

function listFiles(dir, extension) {
  return readdirSync(path.join(ROOT, dir))
    .filter((name) => name.endsWith(extension))
    .sort()
    .map((name) => `${dir}/${name}`);
}

const syntaxTargets = [
  'server.mjs',
  ...listFiles('lib', '.mjs'),
  ...listFiles('public', '.js'),
  ...listFiles('scripts', '.mjs')
];

const testTargets = listFiles('scripts', '.mjs').filter((file) =>
  path.basename(file).startsWith('test-')
);

if (testTargets.length === 0) {
  console.error('check: scripts/test-*.mjs bulunamadı');
  process.exit(1);
}

const steps = [
  ...syntaxTargets.map((file) => ({ label: `syntax ${file}`, args: ['--check', file], quiet: true })),
  { label: 'validate-agent-registry', args: ['scripts/validate-agent-registry.mjs'] },
  ...testTargets.map((file) => ({ label: file, args: [file] }))
];

const failures = [];
let passed = 0;

for (const step of steps) {
  const result = spawnSync(process.execPath, step.args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: STEP_TIMEOUT_MS
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();

  if (result.error?.code === 'ETIMEDOUT' || result.signal) {
    failures.push({ label: step.label, output: output || `zaman aşımı (${STEP_TIMEOUT_MS} ms)` });
    console.error(`TIMEOUT ${step.label}`);
    continue;
  }
  if (result.status !== 0) {
    failures.push({ label: step.label, output: output || `çıkış kodu ${result.status}` });
    console.error(`FAIL ${step.label}`);
    continue;
  }

  passed += 1;
  if (!step.quiet && output) console.log(output);
}

console.log(
  `\ncheck özeti: ${passed}/${steps.length} adım geçti ` +
    `(${syntaxTargets.length} syntax, ${testTargets.length} test).`
);

if (failures.length > 0) {
  console.error(`\n${failures.length} adım başarısız:`);
  for (const failure of failures) {
    console.error(`\n--- ${failure.label} ---\n${failure.output}`);
  }
  process.exit(1);
}
