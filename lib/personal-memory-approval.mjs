import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseMemoryId, validateMemoryMutationBody } from './personal-memory-http-policy.mjs';

const TOKEN_PREFIX = 'mw1';
const DEFAULT_TTL_MS = 120_000;
const MAX_TTL_MS = 300_000;
const NONCE_BYTES = 16;
const OWNER_PATTERN = /^owner_[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^mw1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;
const PAYLOAD_FIELDS = new Set(['v', 'n', 'e', 'o', 'd']);
const KINDS = new Set(['write', 'delete-one', 'delete-all', 'export']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function createLocalReplayStore() {
  const used = new Map();
  return Object.freeze({
    claim({ nonce, expiresAt, now }) {
      for (const [key, expiry] of used) if (expiry <= now) used.delete(key);
      if (used.has(nonce)) return false;
      used.set(nonce, expiresAt);
      return true;
    }
  });
}

function normalizeSecret(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('INVALID_MEMORY_APPROVAL_SECRET');
  const secret = Buffer.from(value);
  if (secret.length < 32) fail('INVALID_MEMORY_APPROVAL_SECRET');
  return secret;
}

function normalizeOwner(ownerId) {
  const value = typeof ownerId === 'string' ? ownerId.trim() : '';
  if (!OWNER_PATTERN.test(value)) fail('INVALID_MEMORY_APPROVAL_OWNER');
  return value;
}

export function normalizeMemoryApprovalCommand(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('INVALID_MEMORY_APPROVAL_COMMAND');
  const allowed = new Set(['kind', 'memoryId', 'body']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) fail('INVALID_MEMORY_APPROVAL_COMMAND');
  if (!KINDS.has(input.kind)) fail('INVALID_MEMORY_APPROVAL_COMMAND');
  const validation = validateMemoryMutationBody(input.kind, input.body);
  if (!validation.ok) fail(validation.error);
  if (input.kind === 'delete-one') {
    const memoryId = parseMemoryId(`/api/memory/${input.memoryId || ''}`);
    if (!memoryId) fail('INVALID_MEMORY_APPROVAL_MEMORY_ID');
    return Object.freeze({ kind: input.kind, memoryId, body: Object.freeze({ ...input.body }) });
  }
  if (input.memoryId !== undefined) fail('INVALID_MEMORY_APPROVAL_COMMAND');
  return Object.freeze({ kind: input.kind, body: Object.freeze({ ...input.body }) });
}

function contentDigest(value) {
  return createHash('sha256')
    .update('hafize:personal-memory-command:v1\0')
    .update(JSON.stringify(value))
    .digest('base64url');
}

function commandDigest(command) {
  const canonical = command.kind === 'delete-one'
    ? [command.kind, command.memoryId, command.body]
    : [command.kind, command.body];
  return contentDigest(canonical);
}

function sign(secret, body) {
  return createHmac('sha256', secret)
    .update('hafize:personal-memory-approval:v1\0')
    .update(body)
    .digest();
}

function parseToken(token, secret) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (normalized.length > 2_048) fail('MEMORY_APPROVAL_INVALID');
  const match = TOKEN_PATTERN.exec(normalized);
  if (!match) fail('MEMORY_APPROVAL_INVALID');
  const [, body, encodedMac] = match;
  let actualMac;
  try { actualMac = Buffer.from(encodedMac, 'base64url'); } catch { fail('MEMORY_APPROVAL_INVALID'); }
  const expectedMac = sign(secret, body);
  if (actualMac.length !== expectedMac.length || !timingSafeEqual(actualMac, expectedMac)) fail('MEMORY_APPROVAL_INVALID');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { fail('MEMORY_APPROVAL_INVALID'); }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('MEMORY_APPROVAL_INVALID');
  for (const key of Object.keys(payload)) if (!PAYLOAD_FIELDS.has(key)) fail('MEMORY_APPROVAL_INVALID');
  if (payload.v !== 1 || typeof payload.n !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(payload.n)) fail('MEMORY_APPROVAL_INVALID');
  if (!Number.isSafeInteger(payload.e) || !OWNER_PATTERN.test(payload.o || '') || !/^[A-Za-z0-9_-]{43}$/.test(payload.d || '')) {
    fail('MEMORY_APPROVAL_INVALID');
  }
  return payload;
}

export function createPersonalMemoryApprovalBoundary({
  secret,
  replayStore = createLocalReplayStore(),
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  randomBytesImpl = randomBytes
} = {}) {
  const approvalSecret = normalizeSecret(secret);
  if (typeof replayStore?.claim !== 'function') fail('INVALID_MEMORY_APPROVAL_REPLAY_STORE');
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) fail('INVALID_MEMORY_APPROVAL_TTL');
  if (typeof now !== 'function' || typeof randomBytesImpl !== 'function') fail('INVALID_MEMORY_APPROVAL_RUNTIME');

  function currentTime() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_MEMORY_APPROVAL_CLOCK');
    return value;
  }

  function prepare(input, { ownerId } = {}) {
    const command = normalizeMemoryApprovalCommand(input);
    const owner = normalizeOwner(ownerId);
    const issuedAt = currentTime();
    const nonceBytes = Buffer.from(randomBytesImpl(NONCE_BYTES));
    if (nonceBytes.length !== NONCE_BYTES) fail('INVALID_MEMORY_APPROVAL_NONCE');
    const payload = { v: 1, n: nonceBytes.toString('base64url'), e: issuedAt + ttlMs, o: owner, d: commandDigest(command) };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return Object.freeze({
      approvalToken: `${TOKEN_PREFIX}.${body}.${sign(approvalSecret, body).toString('base64url')}`,
      expiresAt: new Date(payload.e).toISOString(),
      command
    });
  }

  function consume(input, { ownerId, approvalToken } = {}) {
    const command = normalizeMemoryApprovalCommand(input);
    const owner = normalizeOwner(ownerId);
    const at = currentTime();
    const payload = parseToken(approvalToken, approvalSecret);
    if (payload.e <= at) fail('MEMORY_APPROVAL_EXPIRED');
    if (payload.e > at + MAX_TTL_MS || payload.o !== owner || payload.d !== commandDigest(command)) fail('MEMORY_APPROVAL_MISMATCH');
    const finish = (claimed) => {
      if (!claimed) fail('MEMORY_APPROVAL_REPLAYED');
      return command;
    };
    const claimed = replayStore.claim({ nonce: payload.n, expiresAt: payload.e, now: at });
    return claimed && typeof claimed.then === 'function' ? claimed.then(finish) : finish(claimed);
  }

  return Object.freeze({ prepare, consume });
}

export const PERSONAL_MEMORY_APPROVAL_LIMITS = Object.freeze({
  defaultTtlMs: DEFAULT_TTL_MS,
  maxTtlMs: MAX_TTL_MS
});
