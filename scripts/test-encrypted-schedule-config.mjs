import assert from 'node:assert/strict';
import { ENCRYPTED_SCHEDULE_STORAGE_ENV, readEncryptedScheduleStorageConfig } from '../lib/encrypted-schedule-config.mjs';

const key = Buffer.alloc(32, 7);
const base64 = key.toString('base64');
const base64url = key.toString('base64url');
const filePath = process.platform === 'win32' ? 'C:\\hafize\\schedule.enc' : '/var/lib/hafize/schedule.enc';

assert.equal(readEncryptedScheduleStorageConfig({ env: {} }), null);
assert.throws(() => readEncryptedScheduleStorageConfig({ env: { [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: filePath } }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);
assert.throws(() => readEncryptedScheduleStorageConfig({ env: { [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: base64 } }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);

const config = readEncryptedScheduleStorageConfig({ env: {
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: `  ${filePath}  `,
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: `  ${base64}  `
} });
assert.equal(config.filePath, filePath);
assert.deepEqual(config.key, key);
const exposed = config.key;
exposed.fill(0);
assert.deepEqual(config.key, key);
assert.equal(Object.isFrozen(config), true);
assert.equal(Object.keys(config).includes('key'), false);
assert.equal(JSON.stringify(config).includes(base64), false);
assert.equal(JSON.stringify(config).includes(key.toString('hex')), false);

const urlConfig = readEncryptedScheduleStorageConfig({ env: {
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: filePath,
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: base64url
} });
assert.deepEqual(urlConfig.key, key);

for (const badKey of [
  Buffer.alloc(31).toString('base64'),
  Buffer.alloc(33).toString('base64'),
  `${base64} garbage`,
  '@@@@',
  `${base64.slice(0, -1)}!`
]) {
  assert.throws(() => readEncryptedScheduleStorageConfig({ env: {
    [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: filePath,
    [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: badKey
  } }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);
}

assert.throws(() => readEncryptedScheduleStorageConfig({ env: {
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: 'relative/schedule.enc',
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: base64
} }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);
assert.throws(() => readEncryptedScheduleStorageConfig({ env: {
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: `${filePath}\0oops`,
  [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: base64
} }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);
assert.throws(() => readEncryptedScheduleStorageConfig({ env: [] }), /INVALID_ENCRYPTED_SCHEDULE_CONFIG/);

let error;
try {
  readEncryptedScheduleStorageConfig({ env: {
    [ENCRYPTED_SCHEDULE_STORAGE_ENV.file]: filePath,
    [ENCRYPTED_SCHEDULE_STORAGE_ENV.keyBase64]: 'secret-but-invalid'
  } });
} catch (caught) {
  error = caught;
}
assert.equal(error?.message, 'INVALID_ENCRYPTED_SCHEDULE_CONFIG');
assert.equal(error.message.includes('secret-but-invalid'), false);

console.log('encrypted schedule config tests passed');
