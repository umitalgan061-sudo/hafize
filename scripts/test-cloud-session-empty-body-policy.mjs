import assert from 'node:assert/strict';
import { hasCloudSessionBodyFraming, requireEmptyCloudSessionBody } from '../lib/cloud-session-empty-body-policy.mjs';

const valid = [
  {},
  { 'content-length': '0' },
  { 'Content-Length': '0' },
  { 'content-encoding': 'identity' },
  { 'content-length': '0', 'content-encoding': 'IDENTITY' }
];
for (const headers of valid) {
  assert.equal(requireEmptyCloudSessionBody(headers), true);
  assert.equal(hasCloudSessionBodyFraming(headers), false);
}

const invalid = [
  { 'content-length': '1' },
  { 'content-length': '00' },
  { 'content-length': ' 0' },
  { 'content-length': ['0', '0'] },
  { 'transfer-encoding': 'chunked' },
  { 'transfer-encoding': 'identity' },
  { 'content-encoding': 'gzip' },
  { 'content-length': '0', 'transfer-encoding': 'chunked' }
];
for (const headers of invalid) {
  assert.throws(() => requireEmptyCloudSessionBody(headers), (error) => error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED');
  assert.equal(hasCloudSessionBodyFraming(headers), true);
}

console.log('cloud session empty-body framing policy: ok');
