import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeGmailSendRequest } from './gmail-send-contract.mjs';

const TOKEN_PREFIX = 'gs1';
const DEFAULT_TTL_MS = 120_000;
const MAX_TTL_MS = 300_000;
const NONCE_BYTES = 16;
const OWNER_PATTERN = /^owner_[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^gs1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/;
const PAYLOAD_FIELDS = new Set(['v', 'n', 'e', 'o', 'd']);

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
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail('INVALID_GMAIL_SEND_APPROVAL_SECRET');
  const secret = Buffer.from(value);
  if (secret.length < 32) fail('INVALID_GMAIL_SEND_APPROVAL_SECRET');
  return secret;
}

function resolveOwner(ownerResolver, principal) {
  const ownership = ownerResolver?.resolve?.(principal);
  if (!ownership || typeof ownership.ownerId !== 'string' || !OWNER_PATTERN.test(ownership.ownerId)) {
    fail('INVALID_GMAIL_SEND_APPROVAL_OWNER');
  }
  return ownership.ownerId;
}

function fieldDigest(label, value) {
  return createHash('sha256')
    .update(`hafize:gmail-send-${label}:v1\0`)
    .update(value, 'utf8')
    .digest('base64url');
}

function commandDigest(command) {
  const canonical = JSON.stringify([
    'message.send',
    command.to,
    fieldDigest('subject', command.subject),
    fieldDigest('text', command.text)
  ]);
  return createHash('sha256')
    .update('hafize:gmail-send-command:v1\0')
    .update(canonical, 'utf8')
    .digest('base64url');
}

function sign(secret, body) {
  return createHmac('sha256', secret)
    .update('hafize:gmail-send-approval:v1\0')
    .update(body)
    .digest();
}

function parseToken(token, secret) {
  const normalized = typeof token === 'string' ? token.trim() : '';
  if (normalized.length > 2_048) fail('GMAIL_SEND_APPROVAL_INVALID');
  const match = TOKEN_PATTERN.exec(normalized);
  if (!match) fail('GMAIL_SEND_APPROVAL_INVALID');
  const [, body, encodedMac] = match;
  let actualMac;
  try { actualMac = Buffer.from(encodedMac, 'base64url'); } catch { fail('GMAIL_SEND_APPROVAL_INVALID'); }
  const expectedMac = sign(secret, body);
  if (actualMac.length !== expectedMac.length || !timingSafeEqual(actualMac, expectedMac)) fail('GMAIL_SEND_APPROVAL_INVALID');
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { fail('GMAIL_SEND_APPROVAL_INVALID'); }
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') fail('GMAIL_SEND_APPROVAL_INVALID');
  for (const key of Object.keys(payload)) if (!PAYLOAD_FIELDS.has(key)) fail('GMAIL_SEND_APPROVAL_INVALID');
  if (payload.v !== 1 || typeof payload.n !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(payload.n)) fail('GMAIL_SEND_APPROVAL_INVALID');
  if (!Number.isSafeInteger(payload.e) || !OWNER_PATTERN.test(payload.o || '') || !/^[A-Za-z0-9_-]{43}$/.test(payload.d || '')) {
    fail('GMAIL_SEND_APPROVAL_INVALID');
  }
  return payload;
}

export function createGmailSendApprovalBoundary({
  secret,
  ownerResolver,
  replayStore = createLocalReplayStore(),
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
  randomBytesImpl = randomBytes
} = {}) {
  const approvalSecret = normalizeSecret(secret);
  if (typeof ownerResolver?.resolve !== 'function') fail('INVALID_GMAIL_SEND_APPROVAL_OWNER_RESOLVER');
  if (typeof replayStore?.claim !== 'function') fail('INVALID_GMAIL_SEND_APPROVAL_REPLAY_STORE');
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > MAX_TTL_MS) fail('INVALID_GMAIL_SEND_APPROVAL_TTL');
  if (typeof now !== 'function' || typeof randomBytesImpl !== 'function') fail('INVALID_GMAIL_SEND_APPROVAL_RUNTIME');

  function currentTime() {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_GMAIL_SEND_APPROVAL_CLOCK');
    return value;
  }

  function prepare(input, { principal } = {}) {
    const command = normalizeGmailSendRequest(input);
    const ownerId = resolveOwner(ownerResolver, principal);
    const issuedAt = currentTime();
    const nonce = Buffer.from(randomBytesImpl(NONCE_BYTES));
    if (nonce.length !== NONCE_BYTES) fail('INVALID_GMAIL_SEND_APPROVAL_NONCE');
    const payload = { v: 1, n: nonce.toString('base64url'), e: issuedAt + ttlMs, o: ownerId, d: commandDigest(command) };
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return Object.freeze({
      approvalToken: `${TOKEN_PREFIX}.${body}.${sign(approvalSecret, body).toString('base64url')}`,
      expiresAt: new Date(payload.e).toISOString(),
      command
    });
  }

  function consume(input, { principal, approvalToken } = {}) {
    const command = normalizeGmailSendRequest(input);
    const ownerId = resolveOwner(ownerResolver, principal);
    const at = currentTime();
    const payload = parseToken(approvalToken, approvalSecret);
    if (payload.e <= at) fail('GMAIL_SEND_APPROVAL_EXPIRED');
    if (payload.e > at + MAX_TTL_MS || payload.o !== ownerId || payload.d !== commandDigest(command)) fail('GMAIL_SEND_APPROVAL_MISMATCH');
    const finish = (claimed) => {
      if (!claimed) fail('GMAIL_SEND_APPROVAL_REPLAYED');
      return command;
    };
    const claimed = replayStore.claim({ nonce: payload.n, expiresAt: payload.e, now: at });
    return claimed && typeof claimed.then === 'function' ? claimed.then(finish) : finish(claimed);
  }

  return Object.freeze({ prepare, consume });
}

export const GMAIL_SEND_APPROVAL_LIMITS = Object.freeze({ defaultTtlMs: DEFAULT_TTL_MS, maxTtlMs: MAX_TTL_MS });
