import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const VERSION = 1;
const DOMAIN = 'hafize-personal-memory-write-approval-v1';
const KEY_DOMAIN = 'hafize:personal-memory:write-approval:v1';
const DEFAULT_TTL_MS = 2 * 60 * 1000;
const MAX_TTL_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 30 * 1000;
const MAX_USED_NONCES = 10_000;
const MAX_RECEIPT_LENGTH = 2048;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function decodeMemoryKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value)) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
  return key;
}

function writePayloadDigest(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('MEMORY_WRITE_APPROVAL_INVALID');
  const values = [payload.ownerId, payload.kind, payload.content, payload.sourceType, payload.sourceRef ?? null, payload.sensitivity];
  if (values.slice(0, 4).some((value) => typeof value !== 'string') || typeof values[5] !== 'string') {
    fail('MEMORY_WRITE_APPROVAL_INVALID');
  }
  if (values[4] !== null && typeof values[4] !== 'string') fail('MEMORY_WRITE_APPROVAL_INVALID');
  return createHash('sha256').update(JSON.stringify(values), 'utf8').digest('hex');
}

function parseReceipt(receipt) {
  if (typeof receipt !== 'string' || !receipt || receipt.length > MAX_RECEIPT_LENGTH) fail('MEMORY_WRITE_APPROVAL_INVALID');
  const parts = receipt.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) fail('MEMORY_WRITE_APPROVAL_INVALID');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    fail('MEMORY_WRITE_APPROVAL_INVALID');
  }
  if (!claims || Array.isArray(claims) || typeof claims !== 'object') fail('MEMORY_WRITE_APPROVAL_INVALID');
  const fields = Object.keys(claims).sort();
  if (fields.join(',') !== 'expiresAt,issuedAt,nonce,payloadDigest,v') fail('MEMORY_WRITE_APPROVAL_INVALID');
  if (claims.v !== VERSION || !NONCE_PATTERN.test(claims.nonce || '') || !DIGEST_PATTERN.test(claims.payloadDigest || '')) {
    fail('MEMORY_WRITE_APPROVAL_INVALID');
  }
  if (!Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= claims.issuedAt) {
    fail('MEMORY_WRITE_APPROVAL_INVALID');
  }
  let signature;
  try {
    signature = Buffer.from(parts[1], 'base64url');
  } catch {
    fail('MEMORY_WRITE_APPROVAL_INVALID');
  }
  if (signature.length !== 32) fail('MEMORY_WRITE_APPROVAL_INVALID');
  return { claims, encodedClaims: parts[0], signature };
}

export function createPersonalMemoryWriteApprovalService({
  memoryKeyBase64,
  now = Date.now,
  ttlMs = DEFAULT_TTL_MS,
  randomBytesImpl = randomBytes,
  maxUsedNonces = MAX_USED_NONCES
} = {}) {
  if (typeof now !== 'function' || typeof randomBytesImpl !== 'function') fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > MAX_TTL_MS) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
  if (!Number.isSafeInteger(maxUsedNonces) || maxUsedNonces < 1 || maxUsedNonces > MAX_USED_NONCES) {
    fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
  }
  const signingKey = createHmac('sha256', decodeMemoryKey(memoryKeyBase64)).update(KEY_DOMAIN).digest();
  const usedNonces = new Map();

  function sign(encodedClaims) {
    return createHmac('sha256', signingKey).update(DOMAIN).update('\n').update(encodedClaims).digest();
  }

  function prune(currentTime) {
    for (const [nonce, expiresAt] of usedNonces) if (expiresAt <= currentTime) usedNonces.delete(nonce);
  }

  function issue(payload) {
    const issuedAt = now();
    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
    const nonceBytes = randomBytesImpl(18);
    if (!Buffer.isBuffer(nonceBytes) && !(nonceBytes instanceof Uint8Array)) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
    const nonce = Buffer.from(nonceBytes).toString('base64url');
    if (!NONCE_PATTERN.test(nonce)) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
    const expiresAt = issuedAt + ttlMs;
    const claims = { v: VERSION, nonce, issuedAt, expiresAt, payloadDigest: writePayloadDigest(payload) };
    const encodedClaims = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
    const approvalReceipt = `${encodedClaims}.${sign(encodedClaims).toString('base64url')}`;
    return Object.freeze({ approvalReceipt, expiresAt });
  }

  function consume({ approvalReceipt, payload } = {}) {
    const currentTime = now();
    if (!Number.isSafeInteger(currentTime) || currentTime < 0) fail('MEMORY_WRITE_APPROVAL_CONFIG_INVALID');
    const { claims, encodedClaims, signature } = parseReceipt(approvalReceipt);
    const expectedSignature = sign(encodedClaims);
    if (!timingSafeEqual(signature, expectedSignature)) fail('MEMORY_WRITE_APPROVAL_INVALID');
    if (claims.issuedAt > currentTime + MAX_FUTURE_SKEW_MS || claims.expiresAt > claims.issuedAt + MAX_TTL_MS) {
      fail('MEMORY_WRITE_APPROVAL_INVALID');
    }
    if (claims.expiresAt <= currentTime) fail('MEMORY_WRITE_APPROVAL_EXPIRED');
    const expectedDigest = writePayloadDigest(payload);
    const receivedDigest = Buffer.from(claims.payloadDigest, 'hex');
    const actualDigest = Buffer.from(expectedDigest, 'hex');
    if (!timingSafeEqual(receivedDigest, actualDigest)) fail('MEMORY_WRITE_APPROVAL_INVALID');

    prune(currentTime);
    if (usedNonces.has(claims.nonce)) fail('MEMORY_WRITE_APPROVAL_REPLAYED');
    if (usedNonces.size >= maxUsedNonces) fail('MEMORY_WRITE_APPROVAL_CAPACITY');
    usedNonces.set(claims.nonce, claims.expiresAt);
    return Object.freeze({ ok: true, expiresAt: claims.expiresAt });
  }

  return Object.freeze({ issue, consume });
}

export const PERSONAL_MEMORY_WRITE_APPROVAL_POLICY = Object.freeze({
  version: VERSION,
  defaultTtlMs: DEFAULT_TTL_MS,
  maxTtlMs: MAX_TTL_MS,
  maxReceiptLength: MAX_RECEIPT_LENGTH,
  replayScope: 'process-local'
});
