import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { ENCRYPTED_SCHEDULE_STORAGE_ENV, ENCRYPTED_SCHEDULE_STORAGE_LIMITS, readEncryptedScheduleStorageConfig } from '../lib/encrypted-schedule-config.mjs';

const key = randomBytes(32).toString('base64url');
const env = {
  HAFIZE_SCHEDULE_STORAGE_FILE: '/var/lib/hafize/schedules.enc',
  HAFIZE_SCHEDULE_STORAGE_KEY_BASE64: key
};
const config = readEncryptedScheduleStorageConfig({ env });
assert.equal(config.filePath, env.HAFIZE_SCHEDULE_STORAGE_FILE);
assert.equal(config.maxFileBytes, ENCRYPTED_SCHEDULE_STORAGE_LIMITS.defaultMaxFileBytes);
assert.equal(config.key.length, 32);
assert.equal(ENCRYPTED_SCHEDULE_STORAGE_ENV.maxFileBytes, 'HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES');
assert.ok(ENCRYPTED_SCHEDULE_STORAGE_LIMITS.maxFileBytes > ENCRYPTED_SCHEDULE_STORAGE_LIMITS.defaultMaxFileBytes);

const custom = readEncryptedScheduleStorageConfig({ env: { ...env, HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES: String(128 * 1024 * 1024) } });
assert.equal(custom.maxFileBytes, 128 * 1024 * 1024);

for (const value of ['1', '4194303', String(256 * 1024 * 1024 + 1), 'not-a-number']) {
  assert.throws(() => readEncryptedScheduleStorageConfig({ env: { ...env, HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES: value } }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);
}
assert.equal(readEncryptedScheduleStorageConfig({ env: {} }), null);
assert.throws(() => readEncryptedScheduleStorageConfig({ env: { HAFIZE_SCHEDULE_STORAGE_FILE: env.HAFIZE_SCHEDULE_STORAGE_FILE } }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);

config.key.fill(0);
custom.key.fill(0);
console.log('encrypted schedule config scale tests passed');
