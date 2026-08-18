const COOKIE_NAME = '__Host-hafize_session';
const TOKEN_VERSION = 1;
const MAX_COOKIE_HEADER_BYTES = 4096;
const MAX_TOKEN_BYTES = 2048;
const MAX_ENCODED_PAYLOAD_BYTES = 1024;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ENCODED_PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{24}$/;
const PAYLOAD_KEYS = Object.freeze(['v', 'sub', 'iat', 'exp', 'n']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8');
}

function rawCookieHeader(headers) {
  if (!headers || typeof headers !== 'object') return '';
  const raw = headers.cookie ?? headers.Cookie;
  if (typeof raw !== 'string' || byteLength(raw) > MAX_COOKIE_HEADER_BYTES) return '';
  return raw;
}

export function readCloudSessionCookieToken(headers) {
  const raw = rawCookieHeader(headers);
  if (!raw) return null;
  const prefix = `${COOKIE_NAME}=`;
  const matches = raw
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  if (matches.length !== 1) return null;
  const token = matches[0].slice(prefix.length);
  if (!token || byteLength(token) > MAX_TOKEN_BYTES || /[\s;,]/.test(token)) return null;
  return token;
}

export function splitCloudSessionToken(token) {
  if (typeof token !== 'string' || !token || byteLength(token) > MAX_TOKEN_BYTES || /[\s;,]/.test(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || byteLength(encodedPayload) > MAX_ENCODED_PAYLOAD_BYTES) return null;
  if (!ENCODED_PAYLOAD_PATTERN.test(encodedPayload) || !SIGNATURE_PATTERN.test(signature)) return null;
  return Object.freeze({ encodedPayload, signature });
}

function exactPayloadShape(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return false;
  const keys = Object.keys(payload);
  return keys.length === PAYLOAD_KEYS.length && PAYLOAD_KEYS.every((key, index) => keys[index] === key);
}

function canonicalEncodedPayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCloudSessionPayload(encodedPayload, { subject } = {}) {
  if (typeof encodedPayload !== 'string' || !encodedPayload || byteLength(encodedPayload) > MAX_ENCODED_PAYLOAD_BYTES || !ENCODED_PAYLOAD_PATTERN.test(encodedPayload)) return null;
  if (typeof subject !== 'string' || !subject || subject.length > 200 || /[\u0000\r\n]/.test(subject)) return null;

  let decoded;
  try {
    const bytes = Buffer.from(encodedPayload, 'base64url');
    if (!bytes.length || bytes.toString('base64url') !== encodedPayload) return null;
    decoded = bytes.toString('utf8');
  } catch {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!exactPayloadShape(payload)) return null;
  if (payload.v !== TOKEN_VERSION || payload.sub !== subject) return null;
  if (!Number.isSafeInteger(payload.iat) || payload.iat < 0) return null;
  if (!Number.isSafeInteger(payload.exp) || payload.exp < 0) return null;
  if (typeof payload.n !== 'string' || !NONCE_PATTERN.test(payload.n)) return null;
  if (canonicalEncodedPayload(payload) !== encodedPayload) return null;
  return Object.freeze({ ...payload });
}

export function encodeCloudSessionPayload({ subject, issuedAt, expiresAt, nonce } = {}) {
  if (typeof subject !== 'string' || !subject || subject.length > 200 || /[\u0000\r\n]/.test(subject)) fail('INVALID_CLOUD_SESSION_TOKEN:subject');
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) fail('INVALID_CLOUD_SESSION_TOKEN:issuedAt');
  if (!Number.isSafeInteger(expiresAt) || expiresAt < 0) fail('INVALID_CLOUD_SESSION_TOKEN:expiresAt');
  if (typeof nonce !== 'string' || !NONCE_PATTERN.test(nonce)) fail('INVALID_CLOUD_SESSION_TOKEN:nonce');
  const encoded = canonicalEncodedPayload({ v: TOKEN_VERSION, sub: subject, iat: issuedAt, exp: expiresAt, n: nonce });
  if (byteLength(encoded) > MAX_ENCODED_PAYLOAD_BYTES) fail('INVALID_CLOUD_SESSION_TOKEN:payloadSize');
  return encoded;
}

export const CLOUD_SESSION_TOKEN_CONTRACT = Object.freeze({
  cookieName: COOKIE_NAME,
  version: TOKEN_VERSION,
  maxCookieHeaderBytes: MAX_COOKIE_HEADER_BYTES,
  maxTokenBytes: MAX_TOKEN_BYTES,
  maxEncodedPayloadBytes: MAX_ENCODED_PAYLOAD_BYTES,
  nonceLength: 24,
  signatureLength: 43,
  payloadKeys: PAYLOAD_KEYS
});
