import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  discoverSyntaxTargets,
  discoverTestScripts,
  exitCodeFor,
  runChecks,
  selectTestScripts,
  summarize
} from './run-checks.mjs';

// Keşif yalnız `test-*.mjs` dosyalarını alır ve sıralar.
assert.deepEqual(
  selectTestScripts(['test-b.mjs', 'run-checks.mjs', 'test-a.mjs', 'test-c.js', 'validate-agent-registry.mjs', 'notes.md']),
  ['scripts/test-a.mjs', 'scripts/test-b.mjs']
);
assert.deepEqual(selectTestScripts([]), []);

// Gerçek depo keşfi: bu dosya kendisi kapsanmalı, sözdizimi hedefleri kaynakları içermeli.
const realTests = await discoverTestScripts();
assert.ok(realTests.includes('scripts/test-run-checks.mjs'));
assert.ok(realTests.includes('scripts/test-tool-runtime.mjs'));
assert.equal(realTests.includes('scripts/run-checks.mjs'), false);

const realSyntax = await discoverSyntaxTargets();
assert.ok(realSyntax.includes('server.mjs'));
assert.ok(realSyntax.includes('lib/tool-runtime.mjs'));
assert.ok(realSyntax.includes('public/app.js'));
assert.ok(realSyntax.includes('scripts/run-checks.mjs'));
assert.equal(realSyntax.some((target) => target.endsWith('.jpeg') || target.endsWith('.css')), false);
assert.equal(new Set(realSyntax).size, realSyntax.length);

// Özet ve çıkış kodu davranışı.
const mixed = summarize([{ name: 'a', ok: true }, { name: 'b', ok: false, output: 'boom' }]);
assert.deepEqual({ total: mixed.total, passed: mixed.passed, failed: mixed.failed }, { total: 2, passed: 1, failed: 1 });
assert.deepEqual(mixed.failures.map((failure) => failure.name), ['b']);
assert.equal(exitCodeFor(summarize([{ name: 'a', ok: true }])), 0);
assert.equal(exitCodeFor(summarize([{ name: 'a', ok: true }]), mixed), 1);

// Uçtan uca: tek bir başarısızlık diğer testleri gizlememeli.
const root = await mkdtemp(path.join(tmpdir(), 'hafize-checks-'));
await mkdir(path.join(root, 'scripts'), { recursive: true });
await mkdir(path.join(root, 'lib'), { recursive: true });
await writeFile(path.join(root, 'server.mjs'), 'export const ok = true;\n');
await writeFile(path.join(root, 'lib/broken.mjs'), 'export const = ;\n');
await writeFile(path.join(root, 'lib/fine.mjs'), 'export const fine = 1;\n');
await writeFile(path.join(root, 'scripts/validate-agent-registry.mjs'), 'console.log("registry ok");\n');
await writeFile(path.join(root, 'scripts/test-first.mjs'), 'console.log("first ok");\n');
await writeFile(path.join(root, 'scripts/test-second.mjs'), 'throw new Error("SECOND_FAILS");\n');
await writeFile(path.join(root, 'scripts/test-third.mjs'), 'console.log("third ok");\n');

const report = await runChecks({ root, timeoutMs: 30_000, concurrency: 2 });
assert.equal(report.tests.total, 3);
assert.equal(report.tests.passed, 2);
assert.deepEqual(report.tests.failures.map((failure) => failure.name), ['scripts/test-second.mjs']);
assert.match(report.tests.failures[0].output, /SECOND_FAILS/);
assert.equal(report.syntax.failed, 1);
assert.deepEqual(report.syntax.failures.map((failure) => failure.name), ['lib/broken.mjs']);
assert.equal(report.registry.failed, 0);
assert.equal(report.exitCode, 1);

// Takılan bir test kapıyı sonsuza kadar bloklamamalı.
await writeFile(path.join(root, 'scripts/test-second.mjs'), 'console.log("second ok");\n');
await writeFile(path.join(root, 'lib/broken.mjs'), 'export const repaired = 1;\n');
await writeFile(path.join(root, 'scripts/test-hangs.mjs'), 'setInterval(() => {}, 1000);\n');
const timedOut = await runChecks({ root, timeoutMs: 750, concurrency: 2 });
assert.deepEqual(timedOut.tests.failures.map((failure) => failure.name), ['scripts/test-hangs.mjs']);
assert.match(timedOut.tests.failures[0].output, /zaman aşımı/);
assert.equal(timedOut.exitCode, 1);

console.log('run-checks tests passed');
