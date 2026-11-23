import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const config = readFileSync(new URL('../render.yaml', import.meta.url), 'utf8');
test('Render service uses one explicitly Free Docker web service', () => {
  assert.match(config, /^services:\s*$/m);
  assert.equal((config.match(/^\s+- type: web\s*$/gm) || []).length, 1);
  assert.match(config, /^\s+runtime: docker\s*$/m);
  assert.match(config, /^\s+plan: free\s*$/m);
  assert.match(config, /^\s+healthCheckPath: \/api\/health\/live\s*$/m);
  assert.match(config, /^\s+autoDeployTrigger: off\s*$/m);
  assert.doesNotMatch(config, /^\s*(?:databases|disks|disk|paidPlan|cronJobs):/m);
});
test('authentication stays enabled and secret values are not stored in Git', () => {
  assert.match(config, /^\s+- key: HAFIZE_AUTH_REQUIRED\n\s+value: "true"\s*$/m);
  assert.match(config, /^\s+- key: HAFIZE_COOKIE_SECURE\n\s+value: "true"\s*$/m);
  assert.match(config, /^\s+- key: HAFIZE_AUTH_TOKEN\n\s+generateValue: true\s*$/m);
  assert.match(config, /^\s+- key: HAFIZE_MASTER_KEY\n\s+generateValue: true\s*$/m);
  assert.match(config, /^\s+- key: NVIDIA_API_KEY\n\s+sync: false\s*$/m);
  assert.doesNotMatch(config, /nvapi-[A-Za-z0-9]{10,}/);
});
