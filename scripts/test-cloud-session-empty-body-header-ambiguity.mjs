import assert from 'node:assert/strict';
import { requireEmptyCloudSessionBody } from '../lib/cloud-session-empty-body-policy.mjs';

const ambiguous = [
  { 'Content-Length': '0', 'content-length': '0' },
  { 'Content-Length': '0', 'CONTENT-LENGTH': '0' },
  { 'Transfer-Encoding': '', 'transfer-encoding': '' },
  { 'Content-Encoding': 'identity', 'content-encoding': 'identity' },
  { 'content-length': ['0'] },
  { 'content-length': ['0', '0'] },
  { 'transfer-encoding': [''] },
  { 'content-encoding': ['identity'] }
];

for (const headers of ambiguous) {
  assert.throws(
    () => requireEmptyCloudSessionBody(headers),
    (error) => error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED',
    `ambiguous framing must fail closed: ${JSON.stringify(headers)}`
  );
}

for (const headers of [
  { 'Content-Length': '0' },
  { 'Transfer-Encoding': '' },
  { 'Content-Encoding': '' },
  { 'Content-Encoding': ' identity ' }
]) {
  assert.equal(requireEmptyCloudSessionBody(headers), true);
}

console.log('cloud session duplicate framing header policy: ok');
