import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { collectSyntaxTargets, collectTestScripts } from './run-checks.mjs';

const scriptEntries = await readdir(new URL('../scripts/', import.meta.url), { withFileTypes: true });
const testFiles = scriptEntries
  .filter((entry) => entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.mjs'))
  .map((entry) => `scripts/${entry.name}`)
  .sort();

const testScripts = await collectTestScripts();
const syntaxTargets = await collectSyntaxTargets();

// Gate'in asıl güvencesi: diskteki her test dosyası çalıştırılır. Bu invariant
// olmadan yeni bir test sessizce kapsam dışında kalabilir.
for (const file of testFiles) {
  assert.ok(testScripts.includes(file), `test script not covered by check gate: ${file}`);
}
assert.ok(testFiles.length >= 80, `unexpectedly few test scripts discovered: ${testFiles.length}`);
assert.ok(testScripts.includes('scripts/validate-agent-registry.mjs'));
assert.equal(new Set(testScripts).size, testScripts.length, 'check gate must not run a script twice');
assert.ok(testScripts.includes('scripts/test-check-runner.mjs'), 'runner must cover its own test');

// Syntax kapsamı: server.mjs, tüm lib/*.mjs, public/*.js ve scripts/*.mjs.
assert.ok(syntaxTargets.includes('server.mjs'));
assert.ok(syntaxTargets.includes('lib/tool-runtime.mjs'));
assert.ok(syntaxTargets.includes('public/app.js'));
assert.ok(syntaxTargets.includes('scripts/run-checks.mjs'));
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length, 'syntax targets must be unique');
for (const file of testFiles) {
  assert.ok(syntaxTargets.includes(file), `test script missing from syntax check: ${file}`);
}
const libEntries = await readdir(new URL('../lib/', import.meta.url), { withFileTypes: true });
for (const entry of libEntries) {
  if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
  assert.ok(syntaxTargets.includes(`lib/${entry.name}`), `lib module missing from syntax check: ${entry.name}`);
}

// Sıralama deterministik olmalı ki gate çıktısı turdan tura karşılaştırılabilsin.
assert.deepEqual(testScripts.slice(1), [...testScripts.slice(1)].sort());

console.log(
  `check runner OK: ${testScripts.length} test scripts and ${syntaxTargets.length} syntax targets discovered, none excluded`
);
