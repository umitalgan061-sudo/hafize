import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  EXCLUDED_TESTS,
  EXTRA_VALIDATORS,
  ROOT,
  collectSyntaxTargets,
  collectTestScripts,
  main
} from './run-checks.mjs';

async function names(directory, predicate) {
  const entries = await readdir(path.join(ROOT, directory), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && predicate(entry.name)).map((entry) => `${directory}/${entry.name}`);
}

const syntaxTargets = await collectSyntaxTargets();
const testScripts = await collectTestScripts();
const allTests = await names('scripts', (name) => name.startsWith('test-') && name.endsWith('.mjs'));

// Her test ya kapıda çalışır ya da gerekçeli olarak dışlanmıştır.
for (const test of allTests) {
  const base = path.basename(test);
  const covered = testScripts.includes(test) || EXCLUDED_TESTS.has(base);
  assert.ok(covered, `${base} ne kapıda çalışıyor ne de gerekçeli dışlanmış`);
  assert.equal(testScripts.includes(test) && EXCLUDED_TESTS.has(base), false, `${base} hem dışlanmış hem çalışıyor`);
}
assert.equal(testScripts.length + EXCLUDED_TESTS.size, allTests.length);
assert.ok(testScripts.length >= 80, 'kapı beklenenden az test topluyor');

// Dışlama listesi gerçek dosyalara ve boş olmayan gerekçelere işaret etmelidir.
for (const [base, reason] of EXCLUDED_TESTS) {
  assert.ok(allTests.includes(`scripts/${base}`), `dışlanan ${base} diskte yok`);
  assert.equal(typeof reason, 'string');
  assert.ok(reason.trim().length >= 10, `${base} için gerekçe yetersiz`);
}

// Syntax kapısı server, lib, public ve scripts ağaçlarının tamamını kapsar.
const expectedSyntax = [
  'server.mjs',
  ...(await names('lib', (name) => name.endsWith('.mjs'))),
  ...(await names('public', (name) => name.endsWith('.js'))),
  ...(await names('scripts', (name) => name.endsWith('.mjs')))
];
for (const target of expectedSyntax) {
  assert.ok(syntaxTargets.includes(target), `${target} syntax kapısında yok`);
}
assert.equal(syntaxTargets.length, expectedSyntax.length);
assert.deepEqual([...syntaxTargets].sort(), [...new Set(syntaxTargets)].sort(), 'syntax hedefleri tekrarlı');

// Registry doğrulayıcısı testlerden önce çalışmaya devam eder.
assert.ok(EXTRA_VALIDATORS.includes('validate-agent-registry.mjs'));
for (const validator of EXTRA_VALIDATORS) {
  assert.equal(testScripts.includes(`scripts/${validator}`), false, `${validator} iki kez çalışıyor`);
  assert.ok(
    (await names('scripts', (name) => name === validator)).length === 1,
    `${validator} diskte yok`
  );
}

// --list ayağı hiçbir alt süreç başlatmadan başarıyla döner.
const originalLog = console.log;
const listed = [];
console.log = (...args) => listed.push(args.join(' '));
try {
  assert.equal(await main(['--list']), 0);
} finally {
  console.log = originalLog;
}
assert.ok(listed.some((line) => line.startsWith(`syntax (${syntaxTargets.length})`)));
assert.ok(listed.some((line) => line.startsWith(`test (${testScripts.length})`)));

console.log(`run-checks OK: ${syntaxTargets.length} syntax hedefi, ${testScripts.length} test keşfedildi, ${EXCLUDED_TESTS.size} gerekçeli dışlama`);
