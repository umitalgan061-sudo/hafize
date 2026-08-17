import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const apiPath = fileURLToPath(new URL('../lib/personal-memory-http-api.mjs', import.meta.url));
const policyPath = fileURLToPath(new URL('../lib/personal-memory-http-policy.mjs', import.meta.url));
const controlPath = fileURLToPath(new URL('../lib/personal-memory-control-runtime.mjs', import.meta.url));
const [api, policy, control] = await Promise.all([
  readFile(apiPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(controlPath, 'utf8')
]);

assert.match(api, /mutationGuard\(headers, ownership\)/);
assert.match(api, /runtime\.authorizeMutation\(\{ headers, ownership \}\)/);
assert.match(api, /ORIGIN_REQUIRED/);
assert.match(api, /method === 'POST' && pathname === '\/api\/memory'/);
assert.match(api, /method === 'DELETE' && memoryId/);
assert.match(api, /explicitUserIntent:\s*true/);
assert.match(api, /exactMatch:\s*true/);

assert.match(policy, /explicitUserIntent/);
assert.match(policy, /sourceType/);
assert.match(policy, /sensitivity/);
assert.match(control, /authorizeMutation/);
assert.match(control, /ownerId/);

for (const source of [api, policy, control]) {
  assert.equal(/shell\s*=\s*true|shell\s*:\s*true/i.test(source), false);
  assert.equal(/child_process/.test(source), false);
}

console.log('memory consent server boundary tests passed');
