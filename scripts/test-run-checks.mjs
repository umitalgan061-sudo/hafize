import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { discoverCheckTargets } from './run-checks.mjs';

const { syntax, runnable } = await discoverCheckTargets();

assert.equal(Object.isFrozen(syntax), true);
assert.equal(Object.isFrozen(runnable), true);

for (const file of ['server.mjs', 'lib/tool-runtime.mjs', 'lib/gmail-read-client.mjs', 'public/app.js', 'public/sw.js']) {
  assert.ok(syntax.includes(file), `syntax target missing: ${file}`);
}

assert.ok(runnable.includes('scripts/validate-agent-registry.mjs'));
assert.ok(runnable.includes('scripts/test-tool-runtime.mjs'));
assert.ok(runnable.every((file) => syntax.includes(file)), 'every runnable target must also be syntax checked');
assert.ok(!runnable.includes('scripts/run-checks.mjs'), 'the runner must not invoke itself as a target');

assert.equal(new Set(syntax).size, syntax.length, 'syntax targets must be unique');
assert.equal(new Set(runnable).size, runnable.length, 'runnable targets must be unique');
assert.deepEqual([...syntax].sort(), [...syntax].sort(), 'targets must be deterministic');

for (const file of syntax) {
  assert.ok(!path.isAbsolute(file), `target must stay repo relative: ${file}`);
  assert.ok(!file.includes('..'), `target must not escape the repo: ${file}`);
  assert.ok(['.mjs', '.js'].includes(path.extname(file)), `unexpected target extension: ${file}`);
}

// Discovery must cover every test on disk: a new test file joins the gate without editing package.json.
const scriptEntries = await readdir(new URL('.', import.meta.url), { withFileTypes: true });
const testFiles = scriptEntries
  .filter((entry) => entry.isFile() && entry.name.startsWith('test-') && entry.name.endsWith('.mjs'))
  .map((entry) => `scripts/${entry.name}`);

assert.ok(testFiles.length > 0);
for (const file of testFiles) {
  assert.ok(runnable.includes(file), `test not discovered by the gate: ${file}`);
}

console.log(`run-checks discovery tests passed (${syntax.length} syntax, ${runnable.length} runnable targets)`);
