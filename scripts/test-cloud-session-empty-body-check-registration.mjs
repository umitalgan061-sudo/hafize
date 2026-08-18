import assert from 'node:assert/strict';
import { discoverCheckPlan } from './check-suite-policy.mjs';

const plan = await discoverCheckPlan();
const required = [
  'scripts/test-cloud-session-empty-body-policy.mjs',
  'scripts/test-cloud-session-status-empty-body.mjs',
  'scripts/test-cloud-session-logout-empty-body.mjs',
  'scripts/test-cloud-session-empty-body-ordering.mjs',
  'scripts/test-cloud-session-empty-body-error-policy.mjs',
  'scripts/test-cloud-session-empty-body-session-preservation.mjs',
  'scripts/test-cloud-session-empty-body-node-runtime-wiring.mjs'
];
for (const file of required) {
  assert.equal(plan.tests.includes(file), true, `canonical check plan must include ${file}`);
  assert.equal(plan.syntaxFiles.includes(file), true, `syntax plan must include ${file}`);
}
assert.equal(plan.syntaxFiles.includes('lib/cloud-session-empty-body-policy.mjs'), true);
assert.equal(plan.syntaxFiles.includes('lib/cloud-session-http-api.mjs'), true);

console.log('cloud session empty-body canonical check registration: ok');
