// Doğrulama kapısının kendi testi.
//
// Amaç: kapının test dosyalarını gerçekten dosya sisteminden keşfettiğini ve
// hiçbir testin elle tutulan bir listeden düşerek sessizce çalışmaz hale
// gelemeyeceğini doğrulamak.

import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSyntaxTargets, discoverTestFiles, runChecks } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const scriptEntries = await readdir(path.join(ROOT, 'scripts'), { withFileTypes: true });
const expectedTests = scriptEntries
  .filter((entry) => entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.mjs'))
  .map((entry) => `scripts/${entry.name}`)
  .sort();

// Diskteki her test dosyası kapı tarafından keşfedilir; eksik veya fazla yoktur.
const discoveredTests = await discoverTestFiles();
assert.deepEqual(discoveredTests, expectedTests);
assert.ok(discoveredTests.length >= 80, 'test keşfi beklenenden az dosya buldu');
assert.ok(discoveredTests.includes('scripts/test-check-gate.mjs'));

// Daha önce zincirden düşmüş olan güvenlik testleri kapıda olmalı.
for (const previouslyUnwired of [
  'scripts/test-oauth-pkce.mjs',
  'scripts/test-oauth-token-encryption.mjs',
  'scripts/test-oauth-token-file-store.mjs',
  'scripts/test-google-token-exchange.mjs',
  'scripts/test-canva-read-client.mjs',
  'scripts/test-personal-memory-encryption.mjs'
]) {
  assert.ok(discoveredTests.includes(previouslyUnwired), `${previouslyUnwired} kapıda değil`);
}

// Syntax hedefleri server, lib, public ve scripts katmanlarını kapsar.
const syntaxTargets = await discoverSyntaxTargets();
assert.ok(syntaxTargets.includes('server.mjs'));
assert.ok(syntaxTargets.includes('lib/tool-runtime.mjs'));
assert.ok(syntaxTargets.includes('public/app.js'));
assert.ok(syntaxTargets.includes('scripts/run-checks.mjs'));
// Keşif dizin bazlıdır; hiçbir hedef elle sayılmaz.
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);

// Filtrelenmiş çalıştırma yalnız eşleşen hedefleri koşar ve başarıyı raporlar.
// Filtre bilinçli olarak bu dosyayı eşleştirmez; kapı kendini yeniden çağırmaz.
const lines = [];
const filtered = await runChecks({ filter: 'validate-agent-registry', log: (line) => lines.push(line) });
assert.equal(filtered.ok, true);
assert.deepEqual(filtered.failures, []);
assert.equal(filtered.total, 2, 'filtre bir syntax hedefi + bir doğrulayıcı çalıştırmalı');
assert.ok(lines.some((line) => line.includes('ok    scripts/validate-agent-registry.mjs')));

// Başarısız bir paket kapıyı kırar ve çıktısı gizlenmez.
const fixture = path.join(await mkdtemp(path.join(tmpdir(), 'hafize-gate-')), 'failing.mjs');
await writeFile(fixture, 'throw new Error("HAFIZE_GATE_FIXTURE_FAILURE");\n', 'utf8');
const failingLines = [];
const failing = await runChecks({
  sources: { syntaxTargets: [], testFiles: [fixture], validators: [] },
  log: (line) => failingLines.push(line)
});
assert.equal(failing.ok, false);
assert.deepEqual(failing.failures, [fixture]);
assert.ok(failingLines.join('\n').includes('HAFIZE_GATE_FIXTURE_FAILURE'), 'başarısız paketin çıktısı gizlenmemeli');
await rm(path.dirname(fixture), { recursive: true, force: true });

// Bozuk syntax da kapıyı kırar.
const badSyntax = path.join(await mkdtemp(path.join(tmpdir(), 'hafize-gate-')), 'broken.mjs');
await writeFile(badSyntax, 'const = ;\n', 'utf8');
const brokenSyntax = await runChecks({
  sources: { syntaxTargets: [badSyntax], testFiles: [], validators: [] },
  log: () => {}
});
assert.equal(brokenSyntax.ok, false);
assert.deepEqual(brokenSyntax.failures, [badSyntax]);
await rm(path.dirname(badSyntax), { recursive: true, force: true });

console.log(`check gate OK: ${syntaxTargets.length} syntax hedefi ve ${discoveredTests.length} test paketi keşfedildi`);
