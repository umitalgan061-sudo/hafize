import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { assertModuleDelivered } from './shell-cache-contract.mjs';
const source = await readFile('public/typed/legacy/connector-hub.ts', 'utf8');
const readme = await readFile('README.md', 'utf8');

assert.match(source, /hafize:workspace-changed/);
assert.match(source, /refreshStatus\(\{ force: true \}\)/);
assert.match(source, /refreshStatus\(\)/);
assert.match(source, /getSnapshot/);
assert.match(source, /new EventImpl/);
assert.match(source, /clipboard/);
assert.match(readme, /## Bağlantılar çalışma alanı/);
assertModuleDelivered('connector-hub');
assert.match(readme, /aynı-origin GET/);

console.log('connector hub integration regression: passed');
