import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverCheckTargets } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

// Kapı elle tutulan bir komut zincirine geri dönmemeli; aksi hâlde yeni testler
// sessizce kapsam dışında kalır.
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');

const { syntax, executed } = await discoverCheckTargets();
const scriptEntries = await readdir(path.join(ROOT, 'scripts'));

// Her test betiği kapı tarafından çalıştırılmalı.
const testFiles = scriptEntries
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
  .map((name) => path.posix.join('scripts', name))
  .sort();
assert.deepEqual(executed.filter((file) => path.basename(file).startsWith('test-')), testFiles);
assert.ok(executed.includes('scripts/validate-agent-registry.mjs'));

// Kapı kendini çalıştırmamalı (sonsuz özyineleme olurdu).
assert.equal(executed.includes('scripts/run-checks.mjs'), false);

// Sunucu ve tüm lib/ kaynakları en azından sözdizimi denetiminden geçmeli.
const libFiles = (await readdir(path.join(ROOT, 'lib')))
  .filter((name) => name.endsWith('.mjs'))
  .map((name) => path.posix.join('lib', name));
assert.ok(syntax.includes('server.mjs'));
for (const file of libFiles) assert.ok(syntax.includes(file), `sözdizimi denetimi eksik: ${file}`);
for (const file of testFiles) assert.ok(syntax.includes(file), `sözdizimi denetimi eksik: ${file}`);

// Keşif içe aktarıldığında kapıyı çalıştırmamalı (yan etkisiz olmalı).
assert.equal(process.exitCode, undefined);

console.log(`check gate tests passed (${syntax.length} sözdizimi, ${executed.length} betik)`);
