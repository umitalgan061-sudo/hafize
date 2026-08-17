import assert from 'node:assert/strict';
import { discoverCheckPlan } from './check-suite-policy.mjs';

const plan = await discoverCheckPlan();
const expected = [
  'scripts/test-hands-free-consent-review.mjs',
  'scripts/test-hands-free-consent-integration.mjs',
  'scripts/test-hands-free-consent-security.mjs',
  'scripts/test-hands-free-consent-secure-context.mjs',
  'scripts/test-hands-free-consent-pwa.mjs'
];
for (const file of expected) assert.ok(plan.tests.includes(file), `${file} must run in npm run check`);
assert.ok(plan.syntaxFiles.includes('public/hands-free-consent.js'));
console.log('hands-free consent check-suite tests passed');
