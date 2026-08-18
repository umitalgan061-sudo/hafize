import assert from 'node:assert/strict';
import { decodeCloudSessionPayload } from '../lib/cloud-session-token-contract.mjs';

const SUBJECT = 'owner:hafize';
const NOW = 1_800_000_000_000;
const EXP = NOW + 60_000;
const NONCE = 'abcdefghijklmnopqrstuvwx';

function encoded(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

const canonical = JSON.stringify({ v: 1, sub: SUBJECT, iat: NOW, exp: EXP, n: NONCE });
assert.ok(decodeCloudSessionPayload(encoded(canonical), { subject: SUBJECT }));

const duplicateVersion = `{"v":1,"v":1,"sub":"${SUBJECT}","iat":${NOW},"exp":${EXP},"n":"${NONCE}"}`;
assert.equal(decodeCloudSessionPayload(encoded(duplicateVersion), { subject: SUBJECT }), null);

const duplicateSubject = `{"v":1,"sub":"ignored","sub":"${SUBJECT}","iat":${NOW},"exp":${EXP},"n":"${NONCE}"}`;
assert.equal(decodeCloudSessionPayload(encoded(duplicateSubject), { subject: SUBJECT }), null);

const escapedSubject = String.raw`{"v":1,"sub":"owner\u003ahafize","iat":${NOW},"exp":${EXP},"n":"${NONCE}"}`;
assert.equal(decodeCloudSessionPayload(encoded(escapedSubject), { subject: SUBJECT }), null);

const numericExponent = `{"v":1,"sub":"${SUBJECT}","iat":1.8e12,"exp":${EXP},"n":"${NONCE}"}`;
assert.equal(decodeCloudSessionPayload(encoded(numericExponent), { subject: SUBJECT }), null);

const leadingWhitespace = ` ${canonical}`;
const trailingWhitespace = `${canonical}\n`;
assert.equal(decodeCloudSessionPayload(encoded(leadingWhitespace), { subject: SUBJECT }), null);
assert.equal(decodeCloudSessionPayload(encoded(trailingWhitespace), { subject: SUBJECT }), null);

const invalidUtf8 = Buffer.concat([
  Buffer.from('{"v":1,"sub":"', 'utf8'),
  Buffer.from([0xc3, 0x28]),
  Buffer.from(`","iat":${NOW},"exp":${EXP},"n":"${NONCE}"}`, 'utf8')
]).toString('base64url');
assert.equal(decodeCloudSessionPayload(invalidUtf8, { subject: SUBJECT }), null);

const nulByte = Buffer.from(`${canonical}\u0000`, 'utf8').toString('base64url');
assert.equal(decodeCloudSessionPayload(nulByte, { subject: SUBJECT }), null);

const arrayPayload = encoded(JSON.stringify([1, SUBJECT, NOW, EXP, NONCE]));
assert.equal(decodeCloudSessionPayload(arrayPayload, { subject: SUBJECT }), null);

console.log('cloud session adversarial encoding tests passed');
