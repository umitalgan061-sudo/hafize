import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCloudRunSecrets } from './hafize-cloud-run-preflight.mjs';

const good = {
  HAFIZE_CLOUD_RUN_AUTH_TOKEN: 'a'.repeat(64),
  HAFIZE_CLOUD_RUN_MASTER_KEY: '1'.repeat(64),
  HAFIZE_CLOUD_RUN_NVIDIA_API_KEY: 'nvapi-test-key'
};
test('validates strong authentication and encryption credentials', () => {
  assert.equal(validateCloudRunSecrets(good), true);
  assert.equal(validateCloudRunSecrets({ ...good, HAFIZE_CLOUD_RUN_MASTER_KEY: Buffer.alloc(32, 9).toString('base64') }), true);
});

test('never permits missing, weak, or malformed cloud credentials', () => {
  for (const patch of [
    { HAFIZE_CLOUD_RUN_AUTH_TOKEN: '' },
    { HAFIZE_CLOUD_RUN_AUTH_TOKEN: 'short' },
    { HAFIZE_CLOUD_RUN_AUTH_TOKEN: 'x'.repeat(33) + ' ' },
    { HAFIZE_CLOUD_RUN_MASTER_KEY: '' },
    { HAFIZE_CLOUD_RUN_MASTER_KEY: 'too-short' },
    { HAFIZE_CLOUD_RUN_NVIDIA_API_KEY: '' },
    { HAFIZE_CLOUD_RUN_NVIDIA_API_KEY: 'invalid value' }
  ]) assert.throws(() => validateCloudRunSecrets({ ...good, ...patch }), /_MISSING_OR_INVALID/);
});
