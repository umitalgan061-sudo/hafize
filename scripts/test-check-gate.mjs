import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCheckScripts, discoverSyntaxTargets } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function names(dir, extension) {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(extension)).map((entry) => `${dir}/${entry.name}`);
}

const syntaxTargets = await discoverSyntaxTargets();
const checkScripts = await discoverCheckScripts();

// Her test dosyası kapıya girer: hiçbir test sessizce kapsam dışında kalamaz.
const testFiles = (await names('scripts', '.mjs')).filter((file) => path.basename(file).startsWith('test-'));
const missingTests = testFiles.filter((file) => !checkScripts.includes(file));
assert.deepEqual(missingTests, [], `kapı dışında kalan testler: ${missingTests.join(', ')}`);
assert.ok(checkScripts.includes('scripts/validate-agent-registry.mjs'));
assert.ok(checkScripts.includes('scripts/test-check-gate.mjs'));

// Çalıştırılabilir tüm kaynaklar syntax kontrolünden geçer.
for (const source of [...(await names('lib', '.mjs')), ...(await names('public', '.js')), 'server.mjs']) {
  assert.ok(syntaxTargets.includes(source), `syntax kontrolü dışında kalan dosya: ${source}`);
}
for (const file of testFiles) {
  assert.ok(syntaxTargets.includes(file), `syntax kontrolü dışında kalan test: ${file}`);
}

// Keşif deterministik ve tekrarsızdır.
assert.equal(new Set(checkScripts).size, checkScripts.length);
assert.equal(new Set(syntaxTargets).size, syntaxTargets.length);
assert.deepEqual(await discoverCheckScripts(), checkScripts);
assert.deepEqual(await discoverSyntaxTargets(), syntaxTargets);

// Modül import edildiğinde kapıyı kendi kendine çalıştırmaz (özyineleme koruması).
assert.ok(syntaxTargets.length > 20);
assert.ok(checkScripts.length > 50);

console.log(`check gate tests passed (${syntaxTargets.length} syntax, ${checkScripts.length} script)`);
