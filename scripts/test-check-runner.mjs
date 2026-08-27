import assert from 'node:assert/strict';
import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverSources, discoverTests, matchesFilters, runChecks, ROOT } from './run-checks.mjs';

// Keşif, depodaki her test ve doğrulayıcı betiği kapsamalıdır; aksi hâlde
// "test var ama kapıda çalışmıyor" boşluğu geri döner.
const scriptEntries = await readdir(join(ROOT, 'scripts'));
const expectedTests = scriptEntries
  .filter((entry) => entry.endsWith('.mjs') && (entry.startsWith('test-') || entry.startsWith('validate-')))
  .map((entry) => `scripts/${entry}`)
  .sort();
const discoveredTests = await discoverTests();
assert.deepEqual(discoveredTests, expectedTests);
assert.ok(discoveredTests.includes('scripts/test-check-runner.mjs'));
assert.ok(discoveredTests.includes('scripts/validate-agent-registry.mjs'));

// Syntax kapısı server, lib, public ve scripts kaynaklarını birlikte kapsar.
const sources = await discoverSources();
assert.ok(sources.includes('server.mjs'));
assert.ok(sources.includes('lib/tool-runtime.mjs'));
assert.ok(sources.includes('public/app.js'));
assert.ok(sources.includes('scripts/run-checks.mjs'));
assert.equal(sources.some((source) => source.startsWith('scripts/test-')), true);

assert.equal(matchesFilters('scripts/test-voice-input.mjs', []), true);
assert.equal(matchesFilters('scripts/test-voice-input.mjs', ['voice']), true);
assert.equal(matchesFilters('scripts/test-voice-input.mjs', ['schedule']), false);

// Başarısız bir test veya bozuk bir kaynak kapıyı kırmızıya çevirmelidir.
const fixtureDir = await mkdtemp(join(tmpdir(), 'hafize-check-'));
const passingTest = join(fixtureDir, 'test-passing.mjs');
const failingTest = join(fixtureDir, 'test-failing.mjs');
const brokenSource = join(fixtureDir, 'broken.mjs');
await writeFile(passingTest, 'console.log("fixture OK");\n');
await writeFile(failingTest, 'process.exit(3);\n');
await writeFile(brokenSource, 'const = ;\n');

const green = await runChecks({ sources: [], tests: [passingTest] });
assert.deepEqual(green.failures, []);
assert.equal(green.testCount, 1);

const redTest = await runChecks({ sources: [], tests: [passingTest, failingTest] });
assert.deepEqual(redTest.failures, [failingTest]);

const redSource = await runChecks({ sources: [brokenSource], tests: [] });
assert.deepEqual(redSource.failures, [brokenSource]);

console.log('Check runner OK: discovery covers every test/validator, filters work, failures surface');
