import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = packageJson?.scripts;

assert.ok(scripts && typeof scripts === 'object', 'package scripts must exist');
assert.equal(scripts.check, 'node scripts/run-checks.mjs');
assert.equal(scripts['check:list'], 'node scripts/run-checks.mjs --list');
assert.equal(Object.hasOwn(scripts, 'precheck'), false, 'precheck would duplicate the runner syntax stage');

for (const [name, command] of Object.entries(scripts)) {
  if (name === 'check' || name === 'check:list') continue;
  assert.equal(
    /scripts\/test-[^ ]+\.mjs/.test(command),
    false,
    `${name} must not become a second manually enumerated test suite`
  );
}

console.log('check package wiring tests passed');
