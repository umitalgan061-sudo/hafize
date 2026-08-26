import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverSourceFiles, discoverTestFiles } from './run-checks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sources = await discoverSourceFiles();
const tests = await discoverTestFiles();

// Discovery is the whole point of the gate: a module or test added in a later
// round must be picked up without anyone remembering to edit package.json.
assert.ok(sources.includes('server.mjs'));
for (const [dir, extension] of [['lib', '.mjs'], ['public', '.js']]) {
  const onDisk = (await readdir(path.join(ROOT, dir), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && path.extname(entry.name) === extension)
    .map((entry) => `${dir}/${entry.name}`)
    .sort();
  assert.deepEqual(sources.filter((file) => file.startsWith(`${dir}/`)), onDisk);
  assert.ok(onDisk.length > 0);
}

const testsOnDisk = (await readdir(path.join(ROOT, 'scripts')))
  .filter((name) => name.startsWith('test-') && name.endsWith('.mjs'))
  .map((name) => `scripts/${name}`)
  .sort();
assert.deepEqual(tests, testsOnDisk);
assert.ok(tests.includes('scripts/test-check-gate.mjs'));

// Every test script is also syntax-checked, and the runner itself is never
// mistaken for a test (that would recurse).
for (const file of tests) assert.ok(sources.includes(file), `${file} missing from syntax pass`);
assert.equal(tests.includes('scripts/run-checks.mjs'), false);
assert.ok(sources.includes('scripts/run-checks.mjs'));

// The gate must stay a single entry point; a hand-maintained parallel list is
// exactly the drift that let a red test hide behind a green-looking command.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-checks.mjs');
assert.equal(Object.hasOwn(pkg.scripts, 'precheck'), false);

console.log(`Check gate discovery OK: ${sources.length} modules, ${tests.length} test scripts, single entry point`);
