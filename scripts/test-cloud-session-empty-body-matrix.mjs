import assert from 'node:assert/strict';
import { requireEmptyCloudSessionBody } from '../lib/cloud-session-empty-body-policy.mjs';

const acceptedLengths = [undefined, '0'];
const acceptedEncodings = [undefined, '', 'identity', 'IDENTITY', ' identity '];
const acceptedEmptySignals = [undefined, ''];
let acceptedCases = 0;

for (const length of acceptedLengths) {
  for (const encoding of acceptedEncodings) {
    for (const transfer of acceptedEmptySignals) {
      for (const expect of acceptedEmptySignals) {
        for (const trailer of acceptedEmptySignals) {
          const headers = {};
          if (length !== undefined) headers['content-length'] = length;
          if (encoding !== undefined) headers['content-encoding'] = encoding;
          if (transfer !== undefined) headers['transfer-encoding'] = transfer;
          if (expect !== undefined) headers.expect = expect;
          if (trailer !== undefined) headers.trailer = trailer;
          assert.equal(requireEmptyCloudSessionBody(headers), true);
          acceptedCases += 1;
        }
      }
    }
  }
}
assert.equal(acceptedCases, 80);

const invalidByHeader = {
  'content-length': ['1', '-1', '+0', '00', '0 ', ' 0', '0,0', '1.0', '999999'],
  'content-encoding': ['gzip', 'br', 'deflate', 'identity,gzip'],
  'transfer-encoding': ['chunked', 'identity', 'gzip', 'chunked,gzip'],
  expect: ['100-continue', 'something-else'],
  trailer: ['Digest', 'X-Checksum']
};
let rejectedCases = 0;
for (const [name, values] of Object.entries(invalidByHeader)) {
  for (const value of values) {
    assert.throws(
      () => requireEmptyCloudSessionBody({ [name]: value }),
      (error) => error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED',
      `${name}: ${value}`
    );
    rejectedCases += 1;
  }
}
assert.equal(rejectedCases, 21);

for (const name of ['content-length', 'content-encoding', 'transfer-encoding', 'expect', 'trailer']) {
  assert.throws(() => requireEmptyCloudSessionBody({ [name]: ['0'] }), (error) => error?.code === 'CLOUD_SESSION_BODY_NOT_ALLOWED');
}

console.log(`cloud session empty-body matrix: ok (${acceptedCases} accepted, ${rejectedCases + 5} rejected)`);
